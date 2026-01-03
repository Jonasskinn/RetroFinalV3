import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Ghost, Wifi, WifiOff, Users, Activity, Zap, HardDrive, Cpu, Monitor, RefreshCw, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBar } from "@/components/status-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ghostClient } from "@/lib/ghost-client";
import type { GhostPeer, GhostNetworkStats } from "@shared/ghost-types";

export default function GhostNetworkPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [peers, setPeers] = useState<GhostPeer[]>([]);
  const [dataChannels, setDataChannels] = useState(0);

  const { data: serverStats, refetch: refetchStats } = useQuery<GhostNetworkStats>({
    queryKey: ["/api/ghost/stats"],
    refetchInterval: 3000,
  });

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await ghostClient.connect();
      setIsConnected(true);
    } catch (error) {
      console.error("Failed to connect:", error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    ghostClient.disconnect();
    setIsConnected(false);
    setPeers([]);
    setDataChannels(0);
  }, []);

  useEffect(() => {
    // Tentar conectar automaticamente ao entrar na página
    if (!ghostClient.getIsConnected()) {
      handleConnect();
    }

    const handlePeersUpdated = (updatedPeers: GhostPeer[]) => {
      setPeers(updatedPeers);
      refetchStats();
    };

    const handleChannelOpen = () => {
      setDataChannels(ghostClient.getDataChannelCount());
    };

    const handleChannelClose = () => {
      setDataChannels(ghostClient.getDataChannelCount());
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setPeers([]);
      setDataChannels(0);
    };

    ghostClient.on("peers-updated", handlePeersUpdated);
    ghostClient.on("channel-open", handleChannelOpen);
    ghostClient.on("channel-close", handleChannelClose);
    ghostClient.on("disconnected", handleDisconnected);

    // Forçar busca de peers a cada 10 segundos se estiver conectado
    const peerDiscoveryInterval = setInterval(() => {
      if (ghostClient.getIsConnected()) {
        refetchStats();
      }
    }, 10000);

    return () => {
      clearInterval(peerDiscoveryInterval);
      ghostClient.off("peers-updated", handlePeersUpdated);
      ghostClient.off("channel-open", handleChannelOpen);
      ghostClient.off("channel-close", handleChannelClose);
      ghostClient.off("disconnected", handleDisconnected);
    };
  }, [refetchStats]);

  const capabilities = ghostClient.getCapabilities();

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <StatusBar />

      <header className="sticky top-0 z-50 flex items-center justify-between gap-2 p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <Ghost className="w-6 h-6 text-primary" />
          <h1 className="font-display text-xl font-bold">Rede Fantasma</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-medium">Status da Conexão</CardTitle>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Conectado" : "Desconectado"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {isConnected ? (
                <Wifi className="w-8 h-8 text-green-500 animate-pulse" />
              ) : (
                <WifiOff className="w-8 h-8 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p className="font-medium">{ghostClient.getPeerName()}</p>
                <p className="text-sm text-muted-foreground">ID: {ghostClient.getPeerId().slice(0, 12)}...</p>
              </div>
              <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
                {isConnected ? "Conectado Automaticamente" : "Conectando..."}
              </Badge>
            </div>

            {isConnected && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{peers.length} peers na rede</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{dataChannels} canais P2P ativos</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Capacidades do Dispositivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">GPU</span>
              </div>
              <Badge variant={capabilities.hasGPU ? "default" : "secondary"} className="text-xs">
                {capabilities.hasGPU ? "Disponível" : "Indisponível"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">WebAssembly</span>
              </div>
              <Badge variant={capabilities.hasWASM ? "default" : "secondary"} className="text-xs">
                {capabilities.hasWASM ? "Suportado" : "Não Suportado"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Memória</span>
              </div>
              <span className="text-sm font-medium">{capabilities.maxMemory} MB</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Banda</span>
              </div>
              <span className="text-sm font-medium">{capabilities.bandwidth} Mbps</span>
            </div>
          </CardContent>
        </Card>

        {serverStats && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Estatísticas da Rede</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total de Peers</span>
                <span className="font-medium">{serverStats.totalPeers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Peers Ativos</span>
                <span className="font-medium">{serverStats.activePeers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Banda Total</span>
                <span className="font-medium">{serverStats.totalBandwidth} Mbps</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bundles Distribuídos</span>
                <span className="font-medium">{serverStats.bundlesDistributed}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {peers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Peers Conectados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {peers.map((peer) => (
                <div
                  key={peer.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`peer-item-${peer.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Ghost className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{peer.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {peer.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Jogos Fantasma</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Transforme e execute seus jogos como dados fantasma na rede distribuída
            </p>
            <Link href="/ghost-games">
              <Button className="w-full" data-testid="button-go-to-games">
                <Gamepad2 className="w-4 h-4 mr-2" />
                Gerenciar Jogos Fantasma
              </Button>
            </Link>
          </CardContent>
        </Card>

        {!isConnected && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Ghost className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-semibold mb-2">
                Conecte-se à Rede Fantasma
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Junte-se à rede P2P para distribuir e executar jogos como dados fantasma
              </p>
              <Button onClick={handleConnect} disabled={isConnecting} data-testid="button-connect-ghost-empty">
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4 mr-2" />
                    Entrar na Rede
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
