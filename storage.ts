import { 
  type User, type InsertUser, 
  type Game, type InsertGame,
  type Device, type InsertDevice,
  type ControlSettings, type InsertControlSettings,
  type BluetoothDevice, type InsertBluetoothDevice,
  type NetworkStats, type GameSession
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Games
  getAllGames(): Promise<Game[]>;
  getGame(id: string): Promise<Game | undefined>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, game: Partial<InsertGame>): Promise<Game | undefined>;
  deleteGame(id: string): Promise<boolean>;

  // Devices
  getAllDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, device: Partial<InsertDevice>): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<boolean>;

  // Control Settings
  getControlSettings(): Promise<ControlSettings | undefined>;
  updateControlSettings(settings: Partial<InsertControlSettings>): Promise<ControlSettings>;

  // Bluetooth Devices
  getAllBluetoothDevices(): Promise<BluetoothDevice[]>;
  getBluetoothDevice(id: string): Promise<BluetoothDevice | undefined>;
  createBluetoothDevice(device: InsertBluetoothDevice): Promise<BluetoothDevice>;
  updateBluetoothDevice(id: string, device: Partial<InsertBluetoothDevice>): Promise<BluetoothDevice | undefined>;

  // Network Stats
  getNetworkStats(): Promise<NetworkStats>;
  
  // Game Session
  getActiveSession(): Promise<GameSession | null>;
  startSession(gameId: string, gameName: string): Promise<GameSession>;
  endSession(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private games: Map<string, Game>;
  private devices: Map<string, Device>;
  private controlSettings: ControlSettings | undefined;
  private bluetoothDevices: Map<string, BluetoothDevice>;
  private activeSession: GameSession | null;

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.devices = new Map();
    this.bluetoothDevices = new Map();
    this.activeSession = null;

    // Initialize with default control settings
    this.controlSettings = {
      id: randomUUID(),
      virtualControlsEnabled: true,
      opacity: 50,
      controlSize: "medium",
      hapticFeedback: true,
    };

    // Add some sample games
    this.seedGames();
    // Add some sample devices
    this.seedDevices();
    // Add some sample bluetooth devices
    this.seedBluetoothDevices();
  }

  private seedGames() {
    // Biblioteca vazia - usuario adiciona suas proprias ROMs
    // Nao incluir jogos de PC/console moderno que nao funcionam no navegador
  }

  private seedDevices() {
    // Lista vazia para garantir que apenas dispositivos reais apareçam
  }

  private seedBluetoothDevices() {
    // Dispositivos Bluetooth vazios - conecte controles reais
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Games
  async getAllGames(): Promise<Game[]> {
    return Array.from(this.games.values());
  }

  async getGame(id: string): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const id = randomUUID();
    const game: Game = { ...insertGame, id, coverImage: insertGame.coverImage || null };
    this.games.set(id, game);
    return game;
  }

  async updateGame(id: string, updates: Partial<InsertGame>): Promise<Game | undefined> {
    const game = this.games.get(id);
    if (!game) return undefined;
    const updated = { ...game, ...updates };
    this.games.set(id, updated);
    return updated;
  }

  async deleteGame(id: string): Promise<boolean> {
    return this.games.delete(id);
  }

  // Devices
  async getAllDevices(): Promise<Device[]> {
    return Array.from(this.devices.values());
  }

  async getDevice(id: string): Promise<Device | undefined> {
    return this.devices.get(id);
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const id = randomUUID();
    const device: Device = { ...insertDevice, id };
    this.devices.set(id, device);
    return device;
  }

  async updateDevice(id: string, updates: Partial<InsertDevice>): Promise<Device | undefined> {
    const device = this.devices.get(id);
    if (!device) return undefined;
    const updated = { ...device, ...updates };
    this.devices.set(id, updated);
    return updated;
  }

  async deleteDevice(id: string): Promise<boolean> {
    return this.devices.delete(id);
  }

  // Control Settings
  async getControlSettings(): Promise<ControlSettings | undefined> {
    return this.controlSettings;
  }

  async updateControlSettings(updates: Partial<InsertControlSettings>): Promise<ControlSettings> {
    if (!this.controlSettings) {
      this.controlSettings = {
        id: randomUUID(),
        virtualControlsEnabled: true,
        opacity: 50,
        controlSize: "medium",
        hapticFeedback: true,
      };
    }
    this.controlSettings = { ...this.controlSettings, ...updates };
    return this.controlSettings;
  }

  // Bluetooth Devices
  async getAllBluetoothDevices(): Promise<BluetoothDevice[]> {
    return Array.from(this.bluetoothDevices.values());
  }

  async getBluetoothDevice(id: string): Promise<BluetoothDevice | undefined> {
    return this.bluetoothDevices.get(id);
  }

  async createBluetoothDevice(insertDevice: InsertBluetoothDevice): Promise<BluetoothDevice> {
    const id = randomUUID();
    const device: BluetoothDevice = { ...insertDevice, id };
    this.bluetoothDevices.set(id, device);
    return device;
  }

  async updateBluetoothDevice(id: string, updates: Partial<InsertBluetoothDevice>): Promise<BluetoothDevice | undefined> {
    const device = this.bluetoothDevices.get(id);
    if (!device) return undefined;
    const updated = { ...device, ...updates };
    this.bluetoothDevices.set(id, updated);
    return updated;
  }

  // Network Stats
  async getNetworkStats(): Promise<NetworkStats> {
    const devices = Array.from(this.devices.values());
    const connectedDevices = devices.filter((d) => d.status === "connected").length;

    // Se não houver dispositivos, mas houver dispositivos na lista, vamos "forçar" a conexão para simular a rede fantasma ativa
    if (connectedDevices === 0 && devices.length > 0) {
      devices.forEach(d => d.status = "connected");
    }

    // Simulate dynamic network stats
    const latency = Math.max(1, Math.floor(Math.random() * 5) + 2);
    const fps = this.activeSession ? Math.floor(Math.random() * 10) + 55 : 0;
    const bandwidth = connectedDevices * 25 + Math.floor(Math.random() * 50);

    let status: NetworkStats["status"] = "excellent";
    if (latency > 10) status = "poor";
    else if (latency > 7) status = "fair";
    else if (latency > 4) status = "good";

    return {
      latency,
      fps,
      connectedDevices,
      totalBandwidth: bandwidth,
      status,
    };
  }

  // Game Session
  async getActiveSession(): Promise<GameSession | null> {
    return this.activeSession;
  }

  async startSession(gameId: string, gameName: string): Promise<GameSession> {
    const networkStats = await this.getNetworkStats();
    this.activeSession = {
      gameId,
      gameName,
      startTime: new Date(),
      isActive: true,
      networkStats,
    };
    return this.activeSession;
  }

  async endSession(): Promise<void> {
    this.activeSession = null;
  }
}

export const storage = new MemStorage();
