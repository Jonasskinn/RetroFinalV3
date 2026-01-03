import { z } from "zod";

// Ghost Peer - represents a connected device in the ghost network
export interface GhostPeer {
  id: string;
  name: string;
  type: 'browser' | 'mobile' | 'tv' | 'server';
  capabilities: PeerCapabilities;
  status: 'connecting' | 'connected' | 'syncing' | 'ready';
  lastSeen: number;
}

export interface PeerCapabilities {
  hasGPU: boolean;
  hasWASM: boolean;
  maxMemory: number; // in MB
  bandwidth: number; // in Mbps
  canRender: boolean;
  canCompute: boolean;
  canStore: boolean;
}

// Ghost Data Bundle - a chunk of transformed game data
export interface GhostBundle {
  id: string;
  gameId: string;
  type: 'wasm' | 'asset' | 'state' | 'shader';
  hash: string; // SHA-256 for integrity verification
  size: number;
  data: ArrayBuffer | null;
  dependencies: string[]; // IDs of other bundles this depends on
}

// Ghost Game - a game transformed into ghost data format
export interface GhostGame {
  id: string;
  originalName: string;
  bundles: string[]; // Bundle IDs
  entryPoint: string; // Main WASM bundle ID
  totalSize: number;
  status: 'transforming' | 'ready' | 'distributing' | 'running';
  integrity: string; // Merkle root of all bundle hashes
}

// Signaling messages for WebRTC
export const signalingMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    peerId: z.string(),
    peerName: z.string().optional(),
    capabilities: z.object({
      hasGPU: z.boolean(),
      hasWASM: z.boolean(),
      maxMemory: z.number(),
      bandwidth: z.number(),
      canRender: z.boolean(),
      canCompute: z.boolean(),
      canStore: z.boolean(),
    }).optional(),
  }),
  z.object({
    type: z.literal("leave"),
    peerId: z.string(),
  }),
  z.object({
    type: z.literal("offer"),
    from: z.string(),
    to: z.string(),
    sdp: z.string(),
  }),
  z.object({
    type: z.literal("answer"),
    from: z.string(),
    to: z.string(),
    sdp: z.string(),
  }),
  z.object({
    type: z.literal("ice-candidate"),
    from: z.string(),
    to: z.string(),
    candidate: z.string(),
  }),
  z.object({
    type: z.literal("peer-list"),
    peers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      status: z.string(),
    })),
  }),
  z.object({
    type: z.literal("peer-joined"),
    peer: z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      status: z.string(),
    }),
  }),
  z.object({
    type: z.literal("peer-left"),
    peerId: z.string(),
  }),
  z.object({
    type: z.literal("bundle-request"),
    bundleId: z.string(),
    from: z.string(),
  }),
  z.object({
    type: z.literal("bundle-response"),
    bundleId: z.string(),
    to: z.string(),
    data: z.string(),
  }),
  z.object({
    type: z.literal("state-sync"),
    gameId: z.string(),
    state: z.string(),
    timestamp: z.number(),
  }),
]);

export type SignalingMessage = z.infer<typeof signalingMessageSchema>;

// Ghost Network Stats
export interface GhostNetworkStats {
  totalPeers: number;
  activePeers: number;
  totalBandwidth: number;
  averageLatency: number;
  bundlesDistributed: number;
  gamesReady: number;
}

// Ghost Runtime State
export interface GhostRuntimeState {
  currentGame: GhostGame | null;
  loadedBundles: Map<string, GhostBundle>;
  wasmInstance: WebAssembly.Instance | null;
  isRunning: boolean;
  fps: number;
  frameTime: number;
}
