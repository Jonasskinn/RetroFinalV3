import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Maximize2, Minimize2, Volume2, VolumeX, Menu } from "lucide-react";

interface EmulatorPlayerProps {
  romUrl: string;
  romName: string;
  core: string;
  onClose: () => void;
}

declare global {
  interface Window {
    EJS_player: string;
    EJS_core: string;
    EJS_gameUrl: string;
    EJS_pathtodata: string;
    EJS_gameName: string;
    EJS_color: string;
    EJS_volume: number;
    EJS_language: string;
    EJS_startOnLoaded: boolean;
    EJS_onGameStart: () => void;
    EJS_onSaveState: () => void;
    EJS_onLoadState: () => void;
  }
}

const CORE_MAP: Record<string, string> = {
  nes: "nes",
  snes: "snes",
  gb: "gb",
  gbc: "gbc",
  gba: "gba",
  n64: "n64",
  nds: "nds",
  ds: "nds",
  psx: "psx",
  bin: "psx",
  cue: "psx",
  iso: "psx",
  md: "segaMD",
  gen: "segaMD",
  sms: "segaMS",
  gg: "segaGG",
  "32x": "sega32x",
  a26: "atari2600",
  a78: "atari7800",
  smc: "snes",
  sfc: "snes",
  z64: "n64",
  v64: "n64",
  zip: "gba", 
  "7z": "psx", // Frequentemente usado para compressão de PS1
};

export function detectCore(filename: string): string {
  const name = filename.toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // Prioridade para extensões específicas
  if (ext === "nes") return "nes";
  if (ext === "smc" || ext === "sfc") return "snes";
  if (ext === "gba") return "gba";
  if (ext === "gb") return "gb";
  if (ext === "gbc") return "gbc";
  if (ext === "z64" || ext === "n64" || ext === "v64") return "n64";
  if (ext === "bin" || ext === "iso" || ext === "cue" || ext === "img") return "psx";
  if (ext === "7z" && (name.includes("ps1") || name.includes("psx"))) return "psx";
  if (ext === "zip") {
    if (name.includes("mario") && (name.includes("world") || name.includes("snes"))) return "snes";
    if (name.includes("gba")) return "gba";
    if (name.includes("nes")) return "nes";
  }

  // Fallback para nomes de arquivos
  if (name.includes("gba")) return "gba";
  if (name.includes("nes")) return "nes";
  if (name.includes("snes") || name.includes("smc") || name.includes("sfc") || name.includes("super mario world")) return "snes";
  if (name.includes("n64") || name.includes("z64")) return "n64";
  if (name.includes("ps1") || name.includes("psx") || name.includes("playstation")) return "psx";
  if (name.includes("md") || name.includes("gen") || name.includes("sega") || name.includes("megadrive")) return "segaMD";
  
  return CORE_MAP[ext] || "nes";
}

export function EmulatorPlayer({ romUrl, romName, core, onClose }: EmulatorPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Limpar qualquer estado anterior do EmulatorJS
    const gameDiv = document.getElementById("emulator-game");
    if (gameDiv) {
      gameDiv.innerHTML = "";
    }

    // Configurar EmulatorJS ANTES de carregar o script
    window.EJS_player = "#emulator-game";
    window.EJS_core = core;
    window.EJS_gameUrl = romUrl;
    window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
    window.EJS_gameName = romName;
    window.EJS_color = "#8B5CF6";
    window.EJS_volume = 0.7;
    window.EJS_language = "pt-BR";
    window.EJS_startOnLoaded = true;
    // @ts-ignore
    window.EJS_DEBUG_XX = true;
    // @ts-ignore
    window.EJS_loadZip = true; // Habilitar suporte a ZIP

    // Evitar erros de rede com PSX - Otimizações para carregamento rápido
    if (core === "psx") {
      // @ts-ignore
      window.EJS_async_core = true;
      // @ts-ignore
      window.EJS_fast_save = true;
      // @ts-ignore
      window.EJS_webgl = true;
      // @ts-ignore
      window.EJS_requestFullscreen = false;
      // @ts-ignore
      window.EJS_loadZipAsync = true; // Async ZIP loading para arquivos grandes
      // @ts-ignore
      window.EJS_cache = true; // Cache emulator files
    }
    
    console.log("EmulatorJS Config:", { core, romUrl, romName });
    
    window.EJS_onGameStart = () => {
      setIsLoaded(true);
      console.log("Jogo iniciado:", romName);
      // Tentativa de fechar menu se ele abrir sozinho
      setTimeout(() => {
        closeRetroArchMenu();
      }, 1000);
    };

    // Carregar o script (sem async para garantir ordem)
    const script = document.createElement("script");
    script.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      const div = document.getElementById("emulator-game");
      if (div) {
        div.innerHTML = "";
      }
    };
  }, [romUrl, romName, core]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    window.EJS_volume = isMuted ? 0.7 : 0;
  };

  const closeRetroArchMenu = () => {
    const canvas = document.querySelector('#emulator-game canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'F1',
        keyCode: 112,
        which: 112,
        bubbles: true,
        cancelable: true
      });
      canvas.dispatchEvent(event);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      data-testid="emulator-container"
    >
      <div className="flex items-center justify-between gap-2 p-3 bg-card border-b">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-lg" data-testid="text-game-title">
            {romName}
          </span>
          {isLoaded && (
            <span className="text-xs text-accent px-2 py-1 bg-accent/10 rounded">
              Rodando
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={closeRetroArchMenu}
            data-testid="button-close-menu"
            className="gap-1"
          >
            <Menu className="w-4 h-4" />
            Fechar Menu
          </Button>
          
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={toggleMute}
            data-testid="button-mute"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={toggleFullscreen}
            data-testid="button-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onClose}
            data-testid="button-close-emulator"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div 
          id="emulator-game" 
          className="w-full h-full max-w-4xl max-h-[80vh]"
          data-testid="emulator-game-container"
        />
      </div>
      
      <div className="p-3 bg-card border-t text-center text-sm text-muted-foreground">
        Setas = Direcional | Z = A | X = B | Enter = Start | Se aparecer menu, clique "Fechar Menu"
      </div>
    </div>
  );
}
