import { Smartphone, Tv, Monitor, Router, Battery, Cpu, HardDrive, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Device } from "@shared/schema";

interface DeviceCardProps {
  device: Device;
  onConnect: (device: Device) => void;
  onDisconnect: (device: Device) => void;
}

export function DeviceCard({ device, onConnect, onDisconnect }: DeviceCardProps) {
  const getDeviceIcon = () => {
    switch (device.deviceType) {
      case "phone":
        return Smartphone;
      case "tv":
        return Tv;
      case "pc":
        return Monitor;
      case "router":
        return Router;
      default:
        return Monitor;
    }
  };

  const getStatusColor = () => {
    switch (device.status) {
      case "connected":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "connecting":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "disconnected":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return "text-emerald-500";
    if (level > 20) return "text-amber-500";
    return "text-red-500";
  };

  const DeviceIcon = getDeviceIcon();

  return (
    <Card 
      className="p-4 hover-elevate"
      data-testid={`card-device-${device.id}`}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${
          device.status === "connected" 
            ? "bg-primary/20" 
            : "bg-muted"
        }`}>
          <DeviceIcon className={`w-6 h-6 ${
            device.status === "connected" 
              ? "text-primary" 
              : "text-muted-foreground"
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate" data-testid={`text-device-name-${device.id}`}>
              {device.name}
            </h3>
            <Badge variant="outline" className={`text-xs ${getStatusColor()}`}>
              {device.status === "connected" && (
                <>
                  <Wifi className="w-3 h-3 mr-1" />
                  Conectado
                </>
              )}
              {device.status === "connecting" && (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Conectando
                </>
              )}
              {device.status === "disconnected" && (
                <>
                  <WifiOff className="w-3 h-3 mr-1" />
                  Desconectado
                </>
              )}
            </Badge>
          </div>

          {device.ipAddress && (
            <p className="text-xs text-muted-foreground mb-3">
              {device.ipAddress}
            </p>
          )}

          {device.status === "connected" && (
            <div className="space-y-2">
              {device.batteryLevel !== null && (
                <div className="flex items-center gap-2">
                  <Battery className={`w-4 h-4 ${getBatteryColor(device.batteryLevel)}`} />
                  <Progress value={device.batteryLevel} className="flex-1 h-1.5" />
                  <span className="text-xs text-muted-foreground w-8">
                    {device.batteryLevel}%
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-muted-foreground" />
                <Progress value={device.cpuUsage || 0} className="flex-1 h-1.5" />
                <span className="text-xs text-muted-foreground w-8">
                  {Math.round(device.cpuUsage || 0)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <Progress value={device.ramUsage || 0} className="flex-1 h-1.5" />
                <span className="text-xs text-muted-foreground w-8">
                  {Math.round(device.ramUsage || 0)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          {device.status === "connecting" && (
            <div className="flex items-center gap-1 text-sm text-amber-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Conectando
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
