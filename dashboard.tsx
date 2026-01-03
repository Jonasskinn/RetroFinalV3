import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Ghost, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { GameCard } from "@/components/game-card";
import { StatusBar } from "@/components/status-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import type { Game, NetworkStats } from "@shared/schema";

const addGameSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  genre: z.string().min(1, "Gênero é obrigatório"),
  gameType: z.enum(["online", "offline"]),
  minDevices: z.coerce.number().min(1).max(20).default(3),
  maxFps: z.coerce.number().min(30).max(144).default(60),
  resolution: z.string().default("1080p"),
  size: z.string().min(1, "Tamanho é obrigatório"),
  status: z.string().default("ready"),
});

type AddGameForm = z.infer<typeof addGameSchema>;

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddGameForm>({
    resolver: zodResolver(addGameSchema),
    defaultValues: {
      name: "",
      genre: "Ação",
      gameType: "offline",
      minDevices: 3,
      maxFps: 60,
      resolution: "1080p",
      size: "",
      status: "ready",
    },
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const { data: networkStats } = useQuery<NetworkStats>({
    queryKey: ["/api/network/stats"],
    refetchInterval: 5000,
  });

  const addGameMutation = useMutation({
    mutationFn: async (data: AddGameForm) => {
      return apiRequest("POST", "/api/games", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setAddDialogOpen(false);
      form.reset();
      toast({
        title: "Jogo adicionado",
        description: "O jogo foi transformado em dados fantasmas com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o jogo.",
        variant: "destructive",
      });
    },
  });

  const launchGameMutation = useMutation({
    mutationFn: async (game: Game) => {
      return apiRequest("POST", `/api/games/${game.id}/launch`, {});
    },
    onSuccess: (_, game) => {
      toast({
        title: "Iniciando jogo",
        description: `${game.name} está sendo preparado na rede fantasma...`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o jogo. Verifique os dispositivos conectados.",
        variant: "destructive",
      });
    },
  });

  const filteredGames = games.filter((game) =>
    game.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const defaultStats: NetworkStats = {
    latency: 3,
    fps: 0,
    connectedDevices: 0,
    totalBandwidth: 0,
    status: "good",
  };

  const onSubmit = (data: AddGameForm) => {
    addGameMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <StatusBar networkStats={networkStats || defaultStats} />

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-transparent to-transparent" />
        
        <div className="relative px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Ghost className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-bold text-2xl" data-testid="text-app-title">
                  Sistema Fantasma
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gaming distribuído em rede local
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar jogos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-games"
              />
            </div>
            
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" data-testid="button-add-game">
                  <Plus className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display text-xl">
                    Adicionar Jogo
                  </DialogTitle>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Jogo</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ex: God of War" 
                              {...field}
                              data-testid="input-game-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="genre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gênero</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-genre">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Ação">Ação</SelectItem>
                                <SelectItem value="RPG">RPG</SelectItem>
                                <SelectItem value="Aventura">Aventura</SelectItem>
                                <SelectItem value="FPS">FPS</SelectItem>
                                <SelectItem value="Indie">Indie</SelectItem>
                                <SelectItem value="Esportes">Esportes</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="gameType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-game-type">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="offline">Offline</SelectItem>
                                <SelectItem value="online">Online</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="resolution"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Resolução</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-resolution">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="720p">720p</SelectItem>
                                <SelectItem value="1080p">1080p</SelectItem>
                                <SelectItem value="1440p">1440p</SelectItem>
                                <SelectItem value="4K">4K</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tamanho</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Ex: 45 GB" 
                                {...field}
                                data-testid="input-size"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={addGameMutation.isPending}
                      data-testid="button-submit-game"
                    >
                      {addGameMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Transformar em Dados Fantasmas
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        <h2 className="font-display font-semibold text-lg mb-4">
          Biblioteca de Jogos
        </h2>

        {gamesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredGames.length === 0 ? (
          <Card className="p-8 text-center">
            <Ghost className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-display font-semibold text-lg mb-2">
              {searchQuery ? "Nenhum jogo encontrado" : "Biblioteca vazia"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery 
                ? "Tente buscar por outro nome" 
                : "Adicione jogos para transformá-los em dados fantasmas"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-first-game">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeiro Jogo
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onLaunch={(g) => launchGameMutation.mutate(g)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
