const DB_NAME = "sistema-fantasma-roms";
const DB_VERSION = 1;
const STORE_NAME = "roms";

interface StoredRom {
  id: string;
  name: string;
  core: string;
  data: ArrayBuffer;
  size: number;
}

class SimpleRomStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    });
  }

  async saveRom(file: File, name: string, core: string): Promise<StoredRom> {
    if (!this.db) await this.init();
    
    const id = `rom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const data = await file.arrayBuffer();
    
    const rom: StoredRom = {
      id,
      name,
      core,
      data,
      size: file.size,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(rom);

      request.onsuccess = () => resolve(rom);
      request.onerror = () => reject(request.error);
    });
  }

  async getRom(id: string): Promise<StoredRom | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRoms(): Promise<StoredRom[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRom(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  createBlobUrl(rom: StoredRom): string {
    const blob = new Blob([rom.data], { type: "application/octet-stream" });
    return URL.createObjectURL(blob);
  }
}

export const simpleRomStorage = new SimpleRomStorage();
export type { StoredRom };
