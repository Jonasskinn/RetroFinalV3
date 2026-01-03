import { Wifi, Monitor, Zap, Battery } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { NetworkStats } from "@shared/schema";

interface StatusBarProps {
  networkStats?: NetworkStats;
  isGameActive?: boolean;
}

export function StatusBar({ networkStats: propStats, isGameActive = false }: StatusBarProps) {
  const { data: fetchedStats } = useQuery<NetworkStats>({
    queryKey: ["/api/network/stats"],
    refetchInterval: 5000,
    enabled: !propStats,
  });

  const networkStats = propStats || fetchedStats || {
    latency: 0,
    fps: 0,
    connectedDevices: 0,
    totalBandwidth: 0,
    status: "good" as const,
  };
  const getLatencyColor = (latency: number) => {
    if (latency < 5) return "text-emerald-500";
    if (latency < 10) return "text-amber-500";
    return "text-red-500";
  };

  const getStatusColor = (status: NetworkStats["status"]) => {
    switch (status) {
      case "excellent":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "good":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
      case "fair":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "poor":
        return "bg-red-500/20 text-red-400 border-red-500/30";
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-card/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center gap-2">
        <Monitor className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium" data-testid="text-device-count">
          {networkStats.connectedDevices}
        </span>
        <span className="text-xs text-muted-foreground">dispositivos</span>
      </div>

      <div className="flex items-center gap-2">
        <Wifi className={`w-4 h-4 ${getLatencyColor(networkStats.latency)}`} />
        <span className={`text-sm font-medium ${getLatencyColor(networkStats.latency)}`} data-testid="text-latency">
          {networkStats.latency}ms
        </span>
      </div>

      {isGameActive && (
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary" data-testid="text-fps">
            {networkStats.fps} FPS
          </span>
        </div>
      )}

      <Badge 
        variant="outline" 
        className={`ml-auto text-xs ${getStatusColor(networkStats.status)}`}
        data-testid="badge-network-status"
      >
        {networkStats.status === "excellent" && "Excelente"}
        {networkStats.status === "good" && "Boa"}
        {networkStats.status === "fair" && "Regular"}
        {networkStats.status === "poor" && "Ruim"}
      </Badge>
    </div>
  );
}
