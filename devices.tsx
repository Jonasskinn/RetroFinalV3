import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Smartphone, Tv, Monitor as MonitorIcon, Router, Search, Wifi, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceCard } from "@/components/device-card";
import { StatusBar } from "@/components/status-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Device, NetworkStats } from "@shared/schema";

export default function DevicesPage() {
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  const { data: devices = [], isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: networkStats } = useQuery<NetworkStats>({
    queryKey: ["/api/network/stats"],
    refetchInterval: 5000,
  });


  const connectedDevices = devices.filter((d) => d.status === "connected");
  const disconnectedDevices = devices.filter((d) => d.status !== "connected");

  const defaultStats: NetworkStats = {
    latency: 3,
    fps: 0,
    connectedDevices: connectedDevices.length,
    totalBandwidth: 0,
    status: "good",
  };

  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case "phone":
        return Smartphone;
      case "tv":
        return Tv;
      case "pc":
        return MonitorIcon;
      case "router":
        return Router;
      default:
        return MonitorIcon;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <StatusBar networkStats={networkStats || defaultStats} />

      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl" data-testid="text-devices-title">
              Dispositivos Conectados
            </h1>
            <p className="text-sm text-muted-foreground">
              Aparecem automaticamente na rede WiFi
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {["phone", "tv", "pc", "router"].map((type) => {
            const count = devices.filter((d) => d.deviceType === type && d.status === "connected").length;
            const Icon = getDeviceTypeIcon(type);
            const labels = { phone: "Celulares", tv: "Smart TVs", pc: "PCs", router: "Roteadores" };
            
            return (
              <Card key={type} className="p-4 text-center">
                <Icon className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                <p className="font-display font-bold text-xl">{count}</p>
                <p className="text-xs text-muted-foreground">{labels[type as keyof typeof labels]}</p>
              </Card>
            );
          })}
        </div>

        <Card className="mb-6 border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wifi className="w-4 h-4 text-green-500 animate-pulse" />
              Conectando Automaticamente à Rede WiFi
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Todos os dispositivos com este app na mesma rede WiFi se conectarão automaticamente.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <div className="flex items-center gap-2 p-2 rounded-md bg-background">
                <Globe className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-xs">Abra o app em qualquer dispositivo</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-md bg-background">
                <Smartphone className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs">Celulares: Chrome ou Firefox</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-md bg-background">
                <Tv className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs">Smart TV: navegador integrado</span>
              </div>
            </div>
            <p className="text-xs mt-2 opacity-70">Cada dispositivo que abrir o site aparecera automaticamente na lista.</p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : devices.length === 0 ? (
          <Card className="p-8 text-center">
            <Search className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-display font-semibold text-lg mb-2">
              Nenhum dispositivo conectado ainda
            </h3>
            <p className="text-sm text-muted-foreground">
              Abra este app em outros dispositivos na mesma rede WiFi
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {connectedDevices.length > 0 && (
              <div>
                <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  Conectados ({connectedDevices.length})
                </h2>
                <div className="space-y-3">
                  {connectedDevices.map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      onConnect={() => {}}
                      onDisconnect={() => {}}
                    />
                  ))}
                </div>
              </div>
            )}

            {disconnectedDevices.length > 0 && (
              <div>
                <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full" />
                  Disponíveis ({disconnectedDevices.length})
                </h2>
                <div className="space-y-3">
                  {disconnectedDevices.map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      onConnect={() => {}}
                      onDisconnect={() => {}}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
