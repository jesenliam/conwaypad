import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Rocket, ExternalLink, BarChart3, Share2, Wallet, CheckCircle, Loader2, Coins, TrendingUp, Plus, X,
} from "lucide-react";
import {
  getUserWallet, setUserWallet, truncateAddress, formatUSD, timeAgo,
  dexscreenerLink, uniswapLink, clankerLink, normalizeToken,
} from "@/lib/conway";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

function MyTokenCard({ token }: { token: any }) {
  const { toast } = useToast();
  const t = normalizeToken(token);

  const tweetText = `I just launched ${t.name} ($${t.symbol}) via ConwayPad on Base! 🚀 #Base #DeFi #ConwayPad`;
  const shareUrl = clankerLink(t.address);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;

  function handleCopy() {
    navigator.clipboard.writeText(t.address);
    toast({ title: "Copied!", description: "Token address copied to clipboard." });
  }

  return (
    <Card data-testid={`my-token-${t.address}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {t.imgUrl ? (
            <img src={t.imgUrl} alt={t.name} className="w-12 h-12 rounded-md object-cover flex-shrink-0" onError={(e) => { (e.target as any).style.display = 'none'; }} />
          ) : (
            <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {(t.symbol || t.name || "?").slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-semibold text-foreground">{t.name}</h3>
                <span className="font-mono text-sm text-muted-foreground">${t.symbol}</span>
              </div>
              <div className="text-right">
                {t.marketCap > 0 && (
                  <p className="text-sm font-semibold text-foreground">{formatUSD(t.marketCap)}</p>
                )}
                {t.priceChange24h !== 0 && (
                  <p className={`text-xs ${t.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.priceChange24h >= 0 ? '+' : ''}{t.priceChange24h.toFixed(2)}%
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <button
                onClick={handleCopy}
                className="w-full text-left p-2 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors"
                title="Click to copy"
                data-testid={`copy-address-${t.address}`}
              >
                <p className="text-[10px] text-muted-foreground mb-0.5">Contract Address</p>
                <p className="text-xs font-mono text-foreground truncate">{t.address}</p>
              </button>

              <div className="flex items-center justify-between px-0.5">
                <p className="text-xs text-muted-foreground">{timeAgo(t.deployDate)}</p>
                <p className="text-xs text-primary/70">Fee: 90% you · 10% ConwayPad</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <a href={clankerLink(t.address)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5" data-testid={`button-clanker-${t.address}`}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  Clanker
                </Button>
              </a>
              <a href={dexscreenerLink(t.address)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5" data-testid={`button-dex-${t.address}`}>
                  <BarChart3 className="w-3.5 h-3.5" />
                  Chart
                </Button>
              </a>
              <a href={uniswapLink(t.address)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Uniswap
                </Button>
              </a>
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5" data-testid={`button-share-${t.address}`}>
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </Button>
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LaunchForm({ wallet, onSuccess }: { wallet: string; onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", symbol: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const deployMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/clanker/deploy", data),
    onSuccess: (result: any) => {
      toast({
        title: "Token Deployed!",
        description: `${form.name} (${form.symbol}) deployed. TX: ${String(result?.txHash || "").slice(0, 10)}...`,
      });
      setForm({ name: "", symbol: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "" });
      onSuccess();
    },
    onError: (err: any) => {
      toast({
        title: "Deployment Failed",
        description: err?.message || "Could not deploy token.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.symbol.trim()) {
      toast({ title: "Missing Info", description: "Name and symbol are required.", variant: "destructive" });
      return;
    }
    deployMutation.mutate({
      name: form.name.trim(),
      symbol: form.symbol.trim().toUpperCase(),
      tokenAdmin: wallet,
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      websiteUrl: form.websiteUrl.trim() || undefined,
      twitterUrl: form.twitterUrl.trim() || undefined,
    });
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Launch New Token via ConwayPad
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="name" className="text-xs">Token Name *</Label>
              <Input
                id="name"
                placeholder="My Token"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1"
                data-testid="input-token-name"
                required
              />
            </div>
            <div>
              <Label htmlFor="symbol" className="text-xs">Symbol *</Label>
              <Input
                id="symbol"
                placeholder="MTK"
                value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                className="mt-1 uppercase"
                maxLength={10}
                data-testid="input-token-symbol"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your token..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="mt-1 resize-none h-20"
              data-testid="input-token-description"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-primary hover:underline"
          >
            {showAdvanced ? "Hide" : "Show"} advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1">
              <div>
                <Label htmlFor="imageUrl" className="text-xs">Image URL (IPFS or HTTPS)</Label>
                <Input
                  id="imageUrl"
                  placeholder="ipfs://... or https://..."
                  value={form.imageUrl}
                  onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                  className="mt-1"
                  data-testid="input-image-url"
                />
              </div>
              <div>
                <Label htmlFor="websiteUrl" className="text-xs">Website URL</Label>
                <Input
                  id="websiteUrl"
                  placeholder="https://..."
                  value={form.websiteUrl}
                  onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))}
                  className="mt-1"
                  data-testid="input-website-url"
                />
              </div>
              <div>
                <Label htmlFor="twitterUrl" className="text-xs">X URL</Label>
                <Input
                  id="twitterUrl"
                  placeholder="https://x.com/..."
                  value={form.twitterUrl}
                  onChange={e => setForm(f => ({ ...f, twitterUrl: e.target.value }))}
                  className="mt-1"
                  data-testid="input-twitter-url"
                />
              </div>
            </div>
          )}

          <div className="p-3 rounded-md bg-muted/30 text-xs text-muted-foreground space-y-1">
            <p><span className="font-medium">Token Admin:</span> <span className="font-mono">{truncateAddress(wallet)}</span></p>
            <p><span className="font-medium">Fee Split:</span> 90% to you · 10% to ConwayPad</p>
            <p>Liquidity is permanently locked on Uniswap V3 on Base.</p>
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={deployMutation.isPending}
            data-testid="button-deploy-token"
          >
            {deployMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Deploying...</>
            ) : (
              <><Rocket className="w-4 h-4" /> Launch Token</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function MyLaunches() {
  const { toast } = useToast();
  const [wallet, setWalletState] = useState(getUserWallet());
  const [walletInput, setWalletInput] = useState(getUserWallet());
  const [showLaunchForm, setShowLaunchForm] = useState(false);

  const isValidWallet = wallet.startsWith("0x") && wallet.length === 42;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/conway/my-tokens", wallet],
    queryFn: () => fetch(`/api/conway/my-tokens?wallet=${wallet}`).then(r => r.json()),
    enabled: isValidWallet,
  });

  const rawTokens: any[] = data?.tokens || [];
  const tokens = rawTokens.map(normalizeToken);

  function handleSaveWallet() {
    const w = walletInput.trim();
    if (w.startsWith("0x") && w.length === 42) {
      setUserWallet(w);
      setWalletState(w);
      window.dispatchEvent(new Event("walletUpdated"));
      toast({ title: "Wallet saved", description: truncateAddress(w) });
    } else {
      toast({ title: "Invalid address", description: "Please enter a valid 0x wallet address.", variant: "destructive" });
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Launches</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Tokens you launched via ConwayPad</p>
          </div>
          {isValidWallet && (
            <Button
              onClick={() => setShowLaunchForm(!showLaunchForm)}
              className="gap-2"
              data-testid="button-new-launch"
            >
              {showLaunchForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showLaunchForm ? "Cancel" : "New Launch"}
            </Button>
          )}
        </div>

        {/* Wallet Setup */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 items-center flex-wrap">
              <div className="relative flex-1 min-w-64">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Your wallet address (0x...)"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveWallet()}
                  className="pl-9 font-mono text-sm"
                  data-testid="input-my-wallet"
                />
              </div>
              <Button onClick={handleSaveWallet} variant="outline" data-testid="button-save-wallet">
                {isValidWallet ? <CheckCircle className="w-4 h-4 mr-1 text-green-400" /> : null}
                Save Wallet
              </Button>
            </div>
            {isValidWallet && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing tokens launched by <span className="font-mono">{truncateAddress(wallet)}</span> via ConwayPad
              </p>
            )}
          </CardContent>
        </Card>

        {/* Launch Form */}
        {showLaunchForm && isValidWallet && (
          <LaunchForm wallet={wallet} onSuccess={() => { setShowLaunchForm(false); setTimeout(() => refetch(), 5000); }} />
        )}

        {/* Token List */}
        {isValidWallet ? (
          <>
            {!showLaunchForm && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {isLoading ? "Loading..." : `${tokens.length} token${tokens.length !== 1 ? "s" : ""} launched`}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setShowLaunchForm(true)} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Launch New
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Skeleton className="w-12 h-12 rounded-md" />
                        <div className="flex-1">
                          <Skeleton className="h-5 w-32 mb-2" />
                          <Skeleton className="h-3 w-48 mb-1" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : tokens.length === 0 && !showLaunchForm ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Coins className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="font-medium text-muted-foreground">No tokens found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  You haven't launched any tokens via ConwayPad yet
                </p>
                <Button className="mt-4 gap-2" onClick={() => setShowLaunchForm(true)} data-testid="button-first-launch">
                  <Rocket className="w-4 h-4" /> Launch Your First Token
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {tokens.map((token) => (
                  <MyTokenCard key={token.address} token={token} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Wallet className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-medium">Set your wallet to get started</p>
            <p className="text-sm mt-1 opacity-70">Enter your wallet address above to view and manage your launches</p>
          </div>
        )}
      </div>
    </div>
  );
}
