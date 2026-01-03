import type { GhostBundle, GhostGame } from "@shared/ghost-types";

export class GhostCompiler {
  private chunksizeBytes = 256 * 1024; // 256KB chunks

  async compileGame(
    file: File,
    gameName: string,
    onProgress?: (progress: number) => void
  ): Promise<GhostGame> {
    const gameId = crypto.randomUUID();
    const bundles: GhostBundle[] = [];
    
    // Read file as ArrayBuffer
    const arrayBuffer = await this.readFileAsArrayBuffer(file);
    
    // Create chunks
    const totalChunks = Math.ceil(arrayBuffer.byteLength / this.chunksizeBytes);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunksizeBytes;
      const end = Math.min(start + this.chunksizeBytes, arrayBuffer.byteLength);
      const chunkData = arrayBuffer.slice(start, end);
      
      // Calculate hash for integrity
      const hash = await this.calculateHash(chunkData);
      
      const bundle: GhostBundle = {
        id: `${gameId}-chunk-${i}`,
        gameId,
        type: i === 0 ? "wasm" : "asset", // First chunk is entry point
        hash,
        size: chunkData.byteLength,
        data: chunkData,
        dependencies: i > 0 ? [`${gameId}-chunk-${i - 1}`] : [],
      };
      
      bundles.push(bundle);
      
      if (onProgress) {
        onProgress(((i + 1) / totalChunks) * 100);
      }
    }
    
    // Calculate merkle root of all hashes
    const integrity = await this.calculateMerkleRoot(bundles.map(b => b.hash));
    
    const ghostGame: GhostGame = {
      id: gameId,
      originalName: gameName,
      bundles: bundles.map(b => b.id),
      entryPoint: bundles[0]?.id || "",
      totalSize: arrayBuffer.byteLength,
      status: "ready",
      integrity,
    };
    
    // Store bundles in IndexedDB for distribution
    await this.storeBundles(bundles);
    
    return ghostGame;
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  async calculateHash(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async calculateMerkleRoot(hashes: string[]): Promise<string> {
    if (hashes.length === 0) return "";
    if (hashes.length === 1) return hashes[0];
    
    const pairs: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = hashes[i + 1] || left;
      const combined = left + right;
      const encoder = new TextEncoder();
      const data = encoder.encode(combined);
      const hash = await this.calculateHash(data.buffer as ArrayBuffer);
      pairs.push(hash);
    }
    
    return this.calculateMerkleRoot(pairs);
  }

  async storeBundles(bundles: GhostBundle[]): Promise<void> {
    const db = await this.openDatabase();
    const transaction = db.transaction(["bundles"], "readwrite");
    const store = transaction.objectStore("bundles");
    
    for (const bundle of bundles) {
      const serializedData = bundle.data 
        ? Array.from(new Uint8Array(bundle.data)) 
        : null;
      
      store.put({
        id: bundle.id,
        gameId: bundle.gameId,
        type: bundle.type,
        hash: bundle.hash,
        size: bundle.size,
        dependencies: bundle.dependencies,
        serializedData,
      });
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getBundle(bundleId: string): Promise<GhostBundle | null> {
    const db = await this.openDatabase();
    const transaction = db.transaction(["bundles"], "readonly");
    const store = transaction.objectStore("bundles");
    
    return new Promise((resolve, reject) => {
      const request = store.get(bundleId);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const data = result.serializedData 
            ? new Uint8Array(result.serializedData).buffer 
            : null;
          
          resolve({
            id: result.id,
            gameId: result.gameId,
            type: result.type,
            hash: result.hash,
            size: result.size,
            dependencies: result.dependencies,
            data,
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllBundlesForGame(gameId: string): Promise<GhostBundle[]> {
    const db = await this.openDatabase();
    const transaction = db.transaction(["bundles"], "readonly");
    const store = transaction.objectStore("bundles");
    const index = store.index("gameId");
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(gameId);
      request.onsuccess = () => {
        const results = request.result.map((r: any) => {
          const data = r.serializedData 
            ? new Uint8Array(r.serializedData).buffer 
            : null;
          
          return {
            id: r.id,
            gameId: r.gameId,
            type: r.type,
            hash: r.hash,
            size: r.size,
            dependencies: r.dependencies,
            data,
          };
        });
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("GhostData", 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains("bundles")) {
          const store = db.createObjectStore("bundles", { keyPath: "id" });
          store.createIndex("gameId", "gameId", { unique: false });
          store.createIndex("hash", "hash", { unique: false });
        }
        
        if (!db.objectStoreNames.contains("games")) {
          const store = db.createObjectStore("games", { keyPath: "id" });
          store.createIndex("originalName", "originalName", { unique: false });
        }
      };
    });
  }

  async storeGame(game: GhostGame): Promise<void> {
    const db = await this.openDatabase();
    const transaction = db.transaction(["games"], "readwrite");
    const store = transaction.objectStore("games");
    store.put(game);
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getGame(gameId: string): Promise<GhostGame | null> {
    const db = await this.openDatabase();
    const transaction = db.transaction(["games"], "readonly");
    const store = transaction.objectStore("games");
    
    return new Promise((resolve, reject) => {
      const request = store.get(gameId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllGames(): Promise<GhostGame[]> {
    const db = await this.openDatabase();
    const transaction = db.transaction(["games"], "readonly");
    const store = transaction.objectStore("games");
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async verifyIntegrity(game: GhostGame): Promise<boolean> {
    const bundles = await this.getAllBundlesForGame(game.id);
    const hashes = bundles.map(b => b.hash);
    const calculatedRoot = await this.calculateMerkleRoot(hashes);
    return calculatedRoot === game.integrity;
  }

  async deleteGame(gameId: string): Promise<void> {
    const db = await this.openDatabase();
    
    const bundleTransaction = db.transaction(["bundles"], "readwrite");
    const bundleStore = bundleTransaction.objectStore("bundles");
    const index = bundleStore.index("gameId");
    
    await new Promise<void>((resolve, reject) => {
      const request = index.getAllKeys(gameId);
      request.onsuccess = () => {
        const keys = request.result;
        keys.forEach(key => bundleStore.delete(key));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const gameTransaction = db.transaction(["games"], "readwrite");
    const gameStore = gameTransaction.objectStore("games");
    
    return new Promise((resolve, reject) => {
      const request = gameStore.delete(gameId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const ghostCompiler = new GhostCompiler();
