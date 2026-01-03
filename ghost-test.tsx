import { useState, useEffect, useRef } from "react";
import { 
  Cpu, 
  Monitor, 
  Wifi, 
  Zap, 
  Play, 
  Square, 
  RefreshCw,
  Server,
  Smartphone,
  Tv,
  Activity,
  Clock,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBar } from "@/components/status-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ghostDistributed, type DeviceScore, type DistributedMetrics } from "@/lib/ghost-distributed";
import { ghostClient } from "@/lib/ghost-client";

export default function GhostTestPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [devices, setDevices] = useState<DeviceScore[]>([]);
  const [metrics, setMetrics] = useState<DistributedMetrics | null>(null);
  const [myRole, setMyRole] = useState<string>("display");
  const [testResults, setTestResults] = useState<string[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    ghostDistributed.on("initialized", () => {
      setIsConnected(true);
      addLog("Sistema Fantasma inicializado");
    });

    ghostDistributed.on("scores-updated", (scores: DeviceScore[]) => {
      setDevices(scores);
      addLog(`${scores.length} dispositivo(s) detectado(s)`);
    });

    ghostDistributed.on("role-changed", ({ role, isMaster }) => {
      setMyRole(role);
      addLog(`Papel atribuído: ${role}${isMaster ? " (MESTRE)" : ""}`);
    });

    ghostDistributed.on("master-elected", ({ masterId }) => {
      addLog(`Mestre eleito: ${masterId.slice(0, 8)}...`);
    });

    ghostDistributed.on("latency-measured", ({ peerId, latency }) => {
      setLatencyHistory(prev => [...prev.slice(-19), latency]);
      addLog(`Latência para ${peerId.slice(0, 8)}: ${latency.toFixed(2)}ms`);
    });

    ghostDistributed.on("task-completed", ({ taskId }) => {
      addLog(`Tarefa ${taskId.slice(0, 8)} concluída`);
    });

    ghostDistributed.on("frame-received", () => {
      setMetrics(ghostDistributed.getMetrics());
    });

    return () => {
      isRunningRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      ghostDistributed.stop();
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString("pt-BR");
    setTestResults(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const handleConnect = async () => {
    try {
      await ghostDistributed.initialize();
      setMetrics(ghostDistributed.getMetrics());
    } catch (error) {
      addLog(`Erro ao conectar: ${error}`);
    }
  };

  const handleStartTest = () => {
    ghostDistributed.start();
    setIsRunning(true);
    isRunningRef.current = true;
    addLog("Teste de distribuição iniciado");
    
    let frameId = 0;
    intervalRef.current = setInterval(() => {
      if (!isRunningRef.current) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      
      ghostDistributed.distributeTask({
        id: `task-${Date.now()}`,
        type: "render",
        data: null,
        timestamp: Date.now(),
      });
      
      ghostDistributed.requestRender(frameId++);
      setMetrics(ghostDistributed.getMetrics());
    }, 100);
  };

  const handleStopTest = () => {
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    ghostDistributed.stop();
    setIsRunning(false);
    addLog("Teste parado");
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "master": return <Server className="w-4 h-4 text-primary" />;
      case "compute": return <Cpu className="w-4 h-4 text-accent" />;
      case "storage": return <Monitor className="w-4 h-4 text-muted-foreground" />;
      default: return <Smartphone className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "master": return "Mestre (Renderiza)";
      case "compute": return "Computação";
      case "storage": return "Armazenamento";
      default: return "Display";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 30) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <StatusBar />

      <header className="sticky top-0 z-50 flex items-center justify-between gap-2 p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" />
          <h1 className="font-display text-xl font-bold">Teste Distribuído</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Status do Experimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm">{isConnected ? "Conectado à Rede Fantasma" : "Desconectado"}</span>
              </div>
              <Badge variant={isRunning ? "default" : "secondary"}>
                {isRunning ? "Testando" : "Parado"}
              </Badge>
            </div>

            <div className="flex gap-2">
              {!isRunning ? (
                <Button onClick={handleStartTest} className="flex-1" data-testid="button-start-test">
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Teste
                </Button>
              ) : (
                <Button onClick={handleStopTest} variant="destructive" className="flex-1" data-testid="button-stop-test">
                  <Square className="w-4 h-4 mr-2" />
                  Parar
                </Button>
              )}
              <Button 
                size="icon" 
                variant="outline" 
                onClick={() => setMetrics(ghostDistributed.getMetrics())}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Meu Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <div className="flex items-center gap-3">
                {getRoleIcon(myRole)}
                <div>
                  <p className="font-medium">{ghostClient.getPeerName()}</p>
                  <p className="text-xs text-muted-foreground">{getRoleLabel(myRole)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono">{ghostClient.getPeerId().slice(0, 8)}...</p>
                {ghostDistributed.isMaster() && (
                  <Badge variant="default" className="text-xs">MESTRE</Badge>
                )}
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 rounded bg-muted/30">
                <p className="text-muted-foreground text-xs">GPU</p>
                <p className="font-medium">{ghostClient.getCapabilities().hasGPU ? "Disponível" : "Não"}</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <p className="text-muted-foreground text-xs">WASM</p>
                <p className="font-medium">{ghostClient.getCapabilities().hasWASM ? "Sim" : "Não"}</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <p className="text-muted-foreground text-xs">Memória</p>
                <p className="font-medium">{ghostClient.getCapabilities().maxMemory} MB</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <p className="text-muted-foreground text-xs">Banda</p>
                <p className="font-medium">{ghostClient.getCapabilities().bandwidth} Mbps</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {devices.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Tv className="w-4 h-4" />
                Dispositivos na Rede ({devices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.peerId}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`device-${device.peerId}`}
                >
                  <div className="flex items-center gap-3">
                    {getRoleIcon(device.suggestedRole)}
                    <div>
                      <p className="font-medium">{device.peerName}</p>
                      <p className="text-xs text-muted-foreground">{getRoleLabel(device.suggestedRole)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${getScoreColor(device.score)}`}>
                      {device.score}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {device.latency.toFixed(1)}ms
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {metrics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Métricas do Teste
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Dispositivos</p>
                  <p className="text-2xl font-bold">{metrics.totalDevices}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Latência Média</p>
                  <p className="text-2xl font-bold">{metrics.avgLatency.toFixed(1)}ms</p>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Tarefas Distribuídas</p>
                  <p className="text-2xl font-bold">{metrics.tasksDistributed}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Frames Processados</p>
                  <p className="text-2xl font-bold">{metrics.framesProcessed}</p>
                </div>
              </div>

              {latencyHistory.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Histórico de Latência</p>
                  <div className="flex items-end gap-1 h-16">
                    {latencyHistory.map((lat, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-primary/60 rounded-t"
                        style={{ height: `${Math.min(100, (lat / 100) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0ms</span>
                    <span>100ms+</span>
                  </div>
                </div>
              )}

              {metrics.avgLatency > 16 && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    Latência muito alta para jogos em tempo real
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Para 60 FPS, a latência máxima deveria ser 16ms. 
                    Atual: {metrics.avgLatency.toFixed(1)}ms
                  </p>
                </div>
              )}

              {metrics.avgLatency <= 16 && metrics.avgLatency > 0 && (
                <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-green-500 font-medium">
                    Latência aceitável para sincronização!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Log de Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 overflow-y-auto space-y-1 font-mono text-xs bg-muted/30 p-2 rounded-md">
              {testResults.length === 0 ? (
                <p className="text-muted-foreground">Clique em Conectar para iniciar...</p>
              ) : (
                testResults.map((log, i) => (
                  <p key={i} className="text-muted-foreground">{log}</p>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Como testar:</h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Abra esta página em 2 ou mais dispositivos na mesma rede</li>
              <li>Clique em "Conectar" em cada dispositivo</li>
              <li>Clique em "Iniciar Teste" no dispositivo mais potente</li>
              <li>Observe as métricas de latência e distribuição</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
