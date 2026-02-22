import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Wallet, Coins, TrendingUp, ExternalLink, BarChart3,
} from "lucide-react";
import {
  truncateAddress, formatUSD, timeAgo,
  dexscreenerLink, normalizeToken, clankerLink,
} from "@/lib/conway";

export default function WalletTracker() {
  const [walletInput, setWalletInput] = useState("");
  const [activeWallet, setActiveWallet] = useState("");

  const isValidWallet = activeWallet.startsWith("0x") && activeWallet.length === 42;

  // Fetch tokens where this wallet is the tokenAdmin (creator)
  const { data, isLoading } = useQuery({
    queryKey: ["/api/conway/my-tokens", activeWallet],
    queryFn: () => fetch(`/api/conway/my-tokens?wallet=${activeWallet}`).then(r => r.json()),
    enabled: isValidWallet,
  });

  const rawTokens: any[] = data?.tokens || [];
  const tokens = rawTokens.map(normalizeToken);
  const totalTokens = data?.total || tokens.length;
  const totalMarketCap = tokens.reduce((sum, t) => sum + (t.marketCap || 0), 0);

  function handleSearch() {
    const w = walletInput.trim();
    if (w.startsWith("0x") && w.length === 42) {
      setActiveWallet(w);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wallet Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Look up any creator's tokens launched via ConwayPad</p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 items-center flex-wrap">
              <div className="relative flex-1 min-w-64">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter wallet address (0x...)"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9 font-mono text-sm"
                  data-testid="input-wallet-address"
                />
              </div>
              <Button onClick={handleSearch} data-testid="button-search-wallet">
                <Search className="w-4 h-4 mr-1" /> Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isValidWallet && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Tokens via ConwayPad</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{totalTokens}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Combined Market Cap</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{totalMarketCap > 0 ? formatUSD(totalMarketCap) : "—"}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Wallet</p>
                  <p className="text-sm font-mono text-foreground mt-1">{truncateAddress(activeWallet)}</p>
                  <a href={`https://basescan.org/address/${activeWallet}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                    <ExternalLink className="w-3 h-3" /> Basescan
                  </a>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  Tokens Created via ConwayPad
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="divide-y divide-border/50">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-4">
                        <Skeleton className="w-9 h-9 rounded-md" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : tokens.length === 0 ? (
                  <div className="text-center py-12">
                    <Coins className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No tokens found for this wallet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">This wallet hasn't launched tokens via ConwayPad</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {tokens.map((token) => (
                      <div key={token.address} className="flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors" data-testid={`wallet-token-${token.address}`}>
                        {token.imgUrl ? (
                          <img src={token.imgUrl} alt={token.name} className="w-9 h-9 rounded-md object-cover flex-shrink-0" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{token.symbol.slice(0, 2)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-foreground">{token.name}</span>
                            <span className="text-xs font-mono text-muted-foreground">{token.symbol}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground font-mono">{truncateAddress(token.address)}</span>
                            <span className="text-xs text-muted-foreground">{timeAgo(token.deployDate)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {token.marketCap > 0 && (
                            <div className="text-right mr-1">
                              <p className="text-xs font-medium text-foreground">{formatUSD(token.marketCap)}</p>
                              {token.priceChange24h !== 0 && (
                                <p className={`text-[10px] ${token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}%
                                </p>
                              )}
                            </div>
                          )}
                          <a href={clankerLink(token.address)} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <a href={dexscreenerLink(token.address)} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors">
                            <BarChart3 className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!isValidWallet && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Wallet className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-medium">Enter a wallet address to look up</p>
            <p className="text-sm mt-1 opacity-70">See all ConwayPad tokens created by any wallet</p>
          </div>
        )}
      </div>
    </div>
  );
}
