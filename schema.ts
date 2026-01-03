import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Game model
export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  coverImage: text("cover_image"),
  genre: text("genre").notNull(),
  gameType: text("game_type").notNull(), // 'online' | 'offline'
  minDevices: integer("min_devices").notNull().default(3),
  maxFps: integer("max_fps").notNull().default(60),
  resolution: text("resolution").notNull().default("1080p"),
  size: text("size").notNull(), // e.g., "45 GB"
  status: text("status").notNull().default("ready"), // 'ready' | 'downloading' | 'transforming'
});

export const insertGameSchema = createInsertSchema(games).omit({ id: true });
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

// Device model
export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceType: text("device_type").notNull(), // 'phone' | 'tv' | 'pc' | 'router'
  status: text("status").notNull().default("disconnected"), // 'connected' | 'connecting' | 'disconnected'
  batteryLevel: integer("battery_level"), // nullable for devices without battery
  cpuUsage: real("cpu_usage").default(0),
  ramUsage: real("ram_usage").default(0),
  ipAddress: text("ip_address"),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true });
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

// Control Settings model
export const controlSettings = pgTable("control_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  virtualControlsEnabled: boolean("virtual_controls_enabled").notNull().default(true),
  opacity: integer("opacity").notNull().default(50), // 0-100
  controlSize: text("control_size").notNull().default("medium"), // 'small' | 'medium' | 'large'
  hapticFeedback: boolean("haptic_feedback").notNull().default(true),
});

export const insertControlSettingsSchema = createInsertSchema(controlSettings).omit({ id: true });
export type InsertControlSettings = z.infer<typeof insertControlSettingsSchema>;
export type ControlSettings = typeof controlSettings.$inferSelect;

// Bluetooth Device model
export const bluetoothDevices = pgTable("bluetooth_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceType: text("device_type").notNull(), // 'gamepad' | 'keyboard' | 'mouse'
  connected: boolean("connected").notNull().default(false),
  batteryLevel: integer("battery_level"),
});

export const insertBluetoothDeviceSchema = createInsertSchema(bluetoothDevices).omit({ id: true });
export type InsertBluetoothDevice = z.infer<typeof insertBluetoothDeviceSchema>;
export type BluetoothDevice = typeof bluetoothDevices.$inferSelect;

// Network Stats (real-time, not persisted)
export interface NetworkStats {
  latency: number; // in ms
  fps: number;
  connectedDevices: number;
  totalBandwidth: number; // in Mbps
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

// Active Game Session
export interface GameSession {
  gameId: string;
  gameName: string;
  startTime: Date;
  isActive: boolean;
  networkStats: NetworkStats;
}
