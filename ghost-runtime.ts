import type { GhostBundle, GhostGame, GhostRuntimeState } from "@shared/ghost-types";
import { ghostCompiler } from "./ghost-compiler";
import { ghostClient } from "./ghost-client";

type RuntimeEventHandler = (event: any) => void;

export class GhostRuntime {
  private state: GhostRuntimeState = {
    currentGame: null,
    loadedBundles: new Map(),
    wasmInstance: null,
    isRunning: false,
    fps: 0,
    frameTime: 0,
  };

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | WebGLRenderingContext | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateInterval: number = 1000;
  private lastFpsUpdate: number = 0;
  private eventHandlers: Map<string, RuntimeEventHandler[]> = new Map();

  async loadGame(game: GhostGame): Promise<void> {
    this.emit("loading", { game, progress: 0 });
    
    // Load all bundles from local storage
    const bundles = await ghostCompiler.getAllBundlesForGame(game.id);
    
    // Verify integrity
    const isValid = await ghostCompiler.verifyIntegrity(game);
    if (!isValid) {
      throw new Error("Game integrity check failed");
    }
    
    // Store bundles in memory
    for (const bundle of bundles) {
      this.state.loadedBundles.set(bundle.id, bundle);
      this.emit("loading", { 
        game, 
        progress: (this.state.loadedBundles.size / bundles.length) * 100 
      });
    }
    
    this.state.currentGame = game;
    this.emit("loaded", { game });
  }

  async start(canvasElement: HTMLCanvasElement): Promise<void> {
    if (!this.state.currentGame) {
      throw new Error("No game loaded");
    }

    this.canvas = canvasElement;
    
    // Try WebGL first, fall back to 2D
    this.ctx = canvasElement.getContext("webgl2") || 
               canvasElement.getContext("webgl") || 
               canvasElement.getContext("2d");

    if (!this.ctx) {
      throw new Error("Could not get canvas context");
    }

    // Get entry point bundle
    const entryBundle = this.state.loadedBundles.get(this.state.currentGame.entryPoint);
    
    if (entryBundle && entryBundle.data && entryBundle.data.byteLength > 0) {
      try {
        // Try to instantiate as WASM
        const wasmBytes = new Uint8Array(entryBundle.data);
        const wasmModule = await WebAssembly.compile(wasmBytes);
        const imports = this.createWasmImports();
        this.state.wasmInstance = await WebAssembly.instantiate(wasmModule, imports);
        
        this.emit("started", { game: this.state.currentGame, mode: "wasm" });
      } catch (error) {
        // If not valid WASM, run in simulation mode
        console.log("Running in simulation mode (not valid WASM):", error);
        this.emit("started", { game: this.state.currentGame, mode: "simulation" });
      }
    } else {
      // No entry bundle or empty data, run in simulation mode
      console.log("Running in simulation mode (no entry bundle data)");
      this.emit("started", { game: this.state.currentGame, mode: "simulation" });
    }

    this.state.isRunning = true;
    this.lastFrameTime = performance.now();
    this.lastFpsUpdate = this.lastFrameTime;
    this.frameCount = 0;
    
    this.gameLoop();
  }

  private createWasmImports(): WebAssembly.Imports {
    return {
      env: {
        memory: new WebAssembly.Memory({ initial: 256, maximum: 512 }),
        table: new WebAssembly.Table({ initial: 0, element: "anyfunc" }),
        abort: () => console.error("WASM abort called"),
        log: (ptr: number, len: number) => {
          console.log(`WASM log: ptr=${ptr}, len=${len}`);
        },
        drawPixel: (x: number, y: number, r: number, g: number, b: number) => {
          if (this.ctx instanceof CanvasRenderingContext2D) {
            this.ctx.fillStyle = `rgb(${r},${g},${b})`;
            this.ctx.fillRect(x, y, 1, 1);
          }
        },
        getTime: () => performance.now(),
        random: () => Math.random(),
      },
      js: {
        print: (value: number) => console.log(value),
      },
    };
  }

  private gameLoop = () => {
    if (!this.state.isRunning || !this.canvas || !this.ctx) {
      return;
    }

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    this.frameCount++;
    
    // Update FPS every second
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      this.state.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.state.frameTime = deltaTime;
      this.lastFpsUpdate = now;
      this.frameCount = 0;
      this.emit("stats", { fps: this.state.fps, frameTime: this.state.frameTime });
    }

    // Run game logic
    if (this.state.wasmInstance && typeof (this.state.wasmInstance.exports as any).update === "function") {
      try {
        (this.state.wasmInstance.exports as any).update(deltaTime);
      } catch (error) {
        console.error("WASM update error:", error);
      }
    } else {
      // Simulation mode - render placeholder
      this.renderSimulation(deltaTime);
    }

    // Sync state with peers
    if (this.frameCount % 30 === 0 && this.state.currentGame) {
      this.syncState();
    }

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private renderSimulation(deltaTime: number) {
    if (!this.canvas || !(this.ctx instanceof CanvasRenderingContext2D)) {
      return;
    }

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Clear canvas
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, width, height);
    
    // Draw ghost data visualization
    const time = performance.now() / 1000;
    const gridSize = 20;
    
    for (let x = 0; x < width; x += gridSize) {
      for (let y = 0; y < height; y += gridSize) {
        const noise = Math.sin(x * 0.01 + time) * Math.cos(y * 0.01 + time);
        const alpha = (noise + 1) / 4;
        
        ctx.fillStyle = `rgba(147, 51, 234, ${alpha})`;
        ctx.fillRect(x, y, gridSize - 2, gridSize - 2);
      }
    }
    
    // Draw game info
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px Rajdhani";
    ctx.textAlign = "center";
    ctx.fillText(this.state.currentGame?.originalName || "Ghost Game", width / 2, height / 2 - 20);
    
    ctx.font = "16px Inter";
    ctx.fillStyle = "#a855f7";
    ctx.fillText("Sistema Fantasma Ativo", width / 2, height / 2 + 20);
    
    ctx.fillStyle = "#6b7280";
    ctx.font = "14px Inter";
    ctx.fillText(`FPS: ${this.state.fps} | Frame: ${this.state.frameTime.toFixed(2)}ms`, width / 2, height / 2 + 50);
  }

  private syncState() {
    if (!this.state.currentGame) return;
    
    const stateSnapshot = {
      gameId: this.state.currentGame.id,
      frame: this.frameCount,
      time: performance.now(),
    };
    
    ghostClient.syncState(this.state.currentGame.id, stateSnapshot);
  }

  pause() {
    this.state.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.emit("paused", { game: this.state.currentGame });
  }

  resume() {
    if (!this.state.currentGame || !this.canvas) {
      return;
    }
    this.state.isRunning = true;
    this.lastFrameTime = performance.now();
    this.gameLoop();
    this.emit("resumed", { game: this.state.currentGame });
  }

  stop() {
    this.pause();
    this.state.currentGame = null;
    this.state.loadedBundles.clear();
    this.state.wasmInstance = null;
    this.state.fps = 0;
    this.state.frameTime = 0;
    this.canvas = null;
    this.ctx = null;
    this.emit("stopped", {});
  }

  getState(): GhostRuntimeState {
    return { ...this.state };
  }

  isRunning(): boolean {
    return this.state.isRunning;
  }

  getFps(): number {
    return this.state.fps;
  }

  on(event: string, handler: RuntimeEventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: RuntimeEventHandler) {
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

export const ghostRuntime = new GhostRuntime();
