import { useState, useRef, useEffect } from "react";
import { Ghost, Upload, Play, Trash2, Loader2, Gamepad2, AlertCircle, X, Languages, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBar } from "@/components/status-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { EmulatorPlayer, detectCore } from "@/components/emulator-player";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import nesImg from "@assets/generated_images/cute_nes_console_illustration.png";
import snesImg from "@assets/generated_images/cute_snes_console_illustration.png";
import ps1Img from "@assets/generated_images/cute_ps1_console_illustration.png";
import gameboyImg from "@assets/generated_images/cute_game_boy_illustration.png";
import megadriveImg from "@assets/generated_images/cute_mega_drive_illustration.png";
import n64Img from "@assets/generated_images/cute_n64_console_illustration.png";

interface UploadedRom {
  id: string;
  filename: string;
  name: string;
  core: string;
  size: number;
  url: string;
}

const translations = {
  pt: {
    title: "Sistema Fantasma",
    library: "Biblioteca de Jogos",
    gamesCount: "jogos",
    addRom: "Adicionar ROM",
    uploading: "Enviando para servidor...",
    noGames: "Nenhum jogo adicionado ainda.",
    clickToAdd: "Clique em \"Adicionar ROM\" para começar!",
    romAdded: "ROM Adicionada",
    romReady: "pronto para jogar!",
    errorUpload: "Erro no Upload",
    errorProcess: "Não foi possível processar o arquivo.",
    deleteTitle: "ROM Removida",
    deleteDesc: "O jogo foi removido da biblioteca.",
    tipTitle: "Dica para Jogos 3D:",
    tipDesc: "Conecte vários dispositivos na mesma rede WiFi ou use um celular mais potente para melhor desempenho em PS1, N64 e outros games 3D.",
    formats: "Formatos Suportados",
    chooseConsole: "Escolher Console",
    detected: "Detectado",
    howToApp: "Como Criar o App (Android)",
    appStep1: "1. Copie o link deste site.",
    appStep2: "2. Acesse o site Web2APK ou Appy Pie pelo celular.",
    appStep3: "3. Cole o link e gere o arquivo APK.",
    appStep4: "4. Instale e jogue direto pelo app!",
    openConverter: "Abrir Conversor APK"
  },
  en: {
    title: "Ghost System",
    library: "Game Library",
    gamesCount: "games",
    addRom: "Add ROM",
    uploading: "Uploading to server...",
    noGames: "No games added yet.",
    clickToAdd: "Click \"Add ROM\" to start!",
    romAdded: "ROM Added",
    romReady: "ready to play!",
    errorUpload: "Upload Error",
    errorProcess: "Could not process file.",
    deleteTitle: "ROM Removed",
    deleteDesc: "The game was removed from library.",
    tipTitle: "3D Games Tip:",
    tipDesc: "Connect multiple devices on same WiFi or use a powerful phone for better PS1/N64 performance.",
    formats: "Supported Formats",
    chooseConsole: "Choose Console",
    detected: "Detected",
    howToApp: "How to Create App (Android)",
    appStep1: "1. Copy this website URL.",
    appStep2: "2. Visit Web2APK or Appy Pie on your mobile.",
    appStep3: "3. Paste the URL and generate APK.",
    appStep4: "4. Install and play via App!",
    openConverter: "Open APK Converter"
  }
};

const CORE_LABELS: Record<string, string> = {
  nes: "Nintendo (NES)",
  snes: "Super Nintendo",
  gb: "Game Boy",
  gbc: "Game Boy Color",
  gba: "Game Boy Advance",
  n64: "Nintendo 64",
  nds: "Nintendo DS",
  psx: "PlayStation",
  segaMD: "Mega Drive",
  segaMS: "Master System",
  segaGG: "Game Gear",
};

const CORE_IMAGES: Record<string, string> = {
  nes: nesImg,
  snes: snesImg,
  gb: gameboyImg,
  gbc: gameboyImg,
  gba: gameboyImg,
  n64: n64Img,
  psx: ps1Img,
  segaMD: megadriveImg,
  segaMS: megadriveImg,
};

function getCoreLabel(core: string): string {
  return CORE_LABELS[core] || core.toUpperCase();
}

function getCoreImage(core: string): string {
  return CORE_IMAGES[core] || nesImg;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const STORAGE_KEY = "ghost-roms-list";

interface PendingFile {
  file: File;
  name: string;
  detectedCore: string;
}

export default function GhostGamesPage() {
  const [lang, setLang] = useState<'pt' | 'en'>('en');
  const t = translations[lang];
  const [roms, setRoms] = useState<UploadedRom[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [playingRom, setPlayingRom] = useState<UploadedRom | null>(null);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [selectedCore, setSelectedCore] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const availableCores = Object.keys(CORE_LABELS);

  useEffect(() => {
    loadRoms();
    // Detect browser language
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'pt') setLang('pt');
  }, []);

  const loadRoms = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setRoms(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar ROMs:", e);
      }
    }
  };

  const saveRoms = (newRoms: UploadedRom[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRoms));
    setRoms(newRoms);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const detectedCore = detectCore(file.name);
    const gameName = file.name.replace(/\.[^/.]+$/, "");
    
    setPendingFile({ file, name: gameName, detectedCore });
    setSelectedCore(detectedCore);
  };

  const handleCoreSelected = async (coreChoice: string) => {
    if (!pendingFile) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const { file, name } = pendingFile;
      const shouldCompress = coreChoice === "psx" && file.size > 50 * 1024 * 1024;
      
      const formData = new FormData();
      formData.append("rom", file);
      formData.append("name", name);
      formData.append("core", coreChoice);
      formData.append("compress", shouldCompress ? "true" : "false");

      setUploadProgress(30);

      const response = await fetch("/api/roms/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      setUploadProgress(90);

      const rom: UploadedRom = await response.json();
      const cacheKey = `rom-cache-${rom.id}`;
      sessionStorage.setItem(cacheKey, JSON.stringify(rom));
      
      setUploadProgress(100);
      saveRoms([...roms, rom]);

      toast({
        title: t.romAdded,
        description: `${name} ${t.romReady} (${getCoreLabel(coreChoice)})`,
      });
    } catch (error) {
      console.error("Erro no upload:", error);
      toast({
        title: t.errorUpload,
        description: t.errorProcess,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setPendingFile(null);
      setSelectedCore("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePlayGame = (rom: UploadedRom) => {
    console.log("Playing ROM:", rom);
    
    // Monetização obrigatória: Abrir anúncio antes de jogar
    window.open("https://otieu.com/4/10402648", "_blank");

    // Conectar dispositivos automaticamente apenas se necessário
    const checkAndConnect = async () => {
      try {
        const response = await fetch("/api/devices");
        if (response.ok) {
          const devices = await response.json();
          const disconnected = devices.filter((d: any) => d.status === "disconnected");
          if (disconnected.length > 0) {
            for (const device of disconnected) {
              await fetch(`/api/devices/${device.id}/connect`, { method: "POST" });
            }
          }
        }
      } catch (e) {
        console.warn("Auto-connect warning:", e);
      }
    };
    
    const fullRomUrl = rom.url.startsWith("http") ? rom.url : window.location.origin + rom.url;
    setPlayingRom({ ...rom, url: fullRomUrl });
    
    checkAndConnect();
  };

  const handleCloseEmulator = () => {
    setPlayingRom(null);
  };

  const handleDeleteGame = async (rom: UploadedRom) => {
    try {
      await fetch(`/api/roms/${rom.filename}`, { method: "DELETE" });
      const newRoms = roms.filter((r) => r.id !== rom.id);
      saveRoms(newRoms);
      toast({
        title: t.deleteTitle,
        description: t.deleteDesc,
      });
    } catch (error) {
      console.error("Erro ao deletar:", error);
      toast({
        title: "Error",
        description: "Could not remove game.",
        variant: "destructive",
      });
    }
  };

  const supportedFormats = [
    { ext: ".nes", console: "Nintendo (NES)", core: "nes" },
    { ext: ".snes/.smc", console: "Super Nintendo", core: "snes" },
    { ext: ".gb/.gbc", console: "Game Boy / Color", core: "gb" },
    { ext: ".gba", console: "Game Boy Advance", core: "gba" },
    { ext: ".n64/.z64", console: "Nintendo 64", core: "n64" },
    { ext: ".bin/.iso", console: "PlayStation", core: "psx" },
    { ext: ".md/.gen", console: "Mega Drive / Genesis", core: "segaMD" },
    { ext: ".sms", console: "Master System", core: "segaMS" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b">
        <div className="flex items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-3">
            <Ghost className="w-7 h-7 text-primary" />
            <h1 className="font-display font-bold text-xl">{t.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
              title="Change Language / Mudar Idioma"
            >
              <Languages className="w-5 h-5" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gamepad2 className="w-5 h-5 text-primary" />
              {t.library}
            </CardTitle>
            <Badge variant="secondary">{roms.length} {t.gamesCount}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".nes,.snes,.smc,.sfc,.gb,.gbc,.gba,.n64,.z64,.v64,.nds,.bin,.cue,.iso,.md,.gen,.sms,.gg"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-rom-file"
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full gap-2"
              size="lg"
              data-testid="button-upload-rom"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.uploading}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  {t.addRom}
                </>
              )}
            </Button>

            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  {uploadProgress}%
                </p>
              </div>
            )}

            {roms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Gamepad2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>{t.noGames}</p>
                <p className="text-sm mt-2">
                  {t.clickToAdd}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {roms.map((rom) => (
                  <div
                    key={rom.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-muted/30 hover-elevate"
                    data-testid={`card-game-${rom.id}`}
                  >
                    <img
                      src={getCoreImage(rom.core)}
                      alt={getCoreLabel(rom.core)}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-medium truncate"
                        data-testid={`text-game-name-${rom.id}`}
                      >
                        {rom.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {getCoreLabel(rom.core)}
                        </Badge>
                        <span>{formatSize(rom.size)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="default"
                        onClick={() => handlePlayGame(rom)}
                        data-testid={`button-play-${rom.id}`}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteGame(rom)}
                        data-testid={`button-delete-${rom.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{t.tipTitle}</strong> {t.tipDesc}
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t.formats}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              {supportedFormats.map((format) => (
                <div
                  key={format.ext}
                  className="flex items-center gap-3 p-3 rounded bg-muted/30"
                >
                  <img
                    src={getCoreImage(format.core)}
                    alt={format.console}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-primary font-mono text-xs">
                        {format.ext}
                      </code>
                      <span className="text-muted-foreground text-sm">
                        {format.console}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <StatusBar />

      {playingRom && (
        <EmulatorPlayer
          romUrl={playingRom.url}
          romName={playingRom.name}
          core={playingRom.core}
          onClose={handleCloseEmulator}
        />
      )}

      {pendingFile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>{t.chooseConsole}</CardTitle>
              <button
                onClick={() => setPendingFile(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">File: {pendingFile.name}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {t.detected}: <strong>{getCoreLabel(pendingFile.detectedCore)}</strong>
                </p>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableCores.map((core) => (
                  <button
                    key={core}
                    onClick={() => handleCoreSelected(core)}
                    disabled={isUploading}
                    className={`w-full flex items-center gap-3 p-3 rounded-md border transition-colors ${
                      selectedCore === core
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <img
                      src={getCoreImage(core)}
                      alt={getCoreLabel(core)}
                      className="w-8 h-8 rounded object-cover"
                    />
                    <span className="text-sm font-medium">{getCoreLabel(core)}</span>
                    {core === pendingFile.detectedCore && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        {t.detected}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {uploadProgress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
