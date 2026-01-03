import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initGhostNetwork, getGhostNetwork } from "./ghost-network";
import multer from "multer";
import path from "path";
import fs from "fs";

const ROMS_DIR = "/tmp/roms";

if (!fs.existsSync(ROMS_DIR)) {
  fs.mkdirSync(ROMS_DIR, { recursive: true });
}

const romStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ROMS_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${randomStr}${ext}`);
  },
});

const upload = multer({ storage: romStorage });

export async function registerRoutes(httpServer: Server, app: Express) {
  await initGhostNetwork(httpServer);

  app.get("/api/network/stats", (_req, res) => {
    const ghostNet = getGhostNetwork();
    const stats = ghostNet?.getStats() || { latency: 0, fps: 0, connectedDevices: 0, totalBandwidth: 0, status: "idle" };
    res.json(stats);
  });

  app.get("/api/devices", (_req, res) => {
    const ghostNet = getGhostNetwork();
    const devices = (ghostNet as any)?.getDiscoveredDevices?.() || [];
    res.json(devices);
  });

  app.post("/api/devices/:id/connect", async (req, res) => {
    res.json({ success: true });
  });

  app.get("/api/session/active", async (_req, res) => {
    const session = storage.getActiveSession();
    res.json(session || null);
  });

  app.post("/api/roms/upload", upload.single("rom"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { originalname, filename, size } = req.file;
      const name = req.body.name || originalname.replace(/\.[^/.]+$/, "");
      const core = req.body.core || "unknown";

      res.json({
        id: filename.replace(/\.[^/.]+$/, ""),
        filename,
        name,
        core,
        size,
        url: `/api/roms/raw/${filename}`,
      });
    } catch (error) {
      console.error("ROM upload error:", error);
      res.status(500).json({ error: "Failed to upload ROM" });
    }
  });

  app.get("/api/roms/raw/:filename", (req, res) => {
    const filePath = path.join(ROMS_DIR, req.params.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "ROM not found" });
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(filePath);
  });

  app.delete("/api/roms/:filename", (req, res) => {
    try {
      const filePath = path.join(ROMS_DIR, req.params.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete ROM" });
    }
  });
}
