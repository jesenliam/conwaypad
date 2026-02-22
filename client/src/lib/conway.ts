export function truncateAddress(addr: string, start = 6, end = 4): string {
  if (!addr || addr.length < start + end + 2) return addr || "";
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

export function formatUSD(val: number | string | undefined): string {
  const n = parseFloat(String(val || 0));
  if (isNaN(n)) return "$0.00";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatNumber(val: number | string | undefined): string {
  const n = parseFloat(String(val || 0));
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function formatETH(val: number | string | undefined): string {
  const n = parseFloat(String(val || 0));
  if (isNaN(n)) return "0 WETH";
  return `${n.toFixed(6)} WETH`;
}

export function timeAgo(date: string | Date | undefined): string {
  if (!date) return "unknown";
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function basescanToken(addr: string) {
  return `https://basescan.org/token/${addr}`;
}

export function basescanTx(hash: string) {
  return `https://basescan.org/tx/${hash}`;
}

export function dexscreenerLink(addr: string) {
  return `https://dexscreener.com/base/${addr}`;
}

export function uniswapLink(addr: string) {
  return `https://app.uniswap.org/explore/tokens/base/${addr}`;
}

export function clankerLink(addr: string) {
  return `https://clanker.world/clanker/${addr}`;
}

// Normalize token from Clanker API to a consistent shape
export function normalizeToken(t: any): any {
  const market = t.related?.market || {};
  return {
    ...t,
    address: t.contract_address || t.address || "",
    name: t.name || "Unknown",
    symbol: t.symbol || "?",
    deployDate: t.deployed_at || t.created_at || t.deployDate || "",
    deployerWallet: t.msg_sender || t.deployer || t.deployerWallet || "",
    imgUrl: t.img_url || t.image || "",
    marketCap: market.marketCap || t.market_cap || 0,
    price: market.price || t.price || 0,
    priceChange24h: market.priceChange24h || 0,
    volume24h: market.volume24h || 0,
    chainId: t.chain_id || 8453,
    platform: t.social_context?.platform || "",
  };
}

export function getStatusBg(status: string): string {
  switch (status?.toLowerCase()) {
    case "active": return "bg-green-500/15 text-green-400 border-green-500/20";
    case "inactive": return "bg-red-500/15 text-red-400 border-red-500/20";
    case "pending": return "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
    default: return "bg-muted text-muted-foreground";
  }
}

export const SESSION_ID_KEY = "clankerpad_session_id";
export const WALLET_KEY = "clankerpad_wallet";

export function getOrCreateSessionId(): string {
  localStorage.removeItem(SESSION_ID_KEY);
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function getUserWallet(): string {
  return localStorage.getItem(WALLET_KEY) || "";
}

export function setUserWallet(wallet: string): void {
  localStorage.setItem(WALLET_KEY, wallet);
}
