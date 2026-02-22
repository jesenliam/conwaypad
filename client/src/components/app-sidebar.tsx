import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Coins,
  Trophy,
  BrainCircuit,
  ScanSearch,
  Rocket,
  ArrowUpRight,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { getUserWallet, truncateAddress } from "@/lib/conway";
import { useState, useEffect } from "react";
import logoSrc from "../assets/favicon.png";

const navItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    desc: "Platform overview & stats",
  },
  {
    title: "Token Explorer",
    url: "/tokens",
    icon: Coins,
    desc: "Browse all launched tokens",
  },
  {
    title: "Leaderboard",
    url: "/leaderboard",
    icon: Trophy,
    desc: "Top token creators",
  },
  {
    title: "AI Assistant",
    url: "/chat",
    icon: BrainCircuit,
    desc: "Chat & deploy tokens",
    badge: "AI",
  },
  {
    title: "Wallet Tracker",
    url: "/wallet",
    icon: ScanSearch,
    desc: "Analyze any wallet",
  },
  {
    title: "My Launches",
    url: "/my-launches",
    icon: Rocket,
    desc: "Your deployed tokens",
  },
];

const quickLinks = [
  { title: "Basescan",    href: "https://basescan.org",    testId: "link-basescan" },
  { title: "DexScreener", href: "https://dexscreener.com", testId: "link-dexscreener" },
  { title: "Uniswap V3",  href: "https://app.uniswap.org", testId: "link-uniswap" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [wallet, setWallet] = useState(getUserWallet());

  useEffect(() => {
    const handler = () => setWallet(getUserWallet());
    window.addEventListener("walletUpdated", handler);
    return () => window.removeEventListener("walletUpdated", handler);
  }, []);

  return (
    <Sidebar>
      {/* Brand Header */}
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.08) 100%)", border: "1px solid rgba(139,92,246,0.3)" }}>
            <img
              src={logoSrc}
              alt="ConwayPad"
              className="w-5 h-5 object-contain"
              style={{ filter: "drop-shadow(0 0 5px rgba(139,92,246,0.8))" }}
            />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-sm text-foreground leading-none"
               style={{ fontFamily: "'Oxanium', sans-serif", letterSpacing: "0.07em" }}>
              ConwayPad
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-primary/80 font-semibold uppercase tracking-widest">
                Base · v4
              </span>
              <span className="text-[9px] text-muted-foreground/50">Clanker SDK</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 space-y-1">
        {/* Main Nav */}
        <SidebarGroup className="p-0">
          <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/40 font-semibold px-3 mb-2">
            Navigation
          </p>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <Link
                      href={item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      className={`
                        relative flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left
                        transition-all duration-200 group/nav
                        ${isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }
                      `}
                      style={isActive ? {
                        background: "linear-gradient(90deg, rgba(139,92,246,0.14) 0%, rgba(139,92,246,0.04) 100%)",
                        boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.15)",
                      } : {}}
                    >
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                          style={{ background: "linear-gradient(180deg, #a78bfa, #7c3aed)" }}
                        />
                      )}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                        isActive
                          ? "bg-primary/20 shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                          : "bg-muted/50 group-hover/nav:bg-muted"
                      }`}>
                        <item.icon className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground/70 group-hover/nav:text-foreground"} transition-colors duration-200`} />
                      </div>
                      <span className={`text-[13px] flex-1 leading-none ${isActive ? "font-semibold" : "font-normal"}`}>
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none"
                              style={{ background: "rgba(139,92,246,0.18)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider */}
        <div className="mx-3 border-t border-border/30 my-1" />

        {/* Quick Links */}
        <SidebarGroup className="p-0">
          <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/40 font-semibold px-3 mb-2">
            Ecosystem
          </p>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {quickLinks.map((link) => (
                <SidebarMenuItem key={link.title}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={link.testId}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg w-full transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted/30 group/ext"
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted/50 group-hover/ext:bg-muted flex items-center justify-center flex-shrink-0 transition-colors duration-200">
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover/ext:text-primary transition-colors duration-200" />
                    </div>
                    <span className="text-[13px]">{link.title}</span>
                  </a>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3 border-t border-sidebar-border/50 space-y-2">
        <div className="rounded-xl border border-border/40 p-3 space-y-2"
             style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider leading-none mb-0.5">Wallet</p>
              {wallet ? (
                <span className="text-[11px] font-mono text-foreground/90 truncate block">
                  {truncateAddress(wallet)}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground/50">Not connected</span>
              )}
            </div>
            {wallet && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-blink-dot" />
            <span className="text-[10px] text-muted-foreground/50">Base Mainnet · Live</span>
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
