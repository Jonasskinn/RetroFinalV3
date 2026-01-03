import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { log } from "./index";
import type { GhostPeer, PeerCapabilities, GhostNetworkStats } from "@shared/ghost-types";
import { signalingMessageSchema } from "@shared/ghost-types";

interface ConnectedPeer {
  ws: WebSocket;
  peer: GhostPeer;
}

export class GhostNetwork {
  private wss: WebSocketServer;
  private peers: Map<string, ConnectedPeer> = new Map();
  private stats: GhostNetworkStats = {
    totalPeers: 0,
    activePeers: 0,
    totalBandwidth: 0,
    averageLatency: 0,
    bundlesDistributed: 0,
    gamesReady: 0,
  };

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ghost" });
    this.setupWebSocket();
    log("Ghost Network initialized", "ghost");
  }

  private setupWebSocket() {
    this.wss.on("connection", (ws: WebSocket) => {
      let peerId: string | null = null;

      ws.on("message", (data: Buffer) => {
        try {
          const rawMessage = JSON.parse(data.toString());
          const parseResult = signalingMessageSchema.safeParse(rawMessage);
          
          if (!parseResult.success) {
            log(`Invalid message format: ${parseResult.error.message}`, "ghost");
            return;
          }
          
          peerId = this.handleMessage(ws, parseResult.data, peerId);
        } catch (error) {
          log(`Invalid message received: ${error}`, "ghost");
        }
      });

      ws.on("close", () => {
        if (peerId) {
          this.removePeer(peerId);
        }
      });

      ws.on("error", (error) => {
        log(`WebSocket error: ${error}`, "ghost");
      });
    });
  }

  private handleMessage(ws: WebSocket, message: any, currentPeerId: string | null): string | null {
    switch (message.type) {
      case "join":
        return this.handleJoin(ws, message);

      case "leave":
        if (message.peerId) {
          this.removePeer(message.peerId);
        }
        return null;

      case "offer":
      case "answer":
      case "ice-candidate":
        this.relayMessage(message);
        return currentPeerId;

      case "bundle-request":
        this.handleBundleRequest(message);
        return currentPeerId;

      case "state-sync":
        this.broadcastStateSync(message);
        return currentPeerId;

      default:
        log(`Unknown message type: ${message.type}`, "ghost");
        return currentPeerId;
    }
  }

  private handleJoin(ws: WebSocket, message: any): string {
    const peerId = message.peerId;
    const capabilities: PeerCapabilities = message.capabilities || {
      hasGPU: false,
      hasWASM: true,
      maxMemory: 2048,
      bandwidth: 100,
      canRender: true,
      canCompute: true,
      canStore: true,
    };

    const peer: GhostPeer = {
      id: peerId,
      name: message.peerName || `Peer-${peerId.slice(0, 6)}`,
      type: "browser",
      capabilities,
      status: "connected",
      lastSeen: Date.now(),
    };

    this.peers.set(peerId, { ws, peer });
    this.updateStats();

    log(`Peer joined: ${peer.name} (${peerId})`, "ghost");

    // Send peer list to the new peer
    const peerList = Array.from(this.peers.values())
      .filter((p) => p.peer.id !== peerId)
      .map((p) => ({
        id: p.peer.id,
        name: p.peer.name,
        type: p.peer.type,
        status: p.peer.status,
      }));

    ws.send(JSON.stringify({
      type: "peer-list",
      peers: peerList,
    }));

    // Forçar os outros peers a se conectarem imediatamente ao novo peer
    this.broadcast({
      type: "peer-list",
      peers: [{
        id: peer.id,
        name: peer.name,
        type: peer.type,
        status: peer.status,
      }]
    }, peerId);

    return peerId;
  }

  private removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      log(`Peer left: ${peer.peer.name} (${peerId})`, "ghost");
      this.peers.delete(peerId);
      this.updateStats();

      this.broadcast({
        type: "peer-left",
        peerId,
      });
    }
  }

  private relayMessage(message: { to?: string; [key: string]: any }) {
    if (!message.to) {
      log("Relay message missing 'to' field", "ghost");
      return;
    }
    
    const targetPeer = this.peers.get(message.to);
    if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
      try {
        targetPeer.ws.send(JSON.stringify(message));
      } catch (error) {
        log(`Failed to relay message to ${message.to}: ${error}`, "ghost");
      }
    }
  }

  private handleBundleRequest(message: any) {
    // Request bundle from all peers that might have it
    this.broadcast({
      type: "bundle-request",
      bundleId: message.bundleId,
      from: message.from,
    }, message.from);
  }

  private broadcastStateSync(message: any) {
    this.broadcast(message);
  }

  private broadcast(message: any, excludePeerId?: string) {
    const data = JSON.stringify(message);
    Array.from(this.peers.entries()).forEach(([peerId, peer]) => {
      if (peerId !== excludePeerId && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(data);
      }
    });
  }

  private updateStats() {
    this.stats.totalPeers = this.peers.size;
    this.stats.activePeers = Array.from(this.peers.values())
      .filter((p) => p.peer.status === "connected" || p.peer.status === "ready")
      .length;
    this.stats.totalBandwidth = Array.from(this.peers.values())
      .reduce((sum, p) => sum + p.peer.capabilities.bandwidth, 0);
  }

  getStats(): GhostNetworkStats {
    return { ...this.stats };
  }

  getPeers(): GhostPeer[] {
    return Array.from(this.peers.values()).map((p) => p.peer);
  }
}

let ghostNetwork: GhostNetwork | null = null;

export function initGhostNetwork(server: Server): GhostNetwork {
  if (!ghostNetwork) {
    ghostNetwork = new GhostNetwork(server);
  }
  return ghostNetwork;
}

export function getGhostNetwork(): GhostNetwork | null {
  return ghostNetwork;
}
