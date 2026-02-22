import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import TokenExplorer from "@/pages/token-explorer";
import Leaderboard from "@/pages/leaderboard";
import Chat from "@/pages/chat";
import WalletTracker from "@/pages/wallet-tracker";
import MyLaunches from "@/pages/my-launches";
import { LayoutDashboard, Coins, Trophy, Bot, Search, Rocket } from "lucide-react";

const PAGES: Record<string, { title: string; icon: any }> = {
  "/":            { title: "Dashboard",      icon: LayoutDashboard },
  "/tokens":      { title: "Token Explorer", icon: Coins },
  "/leaderboard": { title: "Leaderboard",    icon: Trophy },
  "/chat":        { title: "AI Assistant",   icon: Bot },
  "/wallet":      { title: "Wallet Tracker", icon: Search },
  "/my-launches": { title: "My Launches",    icon: Rocket },
};

function AnimatedRouter() {
  const [location] = useLocation();

  return (
    <div key={location} className="animate-fade-in h-full">
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tokens" component={TokenExplorer} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/chat" component={Chat} />
        <Route path="/wallet" component={WalletTracker} />
        <Route path="/my-launches" component={MyLaunches} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function AppHeader() {
  const [location] = useLocation();
  const page = PAGES[location] ?? { title: "ConwayPad", icon: LayoutDashboard };
  const Icon = page.icon;

  return (
    <header className="flex items-center gap-3 px-4 h-13 border-b border-border/50 bg-background/95 backdrop-blur-md flex-shrink-0 relative" style={{ height: "48px" }}>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent pointer-events-none" />
      <SidebarTrigger
        data-testid="button-sidebar-toggle"
        className="text-muted-foreground hover:text-foreground transition-colors duration-200 flex-shrink-0"
      />
      <div className="w-px h-4 bg-border/60 flex-shrink-0" />
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 text-primary flex-shrink-0" />
        <h1
          className="text-sm font-semibold text-foreground truncate"
          style={{ fontFamily: "'Oxanium', sans-serif" }}
        >
          {page.title}
        </h1>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-blink-dot" />
          <span className="text-[11px] text-green-400 font-medium hidden sm:block">Base Mainnet</span>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties} defaultOpen={true}>
          <div className="flex h-screen w-full dark overflow-hidden">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <AppHeader />
              <main className="flex-1 overflow-hidden bg-background">
                <AnimatedRouter />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
