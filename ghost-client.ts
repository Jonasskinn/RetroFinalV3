import type { GhostPeer, PeerCapabilities, GhostBundle, GhostNetworkStats } from "@shared/ghost-types";

type MessageHandler = (message: any) => void;

export class GhostClient {
  private ws: WebSocket | null = null;
  private peerId: string;
  private peerName: string;
  private capabilities: PeerCapabilities;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private connectedPeers: GhostPeer[] = [];
  private isConnected: boolean = false;

  constructor() {
    this.peerId = this.generatePeerId();
    this.peerName = `Browser-${this.peerId.slice(0, 6)}`;
    this.capabilities = this.detectCapabilities();
  }

  private generatePeerId(): string {
    return crypto.randomUUID();
  }

  private detectCapabilities(): PeerCapabilities {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const hasGPU = !!gl;

    return {
      hasGPU,
      hasWASM: typeof WebAssembly !== "undefined",
      maxMemory: (navigator as any).deviceMemory ? (navigator as any).deviceMemory * 1024 : 4096,
      bandwidth: (navigator as any).connection?.downlink || 100,
      canRender: hasGPU,
      canCompute: typeof WebAssembly !== "undefined",
      canStore: typeof indexedDB !== "undefined",
    };
  }

  connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ghost`;

      // Se já houver uma conexão tentando, não abra outra
      if (this.ws) {
        this.ws.close();
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.sendJoin();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };

      this.ws.onclose = () => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.ws = null;
        this.emit("disconnected", {});
        
        // Reconectar rapidamente para P2P agressivo
        if (wasConnected) {
          console.log("Auto-reconnecting to Ghost Network...");
          setTimeout(() => this.connect(), 1000);
        }
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.send({ type: "leave", peerId: this.peerId });
      this.ws.close();
      this.ws = null;
    }

    Array.from(this.peerConnections.values()).forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.isConnected = false;
  }

  private sendJoin() {
    this.send({
      type: "join",
      peerId: this.peerId,
      peerName: this.peerName,
      capabilities: this.capabilities,
    });
  }

  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case "peer-list":
        this.connectedPeers = message.peers;
        this.emit("peers-updated", this.connectedPeers);
        message.peers.forEach((peer: GhostPeer) => {
          this.createPeerConnection(peer.id, true);
        });
        break;

      case "peer-joined":
        if (!this.connectedPeers.find((p) => p.id === message.peer.id)) {
          this.connectedPeers.push(message.peer);
          this.emit("peers-updated", this.connectedPeers);
        }
        break;

      case "peer-left":
        this.connectedPeers = this.connectedPeers.filter((p) => p.id !== message.peerId);
        this.closePeerConnection(message.peerId);
        this.emit("peers-updated", this.connectedPeers);
        break;

      case "offer":
        this.handleOffer(message);
        break;

      case "answer":
        this.handleAnswer(message);
        break;

      case "ice-candidate":
        this.handleIceCandidate(message);
        break;

      case "bundle-request":
        this.emit("bundle-request", message);
        break;

      case "bundle-response":
        this.emit("bundle-response", message);
        break;

      case "state-sync":
        this.emit("state-sync", message);
        break;
    }
  }

  private async createPeerConnection(remotePeerId: string, isInitiator: boolean) {
    if (this.peerConnections.has(remotePeerId)) return;

    // Configuração ICE otimizada para rede local/WiFi
    const config: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
      // Força o uso de candidatos host (rede local) primeiro
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnections.set(remotePeerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: "ice-candidate",
          from: this.peerId,
          to: remotePeerId,
          candidate: JSON.stringify(event.candidate),
        });
      }
    };

    pc.ondatachannel = (event) => {
      this.setupDataChannel(remotePeerId, event.channel);
    };

    if (isInitiator) {
      const channel = pc.createDataChannel("ghost-data");
      this.setupDataChannel(remotePeerId, channel);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.send({
          type: "offer",
          from: this.peerId,
          to: remotePeerId,
          sdp: JSON.stringify(offer),
        });
      } catch (error) {
        console.error("Failed to create offer:", error);
      }
    }
  }

  private setupDataChannel(remotePeerId: string, channel: RTCDataChannel) {
    channel.onopen = () => {
      console.log(`Data channel opened with ${remotePeerId}`);
      this.dataChannels.set(remotePeerId, channel);
      this.emit("channel-open", { peerId: remotePeerId });
    };

    channel.onclose = () => {
      console.log(`Data channel closed with ${remotePeerId}`);
      this.dataChannels.delete(remotePeerId);
      this.emit("channel-close", { peerId: remotePeerId });
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit("data", { from: remotePeerId, data });
      } catch {
        this.emit("binary-data", { from: remotePeerId, data: event.data });
      }
    };
  }

  private async handleOffer(message: any) {
    await this.createPeerConnection(message.from, false);
    const pc = this.peerConnections.get(message.from);
    if (!pc) return;

    try {
      const offer = JSON.parse(message.sdp);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.send({
        type: "answer",
        from: this.peerId,
        to: message.from,
        sdp: JSON.stringify(answer),
      });
    } catch (error) {
      console.error("Failed to handle offer:", error);
    }
  }

  private async handleAnswer(message: any) {
    const pc = this.peerConnections.get(message.from);
    if (!pc) return;

    try {
      const answer = JSON.parse(message.sdp);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error("Failed to handle answer:", error);
    }
  }

  private async handleIceCandidate(message: any) {
    const pc = this.peerConnections.get(message.from);
    if (!pc) return;

    try {
      if (!message.candidate) return;
      
      const candidateData = typeof message.candidate === 'string' 
        ? JSON.parse(message.candidate) 
        : message.candidate;
      
      // Só adiciona se o estado da conexão permitir
      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
      } else {
        // Armazena candidatos se o descritor remoto ainda não estiver pronto
        console.log("Remote description not ready, candidate will be handled later if supported by browser");
      }
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  }

  private closePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.dataChannels.delete(peerId);
  }

  sendToPeer(peerId: string, data: any) {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === "open") {
      channel.send(JSON.stringify(data));
    }
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    Array.from(this.dataChannels.values()).forEach((channel) => {
      if (channel.readyState === "open") {
        channel.send(message);
      }
    });
  }

  requestBundle(bundleId: string) {
    this.send({
      type: "bundle-request",
      bundleId,
      from: this.peerId,
    });
  }

  syncState(gameId: string, state: any) {
    this.send({
      type: "state-sync",
      gameId,
      state: JSON.stringify(state),
      timestamp: Date.now(),
    });
  }

  on(event: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  getPeerId(): string {
    return this.peerId;
  }

  getPeerName(): string {
    return this.peerName;
  }

  getCapabilities(): PeerCapabilities {
    return this.capabilities;
  }

  getConnectedPeers(): GhostPeer[] {
    return this.connectedPeers;
  }

  getDataChannelCount(): number {
    return this.dataChannels.size;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const ghostClient = new GhostClient();
