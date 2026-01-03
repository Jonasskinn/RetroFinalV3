import { useQuery, useMutation } from "@tanstack/react-query";
import { Gamepad2, Wifi, Monitor, Sliders, Bluetooth, Keyboard, Mouse, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBar } from "@/components/status-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ControlSettings, BluetoothDevice, NetworkStats } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: controlSettings } = useQuery<ControlSettings>({
    queryKey: ["/api/settings/controls"],
  });

  const { data: bluetoothDevices = [] } = useQuery<BluetoothDevice[]>({
    queryKey: ["/api/bluetooth/devices"],
  });

  const { data: networkStats } = useQuery<NetworkStats>({
    queryKey: ["/api/network/stats"],
    refetchInterval: 5000,
  });

  const updateControlsMutation = useMutation({
    mutationFn: async (data: Partial<ControlSettings>) => {
      return apiRequest("PATCH", "/api/settings/controls", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/controls"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações de controle foram atualizadas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    },
  });

  const pairBluetoothMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest("POST", `/api/bluetooth/devices/${deviceId}/pair`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bluetooth/devices"] });
      toast({
        title: "Dispositivo pareado",
        description: "O dispositivo Bluetooth foi conectado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro no pareamento",
        description: "Não foi possível parear o dispositivo.",
        variant: "destructive",
      });
    },
  });

  const scanBluetoothMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/bluetooth/scan", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bluetooth/devices"] });
      toast({
        title: "Busca concluída",
        description: "Dispositivos Bluetooth encontrados.",
      });
    },
  });

  const defaultStats: NetworkStats = {
    latency: 3,
    fps: 0,
    connectedDevices: 0,
    totalBandwidth: 0,
    status: "good",
  };

  const getBluetoothIcon = (type: string) => {
    switch (type) {
      case "gamepad":
        return Gamepad2;
      case "keyboard":
        return Keyboard;
      case "mouse":
        return Mouse;
      default:
        return Bluetooth;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <StatusBar networkStats={networkStats || defaultStats} />

      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl" data-testid="text-settings-title">
              Configurações
            </h1>
            <p className="text-sm text-muted-foreground">
              Personalize sua experiência
            </p>
          </div>
          <ThemeToggle />
        </div>

        <Tabs defaultValue="controls" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-6">
            <TabsTrigger value="controls" className="text-xs" data-testid="tab-controls">
              <Gamepad2 className="w-4 h-4 mr-1" />
              Controles
            </TabsTrigger>
            <TabsTrigger value="graphics" className="text-xs" data-testid="tab-graphics">
              <Monitor className="w-4 h-4 mr-1" />
              Gráficos
            </TabsTrigger>
            <TabsTrigger value="network" className="text-xs" data-testid="tab-network">
              <Wifi className="w-4 h-4 mr-1" />
              Rede
            </TabsTrigger>
            <TabsTrigger value="bluetooth" className="text-xs" data-testid="tab-bluetooth">
              <Bluetooth className="w-4 h-4 mr-1" />
              Bluetooth
            </TabsTrigger>
          </TabsList>

          <TabsContent value="controls" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-display font-semibold text-lg mb-4">
                Controles Virtuais
              </h3>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Ativar Controles Virtuais</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Exibe botões na tela durante o jogo
                    </p>
                  </div>
                  <Switch
                    checked={controlSettings?.virtualControlsEnabled ?? true}
                    onCheckedChange={(checked) =>
                      updateControlsMutation.mutate({ virtualControlsEnabled: checked })
                    }
                    data-testid="switch-virtual-controls"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Opacidade</Label>
                    <span className="text-sm text-muted-foreground">
                      {controlSettings?.opacity ?? 50}%
                    </span>
                  </div>
                  <Slider
                    value={[controlSettings?.opacity ?? 50]}
                    min={10}
                    max={100}
                    step={5}
                    onValueChange={(value) =>
                      updateControlsMutation.mutate({ opacity: value[0] })
                    }
                    disabled={!controlSettings?.virtualControlsEnabled}
                    data-testid="slider-opacity"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="font-medium">Tamanho dos Controles</Label>
                  <div className="flex gap-2">
                    {["small", "medium", "large"].map((size) => (
                      <Button
                        key={size}
                        variant={controlSettings?.controlSize === size ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateControlsMutation.mutate({ controlSize: size })}
                        disabled={!controlSettings?.virtualControlsEnabled}
                        className="flex-1"
                        data-testid={`button-size-${size}`}
                      >
                        {size === "small" && "Pequeno"}
                        {size === "medium" && "Médio"}
                        {size === "large" && "Grande"}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Feedback Tátil</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vibração ao pressionar botões
                    </p>
                  </div>
                  <Switch
                    checked={controlSettings?.hapticFeedback ?? true}
                    onCheckedChange={(checked) =>
                      updateControlsMutation.mutate({ hapticFeedback: checked })
                    }
                    data-testid="switch-haptic"
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="graphics" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-display font-semibold text-lg mb-4">
                Configurações Gráficas
              </h3>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="font-medium">Qualidade de Renderização</Label>
                  <div className="flex gap-2">
                    {["720p", "1080p", "1440p"].map((res) => (
                      <Button
                        key={res}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        data-testid={`button-res-${res}`}
                      >
                        {res}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="font-medium">FPS Alvo</Label>
                  <div className="flex gap-2">
                    {[30, 60, 120].map((fps) => (
                      <Button
                        key={fps}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        data-testid={`button-fps-${fps}`}
                      >
                        {fps} FPS
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Otimização de IA</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ajusta automaticamente para melhor performance
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-ai-optimization" />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-display font-semibold text-lg mb-4">
                Configurações de Rede
              </h3>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-display font-bold text-primary">
                      {networkStats?.latency ?? 0}ms
                    </p>
                    <p className="text-xs text-muted-foreground">Latência</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-2xl font-display font-bold text-accent">
                      {networkStats?.totalBandwidth ?? 0} Mbps
                    </p>
                    <p className="text-xs text-muted-foreground">Largura de Banda</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Priorizar Latência</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reduz qualidade para menor lag
                    </p>
                  </div>
                  <Switch data-testid="switch-prioritize-latency" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Compensação de Lag</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Previsão de frames para suavidade
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-lag-compensation" />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="bluetooth" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-lg">
                  Dispositivos Bluetooth
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scanBluetoothMutation.mutate()}
                  disabled={scanBluetoothMutation.isPending}
                  data-testid="button-scan-bluetooth"
                >
                  {scanBluetoothMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Bluetooth className="w-4 h-4 mr-2" />
                  )}
                  Buscar
                </Button>
              </div>

              {bluetoothDevices.length === 0 ? (
                <div className="py-8 text-center">
                  <Bluetooth className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum dispositivo Bluetooth encontrado
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bluetoothDevices.map((device) => {
                    const Icon = getBluetoothIcon(device.deviceType);
                    return (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        data-testid={`bluetooth-device-${device.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${device.connected ? "bg-primary/20" : "bg-muted"}`}>
                            <Icon className={`w-5 h-5 ${device.connected ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{device.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {device.deviceType === "gamepad" && "Controle"}
                              {device.deviceType === "keyboard" && "Teclado"}
                              {device.deviceType === "mouse" && "Mouse"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {device.batteryLevel !== null && (
                            <Badge variant="outline" className="text-xs">
                              {device.batteryLevel}%
                            </Badge>
                          )}
                          <Badge
                            variant={device.connected ? "default" : "outline"}
                            className="text-xs"
                          >
                            {device.connected ? "Conectado" : "Disponível"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
