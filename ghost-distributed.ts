import { ghostClient } from "./ghost-client";
import type { GhostPeer, PeerCapabilities } from "@shared/ghost-types";

export type DeviceRole = "master" | "compute" | "storage" | "display";

export interface DeviceScore {
  peerId: string;
  peerName: string;
  score: number;
  capabilities: PeerCapabilities;
  suggestedRole: DeviceRole;
  latency: number;
}

export interface DistributedTask {
  id: string;
  type: "render" | "physics" | "audio" | "texture" | "input";
  data: ArrayBuffer | null;
  timestamp: number;
}

export interface DistributedMetrics {
  totalDevices: number;
  masterDevice: string | null;
  avgLatency: number;
  totalBandwidth: number;
  framesProcessed: number;
  tasksDistributed: number;
  failedTasks: number;
}

type DistributedEventHandler = (event: any) => void;

export class GhostDistributed {
  private myRole: DeviceRole = "display";
  private masterPeerId: string | null = null;
  private deviceScores: Map<string, DeviceScore> = new Map();
  private pendingTasks: Map<string, DistributedTask> = new Map();
  private completedTasks: Map<string, any> = new Map();
  private eventHandlers: Map<string, DistributedEventHandler[]> = new Map();
  private latencyTests: Map<string, number[]> = new Map();
  private isRunning: boolean = false;
  private wifiDiscoveryInterval: NodeJS.Timeout | null = null;
  private p2pBroadcastInterval: NodeJS.Timeout | null = null;
  
  private metrics: DistributedMetrics = {
    totalDevices: 0,
    masterDevice: null,
    avgLatency: 0,
    totalBandwidth: 0,
    framesProcessed: 0,
    tasksDistributed: 0,
    failedTasks: 0,
  };

  constructor() {
    this.setupEventListeners();
    this.startWiFiDiscovery();
  }

  private startWiFiDiscovery() {
    if (this.wifiDiscoveryInterval) clearInterval(this.wifiDiscoveryInterval);
    
    // Discover nearby devices on same WiFi network
    this.wifiDiscoveryInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/network/discover", { method: "POST" });
        if (response.ok) {
          const discovered = await response.json();
          for (const device of discovered) {
            if (!this.deviceScores.has(device.id)) {
              // Peer discovery via WiFi network - handled by ghost network
              this.emit("peer-discovered", device);
            }
          }
        }
      } catch (e) {
        // Silent fail for discovery
      }
    }, 5000);
    
    // Broadcast presence on network
    if (this.p2pBroadcastInterval) clearInterval(this.p2pBroadcastInterval);
    this.p2pBroadcastInterval = setInterval(async () => {
      try {
        await fetch("/api/network/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            peerId: ghostClient.getPeerId(),
            peerName: ghostClient.getPeerName(),
            capabilities: ghostClient.getCapabilities(),
          }),
        });
      } catch (e) {
        // Silent fail for broadcast
      }
    }, 10000);
  }

  private setupEventListeners() {
    ghostClient.on("peers-updated", (peers: GhostPeer[]) => {
      this.updateDeviceScores(peers);
    });

    ghostClient.on("data", ({ from, data }: { from: string; data: any }) => {
      this.handlePeerMessage(from, data);
    });

    ghostClient.on("channel-open", ({ peerId }: { peerId: string }) => {
      this.measureLatency(peerId);
    });
  }

  async initialize(): Promise<void> {
    if (!ghostClient.getIsConnected()) {
      await ghostClient.connect();
    }
    
    const myCapabilities = ghostClient.getCapabilities();
    const myScore = this.calculateDeviceScore(myCapabilities, 0);
    
    this.deviceScores.set(ghostClient.getPeerId(), {
      peerId: ghostClient.getPeerId(),
      peerName: ghostClient.getPeerName(),
      score: myScore,
      capabilities: myCapabilities,
      suggestedRole: this.suggestRole(myCapabilities, myScore),
      latency: 0,
    });

    this.emit("initialized", { myScore, myCapabilities });
  }

  private calculateDeviceScore(capabilities: PeerCapabilities, latency: number): number {
    let score = 0;
    
    if (capabilities.hasGPU) score += 40;
    if (capabilities.hasWASM) score += 20;
    if (capabilities.canRender) score += 20;
    if (capabilities.canCompute) score += 10;
    
    score += Math.min(capabilities.maxMemory / 1024, 10);
    score += Math.min(capabilities.bandwidth / 10, 10);
    
    score -= Math.min(latency / 10, 20);
    
    return Math.max(0, Math.round(score));
  }

  private suggestRole(capabilities: PeerCapabilities, score: number): DeviceRole {
    if (score >= 70 && capabilities.hasGPU && capabilities.canRender) {
      return "master";
    }
    if (score >= 50 && capabilities.hasWASM && capabilities.canCompute) {
      return "compute";
    }
    if (score >= 30 && capabilities.canStore) {
      return "storage";
    }
    return "display";
  }

  private updateDeviceScores(peers: GhostPeer[]) {
    for (const peer of peers) {
      if (!this.deviceScores.has(peer.id)) {
        const latency = this.latencyTests.get(peer.id)?.[0] || 50;
        const score = this.calculateDeviceScore(peer.capabilities, latency);
        
        this.deviceScores.set(peer.id, {
          peerId: peer.id,
          peerName: peer.name,
          score,
          capabilities: peer.capabilities,
          suggestedRole: this.suggestRole(peer.capabilities, score),
          latency,
        });
      }
    }
    
    this.electMaster();
    this.metrics.totalDevices = this.deviceScores.size;
    this.emit("scores-updated", Array.from(this.deviceScores.values()));
  }

  private electMaster() {
    let bestScore = -1;
    let bestPeerId: string | null = null;

    for (const [peerId, deviceScore] of Array.from(this.deviceScores.entries())) {
      if (deviceScore.score > bestScore && deviceScore.suggestedRole === "master") {
        bestScore = deviceScore.score;
        bestPeerId = peerId;
      }
    }

    if (!bestPeerId) {
      for (const [peerId, deviceScore] of Array.from(this.deviceScores.entries())) {
        if (deviceScore.score > bestScore) {
          bestScore = deviceScore.score;
          bestPeerId = peerId;
        }
      }
    }

    if (bestPeerId && bestPeerId !== this.masterPeerId) {
      this.masterPeerId = bestPeerId;
      this.metrics.masterDevice = bestPeerId;
      
      if (bestPeerId === ghostClient.getPeerId()) {
        this.myRole = "master";
        this.emit("role-changed", { role: "master", isMaster: true });
      } else {
        const myDevice = this.deviceScores.get(ghostClient.getPeerId());
        this.myRole = myDevice?.suggestedRole || "display";
        this.emit("role-changed", { role: this.myRole, isMaster: false });
      }
      
      this.emit("master-elected", { masterId: bestPeerId });
    }
  }

  private async measureLatency(peerId: string) {
    const startTime = performance.now();
    
    ghostClient.sendToPeer(peerId, {
      type: "latency-ping",
      timestamp: startTime,
      from: ghostClient.getPeerId(),
    });
  }

  private handlePeerMessage(from: string, data: any) {
    switch (data.type) {
      case "latency-ping":
        ghostClient.sendToPeer(from, {
          type: "latency-pong",
          originalTimestamp: data.timestamp,
          from: ghostClient.getPeerId(),
        });
        break;

      case "latency-pong":
        const latency = performance.now() - data.originalTimestamp;
        if (!this.latencyTests.has(from)) {
          this.latencyTests.set(from, []);
        }
        this.latencyTests.get(from)!.push(latency);
        
        const deviceScore = this.deviceScores.get(from);
        if (deviceScore) {
          deviceScore.latency = latency;
          deviceScore.score = this.calculateDeviceScore(deviceScore.capabilities, latency);
        }
        
        this.updateAverageLatency();
        this.emit("latency-measured", { peerId: from, latency });
        break;

      case "task-assign":
        this.handleTaskAssignment(data.task);
        break;

      case "task-result":
        this.handleTaskResult(from, data.taskId, data.result);
        break;

      case "frame-data":
        this.emit("frame-received", { from, frameData: data.frame });
        break;

      case "render-request":
        if (this.myRole === "master" || this.myRole === "compute") {
          this.processRenderRequest(from, data);
        }
        break;
    }
  }

  private updateAverageLatency() {
    let total = 0;
    let count = 0;
    
    for (const latencies of Array.from(this.latencyTests.values())) {
      if (latencies.length > 0) {
        total += latencies[latencies.length - 1];
        count++;
      }
    }
    
    this.metrics.avgLatency = count > 0 ? total / count : 0;
  }

  distributeTask(task: DistributedTask): boolean {
    if (!this.isRunning) return false;

    const targetDevice = this.findBestDeviceForTask(task.type);
    
    if (!targetDevice) {
      this.metrics.failedTasks++;
      return false;
    }

    this.pendingTasks.set(task.id, task);
    
    ghostClient.sendToPeer(targetDevice.peerId, {
      type: "task-assign",
      task: {
        id: task.id,
        type: task.type,
        dataSize: task.data?.byteLength || 0,
        timestamp: task.timestamp,
      },
    });

    this.metrics.tasksDistributed++;
    return true;
  }

  private findBestDeviceForTask(taskType: string): DeviceScore | null {
    let bestDevice: DeviceScore | null = null;
    let bestScore = -1;

    for (const device of Array.from(this.deviceScores.values())) {
      if (device.peerId === ghostClient.getPeerId()) continue;
      
      let suitability = device.score;
      
      switch (taskType) {
        case "render":
          if (device.capabilities.hasGPU && device.capabilities.canRender) {
            suitability += 30;
          }
          break;
        case "physics":
        case "compute":
          if (device.capabilities.hasWASM && device.capabilities.canCompute) {
            suitability += 20;
          }
          break;
        case "texture":
        case "storage":
          if (device.capabilities.canStore) {
            suitability += 15;
          }
          break;
      }
      
      suitability -= device.latency / 5;
      
      if (suitability > bestScore) {
        bestScore = suitability;
        bestDevice = device;
      }
    }

    return bestDevice;
  }

  private handleTaskAssignment(task: any) {
    this.emit("task-received", task);
    
    setTimeout(() => {
      ghostClient.broadcast({
        type: "task-result",
        taskId: task.id,
        result: { processed: true, deviceId: ghostClient.getPeerId() },
      });
    }, 10);
  }

  private handleTaskResult(from: string, taskId: string, result: any) {
    const task = this.pendingTasks.get(taskId);
    if (task) {
      this.pendingTasks.delete(taskId);
      this.completedTasks.set(taskId, { result, from, completedAt: Date.now() });
      this.emit("task-completed", { taskId, result, from });
    }
  }

  private processRenderRequest(from: string, data: any) {
    this.metrics.framesProcessed++;
    
    ghostClient.sendToPeer(from, {
      type: "frame-data",
      frame: { 
        id: data.frameId,
        rendered: true,
        timestamp: Date.now(),
      },
    });
  }

  requestRender(frameId: number): void {
    if (this.masterPeerId && this.masterPeerId !== ghostClient.getPeerId()) {
      ghostClient.sendToPeer(this.masterPeerId, {
        type: "render-request",
        frameId,
        timestamp: Date.now(),
      });
    }
  }

  start() {
    this.isRunning = true;
    this.emit("started", {});
  }

  stop() {
    this.isRunning = false;
    this.pendingTasks.clear();
    this.emit("stopped", {});
  }

  getMyRole(): DeviceRole {
    return this.myRole;
  }

  getMasterPeerId(): string | null {
    return this.masterPeerId;
  }

  getDeviceScores(): DeviceScore[] {
    return Array.from(this.deviceScores.values());
  }

  getMetrics(): DistributedMetrics {
    return { ...this.metrics };
  }

  isMaster(): boolean {
    return this.masterPeerId === ghostClient.getPeerId();
  }

  on(event: string, handler: DistributedEventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: DistributedEventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}

export const ghostDistributed = new GhostDistributed();
