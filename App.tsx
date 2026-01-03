import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BottomNav } from "@/components/bottom-nav";
import Dashboard from "@/pages/dashboard";
import DevicesPage from "@/pages/devices";
import SettingsPage from "@/pages/settings";
import SupportPage from "@/pages/support";
import ActiveGamePage from "@/pages/active-game";
import GhostNetworkPage from "@/pages/ghost-network";
import GhostGamesPage from "@/pages/ghost-games";
import GhostTestPage from "@/pages/ghost-test";
import NotFound from "@/pages/not-found";
import { ghostClient } from "@/lib/ghost-client";

function Router() {
  return (
    <Switch>
      <Route path="/" component={GhostGamesPage} />
      <Route path="/active" component={ActiveGamePage} />
      <Route path="/devices" component={DevicesPage} />
      <Route path="/ghost" component={GhostNetworkPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Conexão global automática com a Rede Fantasma
  useEffect(() => {
    const autoConnect = async () => {
      try {
        if (!ghostClient.getIsConnected()) {
          await ghostClient.connect();
          console.log("Connected to Ghost Network automatically");
        }
      } catch (e) {
        console.error("Global auto-connect failed:", e);
      }
    };
    autoConnect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            <Router />
            <BottomNav />
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
