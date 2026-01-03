import { Play, Users, Wifi, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Game } from "@shared/schema";

interface GameCardProps {
  game: Game;
  onLaunch: (game: Game) => void;
  isHovered?: boolean;
}

export function GameCard({ game, onLaunch }: GameCardProps) {
  const getGenreColor = (genre: string) => {
    switch (genre.toLowerCase()) {
      case "ação":
      case "action":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "rpg":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "aventura":
      case "adventure":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "fps":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "indie":
        return "bg-pink-500/20 text-pink-400 border-pink-500/30";
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  return (
    <Card 
      className="group relative overflow-hidden hover-elevate active-elevate-2 cursor-pointer"
      data-testid={`card-game-${game.id}`}
    >
      <div className="aspect-video relative overflow-hidden">
        {game.coverImage ? (
          <img
            src={game.coverImage}
            alt={game.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/20 to-accent/20 flex items-center justify-center">
            <Play className="w-12 h-12 text-primary/50" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-display font-bold text-lg text-white truncate" data-testid={`text-game-name-${game.id}`}>
            {game.name}
          </h3>
          
          <div className="flex items-center gap-2 mt-2">
            <Badge 
              variant="outline" 
              className={`text-xs ${getGenreColor(game.genre)}`}
            >
              {game.genre}
            </Badge>
            
            <Badge 
              variant="outline" 
              className={`text-xs ${
                game.gameType === "online" 
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30" 
                  : "bg-gray-500/20 text-gray-400 border-gray-500/30"
              }`}
            >
              {game.gameType === "online" ? (
                <Wifi className="w-3 h-3 mr-1" />
              ) : (
                <WifiOff className="w-3 h-3 mr-1" />
              )}
              {game.gameType === "online" ? "Online" : "Offline"}
            </Badge>
          </div>
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
          <Users className="w-3 h-3 text-white/70" />
          <span className="text-xs text-white/70">{game.minDevices}+</span>
        </div>
      </div>

      <div className="p-4 flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{game.resolution} / {game.maxFps} FPS</span>
          <span className="text-xs text-muted-foreground">{game.size}</span>
        </div>
        
        <Button 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onLaunch(game);
          }}
          data-testid={`button-launch-${game.id}`}
        >
          <Play className="w-4 h-4 mr-1" />
          Iniciar
        </Button>
      </div>
    </Card>
  );
}
