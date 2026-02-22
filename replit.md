# ConwayPad — AI-Powered Token Launch Platform

An AI-powered token launch platform using Clanker infrastructure on Base blockchain. Features live platform statistics, token exploration, deployer leaderboard, AI chat assistant with structured token deployment, wallet tracking, and personal launch management.

## Architecture

**Frontend:** React + Vite + TailwindCSS + shadcn/ui + TanStack Query + Oxanium font (branding)
**Backend:** Node.js + Express + TypeScript
**Database:** PostgreSQL (Drizzle ORM)
**AI:** Conway x402 Inference API (gpt-5-mini, pay-per-request via USDC on Base) with 50+ topic fallback
**Blockchain:** Base Mainnet (chain ID 8453)
**Deployment SDK:** clanker-sdk v4 (independent deployment via viem wallet client)

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Live stats, latest tokens, top market caps — staggered animated cards |
| Token Explorer | `/tokens` | Paginated Clanker token list with search & filter |
| Leaderboard | `/leaderboard` | Top deployers by number of launches |
| AI Assistant | `/chat` | Conway AI-powered chat with token actions + rich fallback knowledge |
| Wallet Tracker | `/wallet` | Analyze any deployer wallet on Clanker |
| My Launches | `/my-launches` | User's own tokens + launch new tokens |

## Branding & Design

- **Color:** Purple/violet accent (`#8B5CF6`) — dark theme
- **Font:** Oxanium (branding headings), system font (body)
- **Logo:** Custom neon purple rocket (`client/src/assets/conwaypad-logo.png`)
- **Favicon:** `client/public/favicon.png`
- **Animations:** `animate-fade-in`, `animate-slide-up`, `animate-float`, `animate-pulse-glow`, `text-shimmer`, `glow-border`, `glow-border-hover`, `glass-card` — defined in `index.css`
- **Logo import:** Use relative path `../assets/conwaypad-logo.png` from components (NOT `@assets/` — that alias maps to `attached_assets/` which doesn't exist)

## Backend API Routes

- `GET /api/conway/tokens` — Token list from Clanker API (agent wallet, chainId=8453, includeMarket=true)
- `GET /api/conway/search-creator` — Tokens by deployer wallet
- `POST /api/conway/deploy` — Deploy token via Clanker SDK v4
- `POST /api/chat` — AI chat (SSE streaming) with Conway AI + fallback responses
- `GET /api/chat/history/:sessionId` — Chat history
- `DELETE /api/chat/history/:sessionId` — Clear chat history
- `GET /api/tracked-wallets` — List tracked wallets
- `POST /api/tracked-wallets` — Add tracked wallet
- `DELETE /api/tracked-wallets/:id` — Remove tracked wallet
- `GET /api/token-launches` — Local launch cache
- `POST /api/token-launches` — Add to local launch cache

## AI Chat Flow — x402 Pay-Per-Request

Conway x402 endpoint: `https://inference.conway.tech/v1/chat/completions`
- Model: `gpt-5-mini` (quality/cost balance)
- x402 Version: 2 — `scheme: exact`, `network: eip155:8453` (Base)
- Pay-per-request using USDC from agent wallet via EIP-3009 Transfer With Authorization
- Agent wallet: `0x9b13c1b7696E94123ec28033004235d1b7303BeA` (5.85 USDC on Base = ~200k+ requests)
- Conway payTo address: `0x21DD37E3E4eA6CCC0a5C98A4944702eDE6E7Be10`
- USDC contract on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Cost: ~48 USDC atomic ($0.000048) per request for gpt-5-mini

**x402 Flow (3 steps):**
1. POST to `inference.conway.tech` → server returns 402 + `x402Version` + `accepts[]`
2. `createPaymentHeader(walletClient, x402Version, normalizedPaymentReqs)` → signed X-PAYMENT
3. Retry POST with `X-PAYMENT` header → server streams OpenAI-SSE response

**Note:** `api.conway.tech` (OLD) requires prepaid credits, does NOT support x402.
**Fallback:** 50+ topic crypto/web3 knowledge base if x402 fails (no USDC, network error, etc.)

## Token Deployment (Clanker SDK v4)

```typescript
clanker.deploy({
  name, symbol, tokenAdmin,  // Required
  image,                     // IPFS or HTTPS image URL
  metadata: { description, socialMediaUrls, auditUrls },
  context: { interface: "ConwayPad", platform: "", messageId: "", id: "" }
})
// Returns: { txHash, waitForTransaction, error }
// Fee split: 90% creator / 10% platform
```

## Clanker Token Structure

Clanker API returns tokens with:
- `contract_address` → mapped to `address`
- `msg_sender` → mapped to `deployerWallet`
- `deployed_at` → mapped to `deployDate`
- `chain_id` → 8453 for Base
- `related.market.marketCap`, `priceChangePercent24h`, `volume24h` → market data
- `img_url`, `name`, `symbol`, `description`, `metadata`, `extensions`

All normalization is done via `normalizeToken()` in `client/src/lib/conway.ts`.

## Database Schema

- `chat_messages` — Chat history per session
- `tracked_wallets` — Saved wallets (label, address)
- `token_launches` — Local cache of deployed tokens

## Environment Variables

| Key | Purpose |
|-----|---------|
| `DATABASE_URL` | PostgreSQL connection (auto-provided) |
| `CONWAY_WALLET_PRIVATE_KEY` | Server wallet for Clanker SDK deployment |
| `SESSION_SECRET` | Express session secret |
| `CONWAY_API_KEY` | Conway AI inference API key |

## Key Libraries

- `clanker-sdk/v4` — Token deployment (Clanker v4 factory)
- `viem` + `viem/accounts` — Wallet client, EVM interaction
- `@tanstack/react-query` — Frontend data fetching
- `wouter` — Client-side routing
- `drizzle-orm` + `drizzle-zod` — Database ORM + validation
