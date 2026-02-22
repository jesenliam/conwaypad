import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Coins, TrendingUp, ExternalLink, RefreshCw,
  BarChart3, Zap, DollarSign, Users, Activity,
} from "lucide-react";
import {
  formatUSD, formatNumber, truncateAddress, timeAgo,
  dexscreenerLink, normalizeToken, clankerLink,
} from "@/lib/conway";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function StatCard({
  title, value, subtitle, icon: Icon, loading, delay = 0, color = "primary",
}: {
  title: string; value: string; subtitle?: string; icon: any; loading?: boolean;
  delay?: number; color?: "primary" | "green" | "amber" | "violet";
}) {
  const colors = {
    primary: { bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.2)", text: "#a78bfa", top: "#8b5cf6" },
    green:   { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)",  text: "#4ade80", top: "#22c55e" },
    amber:   { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", text: "#fbbf24", top: "#f59e0b" },
    violet:  { bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.2)", text: "#c4b5fd", top: "#a78bfa" },
  };
  const c = colors[color];

  return (
    <div
      className="animate-slide-up rounded-xl border p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        animationDelay: `${delay}ms`,
        background: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        borderTop: `2px solid ${c.top}`,
      }}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-28 mt-1" />
          ) : (
            <p className="text-[28px] font-bold text-foreground leading-none">{value}</p>
          )}
          {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: c.text, width: "18px", height: "18px" }} />
        </div>
      </div>
    </div>
  );
}

function TokenRow({ token, rank }: { token: any; rank?: number }) {
  const t = normalizeToken(token);
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0 table-row-hover"
      data-testid={`token-row-${t.address}`}
    >
      {rank !== undefined && (
        <span className="w-5 text-center text-xs text-muted-foreground/50 font-mono flex-shrink-0">{rank}</span>
      )}
      {t.imgUrl ? (
        <img
          src={t.imgUrl}
          alt={t.name}
          className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-border/40"
          onError={(e) => { (e.target as any).style.display = "none"; }}
        />
      ) : (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border border-primary/20"
          style={{ background: "rgba(139,92,246,0.1)" }}
        >
          <span className="text-[11px] font-bold text-primary">
            {(t.symbol || t.name || "?").slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm text-foreground truncate">{t.name || "Unknown"}</span>
          <span className="text-[11px] text-muted-foreground/70 font-mono flex-shrink-0">{t.symbol || "?"}</span>
        </div>
        <div className="text-[11px] text-muted-foreground/60 mt-0.5">
          {timeAgo(t.deployDate)}
        </div>
      </div>
      <div className="text-right flex-shrink-0 flex items-center gap-2">
        {t.marketCap > 0 && (
          <span className="text-xs font-semibold text-foreground tabular-nums">{formatUSD(t.marketCap)}</span>
        )}
        <div className="flex items-center gap-1.5">
          <a href={dexscreenerLink(t.address)} target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground/40 hover:text-primary transition-colors" title="DexScreener">
            <BarChart3 className="w-3.5 h-3.5" />
          </a>
          <a href={clankerLink(t.address)} target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground/40 hover:text-primary transition-colors" title="Clanker">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, badge, children }: {
  title: string; icon: any; badge?: string; children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-4 py-3 border-b border-border/40"
                  style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          </div>
          {badge && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 text-primary">
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: tokensData, isLoading: tokensLoading, refetch } = useQuery({
    queryKey: ["/api/conway/tokens", "dashboard", refreshKey],
    queryFn: () => fetch("/api/conway/tokens?limit=20").then(r => r.json()),
    staleTime: 30000,
  });

  const rawTokens: any[] = tokensData?.tokens || [];
  const totalTokens = tokensData?.total || 0;

  const totalMarketCap = rawTokens.reduce((sum: number, t: any) => {
    return sum + (t.related?.market?.marketCap || t.market_cap || 0);
  }, 0);

  const uniqueAdmins = new Set(
    rawTokens.map((t: any) => (t.admin || "").toLowerCase()).filter(Boolean)
  ).size;

  function handleRefresh() {
    setRefreshKey(k => k + 1);
    refetch();
  }

  const sortedByMcap = [...rawTokens].sort(
    (a, b) => (b.related?.market?.marketCap || 0) - (a.related?.market?.marketCap || 0)
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 animate-slide-up">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Oxanium', sans-serif" }}>
                Dashboard
              </h1>
            </div>
            <p className="text-sm text-muted-foreground pl-3">
              Live overview of tokens deployed via ConwayPad on Base
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-1.5 text-xs border-border/60 hover:border-primary/40 hover:text-primary transition-all"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Launched"
            value={tokensLoading ? "—" : formatNumber(totalTokens)}
            subtitle="Via ConwayPad"
            icon={Coins}
            loading={tokensLoading}
            delay={50}
            color="primary"
          />
          <StatCard
            title="Market Cap"
            value={tokensLoading ? "—" : totalMarketCap > 0 ? formatUSD(totalMarketCap) : "—"}
            subtitle="Top 20 tokens"
            icon={DollarSign}
            loading={tokensLoading}
            delay={125}
            color="green"
          />
          <StatCard
            title="Unique Creators"
            value={tokensLoading ? "—" : uniqueAdmins > 0 ? String(uniqueAdmins) : "—"}
            subtitle="Last 20 launches"
            icon={Users}
            loading={tokensLoading}
            delay={200}
            color="amber"
          />
          <StatCard
            title="Creator Fee"
            value="90%"
            subtitle="10% to platform"
            icon={Zap}
            delay={275}
            color="violet"
          />
        </div>

        {/* Token Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Latest Launches" icon={Activity} badge="Live">
            <CardContent className="p-0">
              {tokensLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-3.5 w-28 mb-1.5" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                ))
              ) : rawTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Coins className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No tokens launched yet</p>
                  <p className="text-xs text-muted-foreground/60">Launch your first token via My Launches</p>
                </div>
              ) : (
                rawTokens.slice(0, 10).map((t: any, i) => (
                  <TokenRow key={t.contract_address || t.address} token={t} rank={i + 1} />
                ))
              )}
            </CardContent>
          </SectionCard>

          <SectionCard title="Top by Market Cap" icon={TrendingUp}>
            <CardContent className="p-0">
              {tokensLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-3.5 w-28 mb-1.5" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                ))
              ) : sortedByMcap.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <TrendingUp className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No market data available</p>
                </div>
              ) : (
                sortedByMcap.slice(0, 10).map((t: any, i) => (
                  <TokenRow key={t.contract_address || t.address} token={t} rank={i + 1} />
                ))
              )}
            </CardContent>
          </SectionCard>
        </div>

        {/* About Banner */}
        <div
          className="rounded-xl border border-primary/20 p-4 flex items-start gap-3 animate-slide-up"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.03) 100%)", animationDelay: "350ms" }}
        >
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground mb-0.5">About ConwayPad</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              ConwayPad deploys ERC-20 tokens on Base using{" "}
              <span className="text-foreground/80 font-medium">Clanker SDK v4</span> with automatic, permanently locked liquidity pools.
              Token creators earn{" "}
              <span className="text-primary font-semibold">90% of all LP fees</span> from every trade.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
