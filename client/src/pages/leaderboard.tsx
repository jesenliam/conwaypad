import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Rocket, TrendingUp, ExternalLink } from "lucide-react";
import { truncateAddress, formatUSD, formatNumber } from "@/lib/conway";

function MedalBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
         style={{ background: "linear-gradient(135deg, #ffd700, #f59e0b)", color: "#7c2d12", boxShadow: "0 0 10px rgba(251,191,36,0.4)" }}>
      1
    </div>
  );
  if (rank === 2) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
         style={{ background: "linear-gradient(135deg, #e5e7eb, #9ca3af)", color: "#1f2937", boxShadow: "0 0 8px rgba(156,163,175,0.3)" }}>
      2
    </div>
  );
  if (rank === 3) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
         style={{ background: "linear-gradient(135deg, #cd7c2f, #92400e)", color: "#fff7ed", boxShadow: "0 0 8px rgba(180,83,9,0.3)" }}>
      3
    </div>
  );
  return (
    <div className="w-7 h-7 rounded-full bg-muted/60 border border-border/40 flex items-center justify-center">
      <span className="text-xs font-semibold text-muted-foreground">{rank}</span>
    </div>
  );
}

export default function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/conway/tokens", "leaderboard"],
    queryFn: () => fetch("/api/conway/tokens?limit=100").then(r => r.json()),
    staleTime: 60000,
  });

  const rawTokens: any[] = data?.tokens || [];

  const leaderboard = useMemo(() => {
    const creators: Record<string, { wallet: string; launches: number; totalMarketCap: number }> = {};
    for (const t of rawTokens) {
      const wallet = (t.admin || t.tokenAdmin || "").toLowerCase();
      if (!wallet || wallet === "0x0000000000000000000000000000000000000000") continue;
      if (!creators[wallet]) {
        creators[wallet] = { wallet: t.admin || t.tokenAdmin || wallet, launches: 0, totalMarketCap: 0 };
      }
      creators[wallet].launches++;
      const mc = t.related?.market?.marketCap || t.market_cap || 0;
      creators[wallet].totalMarketCap += mc;
    }
    return Object.values(creators)
      .sort((a, b) => b.launches - a.launches || b.totalMarketCap - a.totalMarketCap)
      .slice(0, 50);
  }, [rawTokens]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {/* Page Header */}
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 rounded-full bg-primary" />
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Oxanium', sans-serif" }}>
              Creator Leaderboard
            </h1>
          </div>
          <p className="text-sm text-muted-foreground pl-3">
            Top creators ranked by tokens launched via ConwayPad
          </p>
        </div>

        {/* Table */}
        <Card className="overflow-hidden animate-slide-up" style={{ animationDelay: "50ms" }}>
          <CardHeader className="px-4 py-3 border-b border-border/40"
                      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Trophy className="w-3.5 h-3.5 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">Top Creators</CardTitle>
              </div>
              {leaderboard.length > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-border/40 text-muted-foreground">
                  {leaderboard.length} creators
                </Badge>
              )}
            </div>
          </CardHeader>

          {/* Column headers */}
          {!isLoading && leaderboard.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-2 border-b border-border/40 bg-muted/20">
              <div className="w-7 flex-shrink-0" />
              <p className="flex-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Creator</p>
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest w-20 text-right">Tokens</p>
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest w-24 text-right hidden sm:block">Market Cap</p>
              <div className="w-4" />
            </div>
          )}

          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border/40">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                    <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-3.5 w-36 mb-1.5" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
                  <Trophy className="w-7 h-7 text-muted-foreground/30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">No creators yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Be the first to launch a token via ConwayPad</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {leaderboard.map((creator, idx) => (
                  <div
                    key={creator.wallet}
                    className="flex items-center gap-4 px-4 py-3.5 table-row-hover"
                    data-testid={`leaderboard-row-${idx}`}
                    style={idx < 3 ? {
                      background: idx === 0
                        ? "linear-gradient(90deg, rgba(251,191,36,0.04) 0%, transparent 60%)"
                        : idx === 1
                        ? "linear-gradient(90deg, rgba(156,163,175,0.04) 0%, transparent 60%)"
                        : "linear-gradient(90deg, rgba(180,83,9,0.04) 0%, transparent 60%)",
                    } : {}}
                  >
                    <div className="flex-shrink-0">
                      <MedalBadge rank={idx + 1} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-medium text-foreground truncate">
                        {truncateAddress(creator.wallet)}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                          <Rocket className="w-2.5 h-2.5" />
                          {creator.launches} token{creator.launches !== 1 ? "s" : ""}
                        </span>
                        {creator.totalMarketCap > 0 && (
                          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1 sm:hidden">
                            <TrendingUp className="w-2.5 h-2.5" />
                            {formatUSD(creator.totalMarketCap)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-20 text-right flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatNumber(creator.launches)}</p>
                    </div>
                    <div className="w-24 text-right flex-shrink-0 hidden sm:block">
                      <p className="text-sm font-semibold text-foreground">
                        {creator.totalMarketCap > 0 ? formatUSD(creator.totalMarketCap) : "—"}
                      </p>
                    </div>
                    <a
                      href={`https://basescan.org/address/${creator.wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground/30 hover:text-primary transition-colors flex-shrink-0"
                      data-testid={`link-basescan-${idx}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground/50 text-center">
          Ranked by tokens launched · Fee split: 90% creator · 10% ConwayPad · Clanker SDK v4
        </p>
      </div>
    </div>
  );
}
