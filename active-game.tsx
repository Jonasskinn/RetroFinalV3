import { useQuery } from "@tanstack/react-query";
import { Play, Pause, Square, Maximize2, Monitor, Cpu, Wifi, Zap, Ghost } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBar } from "@/components/status-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";
import type { NetworkStats, GameSession, Device } from "@shared/schema";

export default function ActiveGamePage() {
  const { data: session } = useQuery<GameSession | null>({
    queryKey: ["/api/session/active"],
    refetchInterval: 2000,
  });

  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 3000,
  });

  const { data: networkStats } = useQuery<NetworkStats>({
    queryKey: ["/api/network/stats"],
    refetchInterval: 1000,
  });

  const connectedDevices = devices.filter((d) => d.status === "connected");

  const defaultStats: NetworkStats = {
    latency: 3,
    fps: 60,
    connectedDevices: connectedDevices.length,
    totalBandwidth: 100,
    status: "excellent",
  };

  if (!session?.isActive) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <StatusBar networkStats={networkStats || defaultStats} />

        <div className="flex flex-col items-center justify-center px-4 py-16">
          <div className="p-6 bg-muted/30 rounded-full mb-6">
            <Ghost className="w-16 h-16 text-muted-foreground/50" />
          </div>
          <h2 className="font-display font-bold text-xl mb-2">
            Nenhum jogo ativo
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
            Inicie um jogo da sua biblioteca para vê-lo aqui
          </p>
          <Link href="/">
            <Button data-testid="button-go-to-library">
              <Play className="w-4 h-4 mr-2" />
              Ir para Biblioteca
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const stats = session.networkStats || networkStats || defaultStats;

  return (
    <div className="min-h-screen bg-background pb-20">
      <StatusBar networkStats={stats} isGameActive={true} />

      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl" data-testid="text-active-game-name">
              {session.gameName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Sessão ativa
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="relative aspect-video bg-gradient-to-br from-primary/20 via-background to-accent/10 rounded-lg overflow-hidden mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Ghost className="w-16 h-16 mx-auto text-primary/50 mb-4 animate-pulse" />
              <p className="text-sm text-muted-foreground">
                Renderizando na rede fantasma...
              </p>
            </div>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <Badge className="bg-emerald-500/90 text-white">
              <Zap className="w-3 h-3 mr-1" />
              {stats.fps} FPS
            </Badge>
            <Badge className="bg-blue-500/90 text-white">
              <Wifi className="w-3 h-3 mr-1" />
              {stats.latency}ms
            </Badge>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="flex gap-2">
              <Button size="icon" variant="secondary" className="bg-black/50 backdrop-blur-sm border-0">
                <Pause className="w-5 h-5" />
              </Button>
              <Button size="icon" variant="secondary" className="bg-black/50 backdrop-blur-sm border-0">
                <Square className="w-5 h-5" />
              </Button>
            </div>
            <Button size="icon" variant="secondary" className="bg-black/50 backdrop-blur-sm border-0">
              <Maximize2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{stats.fps}</p>
                <p className="text-xs text-muted-foreground">FPS Atual</p>
              </div>
            </div>
            <Progress value={(stats.fps / 60) * 100} className="h-1.5" />
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Wifi className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{stats.latency}ms</p>
                <p className="text-xs text-muted-foreground">Latência</p>
              </div>
            </div>
            <Progress value={Math.max(0, 100 - (stats.latency * 5))} className="h-1.5" />
          </Card>
        </div>

        <Card className="p-4">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-muted-foreground" />
            Dispositivos na Sessão ({connectedDevices.length})
          </h3>

          <div className="space-y-3">
            {connectedDevices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <div>
                    <p className="font-medium text-sm">{device.name}</p>
                    <p className="text-xs text-muted-foreground">{device.ipAddress}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    {Math.round(device.cpuUsage || 0)}%
                  </div>
                  {device.batteryLevel !== null && (
                    <Badge variant="outline" className="text-xs">
                      {device.batteryLevel}%
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            {connectedDevices.length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Nenhum dispositivo conectado
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
