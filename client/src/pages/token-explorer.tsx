import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Coins, Search, ExternalLink, X, ChevronLeft, ChevronRight, TrendingUp, DollarSign, BarChart3,
} from "lucide-react";
import {
  truncateAddress, formatUSD, timeAgo,
  basescanToken, dexscreenerLink, uniswapLink, normalizeToken, clankerLink,
} from "@/lib/conway";

function TokenDetailPanel({ token, onClose }: { token: any; onClose: () => void }) {
  const t = normalizeToken(token);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
          <div className="flex items-center gap-3">
            {t.imgUrl ? (
              <img src={t.imgUrl} alt={t.name} className="w-10 h-10 rounded-md object-cover" onError={(e) => { (e.target as any).style.display = 'none'; }} />
            ) : (
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{t.symbol.slice(0, 2)}</span>
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{t.name || "Unknown Token"}</CardTitle>
              <span className="font-mono text-sm text-muted-foreground">{t.symbol}</span>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-detail">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {t.address && (
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Contract Address</p>
              <p className="text-xs font-mono text-foreground break-all">{t.address}</p>
            </div>
          )}

          {(t.marketCap > 0 || t.price > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {t.marketCap > 0 && (
                <div className="p-3 rounded-md bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Market Cap</p>
                  <p className="text-sm font-semibold text-foreground">{formatUSD(t.marketCap)}</p>
                </div>
              )}
              {t.price > 0 && (
                <div className="p-3 rounded-md bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Price</p>
                  <p className="text-sm font-semibold text-foreground">${t.price.toFixed(8)}</p>
                </div>
              )}
              {t.priceChange24h !== 0 && (
                <div className="p-3 rounded-md bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">24h Change</p>
                  <p className={`text-sm font-semibold ${t.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.priceChange24h >= 0 ? '+' : ''}{t.priceChange24h.toFixed(2)}%
                  </p>
                </div>
              )}
              {t.volume24h > 0 && (
                <div className="p-3 rounded-md bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">24h Volume</p>
                  <p className="text-sm font-semibold text-foreground">{formatUSD(t.volume24h)}</p>
                </div>
              )}
            </div>
          )}

          {/* Token Admin (creator) */}
          {(token.admin || token.tokenAdmin) && (
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Token Admin (Creator)</p>
              <p className="text-xs font-mono text-foreground break-all">{token.admin || token.tokenAdmin}</p>
            </div>
          )}

          {t.deployDate && (
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Deployed</p>
              <p className="text-sm text-foreground">{new Date(t.deployDate).toLocaleString()} ({timeAgo(t.deployDate)})</p>
            </div>
          )}

          <div className="p-3 rounded-md bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground mb-1">Fee Distribution</p>
            <p className="text-xs text-foreground">90% creator · 10% ConwayPad</p>
          </div>

          {t.address && (
            <div className="flex flex-wrap gap-2">
              <a href={clankerLink(t.address)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Clanker
                </Button>
              </a>
              <a href={dexscreenerLink(t.address)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  DexScreener
                </Button>
              </a>
              <a href={basescanToken(t.address)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Basescan
                </Button>
              </a>
              <a href={uniswapLink(t.address)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Uniswap
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TokenExplorer() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedToken, setSelectedToken] = useState<any | null>(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/conway/tokens", page],
    queryFn: () => {
      const cursor = page > 1 ? `&cursor=${(page - 1) * limit}` : "";
      return fetch(`/api/conway/tokens?limit=${limit}${cursor}`).then(r => r.json());
    },
    staleTime: 30000,
  });

  const rawTokens: any[] = data?.tokens || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Client-side search filter
  const filtered = search.trim()
    ? rawTokens.filter(t =>
        (t.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.symbol || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.contract_address || "").toLowerCase().includes(search.toLowerCase())
      )
    : rawTokens;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Token Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All tokens deployed via ConwayPad on Base
            {total > 0 && <span className="ml-1">({total.toLocaleString()} total)</span>}
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter by name, symbol, or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-token"
              />
            </div>
          </CardContent>
        </Card>

        {/* Token List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border/50">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <Skeleton className="w-9 h-9 rounded-md flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1.5" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Coins className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {search ? "No tokens match your search" : "No tokens deployed yet"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {search ? "Try a different keyword" : "Launch your first token via My Launches"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filtered.map((token: any) => {
                  const t = normalizeToken(token);
                  return (
                    <button
                      key={t.address}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedToken(token)}
                      data-testid={`token-row-${t.address}`}
                    >
                      {t.imgUrl ? (
                        <img src={t.imgUrl} alt={t.name} className="w-9 h-9 rounded-md object-cover flex-shrink-0" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">{t.symbol.slice(0, 2)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{t.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">{t.symbol}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">{truncateAddress(t.address)}</span>
                          <span className="text-xs text-muted-foreground">{timeAgo(t.deployDate)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {t.marketCap > 0 ? (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">{formatUSD(t.marketCap)}</span>
                          </div>
                        ) : null}
                        {t.priceChange24h !== 0 && (
                          <span className={`text-xs ${t.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {t.priceChange24h >= 0 ? '+' : ''}{t.priceChange24h.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page">
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="button-next-page">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedToken && (
        <TokenDetailPanel token={selectedToken} onClose={() => setSelectedToken(null)} />
      )}
    </div>
  );
}
