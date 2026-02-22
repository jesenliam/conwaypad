import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import https from "node:https";
import { storage } from "./storage";
import { insertChatMessageSchema, insertTrackedWalletSchema, insertTokenLaunchSchema } from "@shared/schema";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http as viemHttp } from "viem";
import { base } from "viem/chains";
import { createPaymentHeader as x402CreatePaymentHeader } from "x402/client";
import { Clanker } from "clanker-sdk/v4";

const CLANKER_API = "https://www.clanker.world/api";
// x402-compatible endpoint: inference.conway.tech (no API key needed, pay per request via USDC)
// api.conway.tech requires prepaid credits — does NOT support x402
const CONWAY_INFERENCE = "https://inference.conway.tech/v1/chat/completions";
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || "";
const CONWAY_WALLET_PRIVATE_KEY = process.env.CONWAY_WALLET_PRIVATE_KEY as `0x${string}` | undefined;

const conwayHttpsAgent = new https.Agent({ rejectUnauthorized: false });

// Derive agent wallet address at startup
let AGENT_WALLET_ADDRESS: `0x${string}` = "0x0000000000000000000000000000000000000000";
if (CONWAY_WALLET_PRIVATE_KEY) {
  try {
    AGENT_WALLET_ADDRESS = privateKeyToAccount(CONWAY_WALLET_PRIVATE_KEY).address;
    console.log("[ConwayPad] Agent wallet:", AGENT_WALLET_ADDRESS);
  } catch (e) {
    console.error("[ConwayPad] Could not derive agent wallet address");
  }
}

function httpsPost(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      agent: conwayHttpsAgent,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode || 200, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function httpsPostStream(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; stream: NodeJS.ReadableStream }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      agent: conwayHttpsAgent,
    }, (res) => {
      resolve({ status: res.statusCode || 200, stream: res });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function proxyGet(url: string): Promise<{ data: any; status: number }> {
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "ConwayPad/1.0" },
    });
    const text = await res.text();
    try {
      return { data: JSON.parse(text), status: res.status };
    } catch {
      return { data: { raw: text }, status: res.status };
    }
  } catch (err: any) {
    return { data: { error: err.message }, status: 500 };
  }
}

function getViemClients() {
  if (!CONWAY_WALLET_PRIVATE_KEY) return null;
  try {
    const account = privateKeyToAccount(CONWAY_WALLET_PRIVATE_KEY);
    const publicClient = createPublicClient({ chain: base, transport: viemHttp() });
    const wallet = createWalletClient({ account, chain: base, transport: viemHttp() });
    return { account, publicClient, wallet };
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are ConwayPad AI, a helpful assistant for the ConwayPad token launch platform on Base blockchain.

ConwayPad uses Clanker infrastructure to deploy ERC-20 tokens on Base with:
- Automatic Uniswap V3 liquidity pools (permanently locked)
- Fee split: 90% of LP fees go to the token creator, 10% to ConwayPad
- Token creator becomes "tokenAdmin" (can manage governance)
- Deployer is the ConwayPad agent wallet (on behalf of creator)

You can help users with:
1. **Deploying tokens** - Parse deploy requests and execute deployments
2. **Checking tokens** - Look up token market caps, prices, trading data
3. **Platform questions** - Explain how ConwayPad/Clanker works
4. **General crypto questions** - Base blockchain, Uniswap, DexScreener, etc.

When a user wants to deploy a token, they should provide:
- Token Name (required)
- Symbol/ticker (required, 2-10 letters)
- Wallet address (required, their 0x address to be set as tokenAdmin)
- Website URL (optional)
- X URL (optional)
- Description (optional)
- Image URL (optional, IPFS or HTTPS)

Always be concise, helpful, and accurate. Format numbers with commas and dollar signs where appropriate.`;

// ─── x402 helpers ─────────────────────────────────────────────────────────────
// Conway uses CAIP-2 network format (eip155:8453), x402 client needs plain names ("base")
const CAIP2_TO_X402_NETWORK: Record<string, string> = {
  "eip155:8453": "base",
  "eip155:84532": "base-sepolia",
  "eip155:137": "polygon",
  "eip155:80002": "polygon-amoy",
  "eip155:43114": "avalanche",
  "eip155:43113": "avalanche-fuji",
};

function normalizePaymentRequirements(req: any): any {
  const network = req.network || "";
  return { ...req, network: CAIP2_TO_X402_NETWORK[network] || network };
}

// ─── Parse structured deploy request ──────────────────────────────────────────
// Handles format: "Deploy token Name X symbol Y website Z x URL wallet 0x..."
interface DeployParams {
  name?: string;
  symbol?: string;
  wallet?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  description?: string;
  imageUrl?: string;
}

function parseDeployMessage(text: string): DeployParams | null {
  const lower = text.toLowerCase();

  // Must look like a deploy request
  if (!lower.includes("deploy") && !lower.includes("launch") && !lower.includes("create token")) {
    return null;
  }

  const params: DeployParams = {};

  // Name
  const nameMatch = text.match(/\bname[:\s]+([^\n,;]+?)(?=\s+(?:symbol|ticker|x\s|twitter|website|wallet|image|description)|$)/i) ||
    text.match(/\btoken\s+(?:name[:\s]+)?([A-Za-z][A-Za-z0-9\s]{1,30}?)(?=\s+(?:symbol|ticker|$))/i);
  if (nameMatch) params.name = nameMatch[1].trim().replace(/\s+/g, " ");

  // Symbol
  const symbolMatch = text.match(/\b(?:symbol|ticker)[:\s]+([A-Za-z]{2,10})/i) ||
    text.match(/\b([A-Z]{2,10})\b(?=\s|$)(?!.*\b(?:symbol|ticker)\b)/);
  if (symbolMatch) params.symbol = symbolMatch[1].trim().toUpperCase();

  // Wallet
  const walletMatch = text.match(/\b(0x[a-fA-F0-9]{40})\b/);
  if (walletMatch) params.wallet = walletMatch[1];

  // Website
  const websiteMatch = text.match(/\bwebsite[:\s]+(\S+)/i) ||
    text.match(/\bweb[:\s]+(\S+)/i);
  if (websiteMatch) {
    let url = websiteMatch[1].trim();
    if (!url.startsWith("http")) url = "https://" + url;
    params.websiteUrl = url;
  }

  // X social link
  const twitterMatch = text.match(/\b(?:twitter|x)[:\s]+(https?:\/\/[^\s]+)/i) ||
    text.match(/\b(?:twitter|x)[:\s]+(@?[^\s\n,;]+)/i);
  if (twitterMatch) {
    let url = twitterMatch[1].trim();
    if (!url.startsWith("http") && url.startsWith("@")) url = "https://x.com/" + url.slice(1);
    else if (!url.startsWith("http")) url = "https://x.com/" + url;
    params.twitterUrl = url;
  }

  // Description
  const descMatch = text.match(/\b(?:description|desc)[:\s]+([^\n]+)/i);
  if (descMatch) params.description = descMatch[1].trim();

  // Image URL
  const imageMatch = text.match(/\bimage[:\s]+(\S+)/i) || text.match(/\bipfs:\/\/\S+/i);
  if (imageMatch) params.imageUrl = imageMatch[1] || imageMatch[0];

  // Only return if we have at least name or symbol
  if (params.name || params.symbol) return params;
  return null;
}

// ─── Deploy token via Clanker SDK ─────────────────────────────────────────────
async function deployTokenViaSDK(params: DeployParams): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const clients = getViemClients();
  if (!clients) {
    return { success: false, error: "Server wallet not configured. Add CONWAY_WALLET_PRIVATE_KEY." };
  }
  if (!params.name || !params.symbol || !params.wallet) {
    return { success: false, error: "Name, symbol, and wallet address are required." };
  }

  try {
    const clanker = new Clanker({ wallet: clients.wallet, publicClient: clients.publicClient });
    const tokenAdmin = params.wallet as `0x${string}`;

    const socialMediaUrls: { platform: string; url: string }[] = [];
    if (params.websiteUrl) socialMediaUrls.push({ platform: "website", url: params.websiteUrl });
    if (params.twitterUrl) socialMediaUrls.push({ platform: "x", url: params.twitterUrl });

    const { txHash, waitForTransaction, error } = await clanker.deploy({
      name: params.name,
      symbol: params.symbol,
      tokenAdmin,
      image: params.imageUrl || "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      metadata: {
        description: params.description || `${params.name} — deployed via ConwayPad`,
        socialMediaUrls,
        auditUrls: [],
      },
      context: {
        interface: "ConwayPad",
        platform: "ConwayPad",
        messageId: "1",
        id: "1",
      },
      rewards: {
        recipients: [
          { admin: tokenAdmin, recipient: tokenAdmin, bps: 9000, token: "Both" as const },
          { admin: AGENT_WALLET_ADDRESS as `0x${string}`, recipient: AGENT_WALLET_ADDRESS as `0x${string}`, bps: 1000, token: "Both" as const },
        ],
      },
    });

    if (error) return { success: false, error: String(error) };

    // Don't wait for full confirmation, return txHash immediately
    waitForTransaction().catch(() => {});
    return { success: true, txHash };
  } catch (err: any) {
    return { success: false, error: err?.message || "Deployment failed" };
  }
}

// ─── Conway x402 Inference ────────────────────────────────────────────────────
// Endpoint: inference.conway.tech (x402 pay-per-request via USDC on Base)
//   → Returns 402 + x402Version:2 + accepts[{scheme,network,maxAmountRequired,payTo,asset}]
//   → Client pays with agent wallet USDC via EIP-3009 (Transfer With Authorization)
//   → Retries with X-PAYMENT header → server streams response
// Cost: ~$0.000028/request (gpt-5-nano), agent wallet 5.85 USDC ≈ 200,000+ requests
// Models: claude-haiku-4.5, claude-sonnet-4.5, gpt-5-mini, gpt-5-nano, gpt-4.1-mini
const CONWAY_MODEL = "gpt-5-mini";

async function callConwayAI(
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
): Promise<void> {
  const clients = getViemClients();
  if (!clients) {
    onError("agent_wallet_missing");
    return;
  }

  const bodyStr = JSON.stringify({
    model: CONWAY_MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 2048,
    stream: true,
  });

  // Parse OpenAI-compatible SSE stream and pipe text chunks to onChunk
  const readSseStream = async (stream: NodeJS.ReadableStream): Promise<void> => {
    let buf = "";
    for await (const raw of stream) {
      buf += raw.toString();
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || "";
          if (delta) onChunk(delta);
        } catch { }
      }
    }
  };

  // Read full body from stream
  const readBody = async (stream: NodeJS.ReadableStream): Promise<string> => {
    let body = "";
    for await (const chunk of stream) body += chunk.toString();
    return body;
  };

  try {
    // ── Step 1: Initial request — server returns 402 with x402 payment requirements ──
    const step1 = await httpsPostStream(CONWAY_INFERENCE, {
      "Content-Type": "application/json",
    }, bodyStr);

    if (step1.status === 200) {
      // Cached or pre-authorized — stream directly
      await readSseStream(step1.stream);
      onDone();
      return;
    }

    if (step1.status !== 402) {
      const body = await readBody(step1.stream);
      console.error("[Conway x402] Unexpected status:", step1.status, body.slice(0, 200));
      onError(`Conway error HTTP ${step1.status}`);
      return;
    }

    // ── Step 2: Parse x402 payment requirements from 402 body ──
    const body402 = await readBody(step1.stream);
    let paymentRequired: any;
    try {
      paymentRequired = JSON.parse(body402);
    } catch {
      console.error("[Conway x402] Could not parse 402 body:", body402.slice(0, 200));
      onError("x402_parse_error");
      return;
    }

    if (!paymentRequired?.accepts?.length) {
      console.error("[Conway x402] No accepts[] in 402 response:", body402.slice(0, 200));
      onError("x402_no_accepts");
      return;
    }

    console.log("[Conway x402] Payment required:", {
      x402Version: paymentRequired.x402Version,
      payTo: paymentRequired.accepts[0]?.payTo,
      maxAmount: paymentRequired.accepts[0]?.maxAmountRequired,
      network: paymentRequired.accepts[0]?.network,
    });

    // ── Step 3: Create X-PAYMENT header using agent wallet ──
    // Normalize CAIP-2 network format (eip155:8453 → base) for x402 client
    const normalizedReq = normalizePaymentRequirements(paymentRequired.accepts[0]);
    let paymentHeader: string;
    try {
      paymentHeader = await x402CreatePaymentHeader(
        clients.wallet as any,
        paymentRequired.x402Version,
        normalizedReq
      );
      console.log("[Conway x402] Payment header created successfully");
    } catch (err: any) {
      console.error("[Conway x402] Failed to create payment header:", err?.message || err);
      onError("x402_sign_error");
      return;
    }

    // ── Step 4: Retry with X-PAYMENT header — server streams response ──
    const step2 = await httpsPostStream(CONWAY_INFERENCE, {
      "Content-Type": "application/json",
      "X-PAYMENT": paymentHeader,
      "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
    }, bodyStr);

    if (step2.status === 200) {
      await readSseStream(step2.stream);
      onDone();
      return;
    }

    const errBody = await readBody(step2.stream);
    let errMsg = `HTTP ${step2.status}`;
    try {
      const j = JSON.parse(errBody);
      errMsg = j.detail || j.error || j.message || errMsg;
    } catch { }
    console.error("[Conway x402] Payment rejected:", step2.status, errMsg);
    onError(`x402_payment_rejected: ${errMsg}`);

  } catch (err: any) {
    console.error("[Conway x402] Network error:", err.message);
    onError(err.message || "Network error");
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ─── Agent Info ───────────────────────────────────────────────────────────
  app.get("/api/agent/info", (_req, res) => {
    res.json({
      agentWallet: AGENT_WALLET_ADDRESS,
      configured: AGENT_WALLET_ADDRESS !== "0x0000000000000000000000000000000000000000",
    });
  });

  // ─── ConwayPad Tokens (only from agent wallet) ────────────────────────────
  app.get("/api/conway/tokens", async (req, res) => {
    const limit = req.query.limit || "20";
    const cursor = req.query.cursor ? `&cursor=${req.query.cursor}` : "";
    const { data, status } = await proxyGet(
      `${CLANKER_API}/search-creator?q=${AGENT_WALLET_ADDRESS}&limit=${limit}${cursor}`
    );
    res.status(status).json(data);
  });

  // Tokens by tokenAdmin (creator) among agent-deployed tokens
  app.get("/api/conway/my-tokens", async (req, res) => {
    const adminWallet = (req.query.wallet as string || "").toLowerCase();
    if (!adminWallet) return res.status(400).json({ error: "wallet query param required" });

    const { data, status } = await proxyGet(
      `${CLANKER_API}/search-creator?q=${AGENT_WALLET_ADDRESS}&limit=100`
    );
    if (status !== 200) return res.status(status).json(data);

    const tokens = (data?.tokens || []).filter((t: any) => {
      const admin = (t.admin || "").toLowerCase();
      return admin === adminWallet;
    });

    res.json({ tokens, total: tokens.length });
  });

  // ─── Clanker search-creator proxy (for Wallet Tracker) ────────────────────
  app.get("/api/clanker/search-creator", async (req, res) => {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const { data, status } = await proxyGet(`${CLANKER_API}/search-creator?${qs}`);
    res.status(status).json(data);
  });

  // ─── Token Deploy (SDK) ───────────────────────────────────────────────────
  app.post("/api/clanker/deploy", async (req, res) => {
    const { name, symbol, tokenAdmin, description, imageUrl, websiteUrl, twitterUrl } = req.body;

    if (!name || !symbol || !tokenAdmin) {
      return res.status(400).json({ error: "name, symbol, and tokenAdmin are required" });
    }

    const result = await deployTokenViaSDK({ name, symbol, wallet: tokenAdmin, description, imageUrl, websiteUrl, twitterUrl });
    if (!result.success) return res.status(500).json({ error: result.error });

    // Save to local cache
    storage.addTokenLaunch({ name, symbol, deployerWallet: tokenAdmin, txHash: result.txHash!, tokenAddress: null }).catch(() => {});
    res.json({ txHash: result.txHash, status: "pending" });
  });

  // ─── AI Chat (streaming SSE) ──────────────────────────────────────────────
  app.post("/api/chat", async (req, res) => {
    const { message, sessionId, userWallet } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ error: "message and sessionId required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendChunk = (content: string) => {
      res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
    };

    const sendDone = () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    };

    try {
      await storage.addChatMessage({ sessionId, role: "user", content: message });

      // ── Check if this is a deploy request ─────────────────────────────────
      const deployParams = parseDeployMessage(message);

      if (deployParams && deployParams.name && deployParams.symbol) {
        const walletToUse = deployParams.wallet || userWallet || "";

        // Missing wallet — ask for it
        if (!walletToUse || !walletToUse.startsWith("0x")) {
          const ask = `Ready to deploy **${deployParams.name}** (${deployParams.symbol})!\n\nI just need one more thing: **your wallet address** (format: 0x...) to set as token admin and receive 90% of LP fees.\n\nExample: \`0x1234...5678\``;
          sendChunk(ask);
          sendDone();
          await storage.addChatMessage({ sessionId, role: "assistant", content: ask });
          return;
        }

        // Show preview first
        const preview = [
          `🚀 **Deploy Token Confirmation**`,
          ``,
          `- **Name:** ${deployParams.name}`,
          `- **Symbol:** ${deployParams.symbol}`,
          `- **Token Admin (Creator):** \`${walletToUse}\``,
          deployParams.websiteUrl ? `- **Website:** ${deployParams.websiteUrl}` : "",
          deployParams.twitterUrl ? `- **X:** ${deployParams.twitterUrl}` : "",
          deployParams.description ? `- **Description:** ${deployParams.description}` : "",
          `- **Fee Split:** 90% you · 10% ConwayPad`,
          `- **Liquidity:** Permanently locked on Uniswap V3`,
          ``,
          `⏳ Processing deployment to Base blockchain...`,
        ].filter(Boolean).join("\n");

        sendChunk(preview);

        // Execute deploy
        const result = await deployTokenViaSDK({
          ...deployParams,
          wallet: walletToUse,
        });

        let finalContent = preview + "\n\n";

        if (result.success) {
          const success = [
            `✅ **Token Successfully Deployed!**`,
            ``,
            `- **TX Hash:** \`${result.txHash}\``,
            `- **Basescan:** https://basescan.org/tx/${result.txHash}`,
            ``,
            `Your token will appear on Clanker and DexScreener once confirmed on-chain. Check it in the "My Launches" tab.`,
          ].join("\n");
          sendChunk("\n\n" + success);
          finalContent += success;

          // Save to local cache
          storage.addTokenLaunch({
            name: deployParams.name!,
            symbol: deployParams.symbol!,
            deployerWallet: walletToUse,
            txHash: result.txHash!,
            tokenAddress: null,
          }).catch(() => {});
        } else {
          const fail = `\n\n❌ **Deployment Failed**\n\nError: ${result.error}\n\nMake sure CONWAY_WALLET_PRIVATE_KEY is configured and the server wallet has ETH for gas.`;
          sendChunk(fail);
          finalContent += fail;
        }

        sendDone();
        await storage.addChatMessage({ sessionId, role: "assistant", content: finalContent });
        return;
      }

      // ── Regular AI chat ───────────────────────────────────────────────────
      const history = await storage.getChatHistory(sessionId);
      const messages = history
        .slice(-18)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      let fullContent = "";

      await callConwayAI(
        messages,
        (chunk) => {
          fullContent += chunk;
          sendChunk(chunk);
        },
        () => {
          sendDone();
        },
        async (errCode) => {
          const fallback = generateFallbackResponse(message, errCode);
          sendChunk(fallback);
          fullContent = fallback;
          sendDone();
          await storage.addChatMessage({ sessionId, role: "assistant", content: fullContent });
          fullContent = "";
        }
      );

      if (fullContent) {
        await storage.addChatMessage({ sessionId, role: "assistant", content: fullContent });
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      const errMsg = `An error occurred: ${err.message || "Unknown error"}`;
      sendChunk(errMsg);
      sendDone();
      await storage.addChatMessage({ sessionId, role: "assistant", content: errMsg }).catch(() => {});
    }
  });

  // ─── Chat History ──────────────────────────────────────────────────────────
  app.get("/api/chat/history/:sessionId", async (req, res) => {
    try {
      const history = await storage.getChatHistory(req.params.sessionId);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/chat/history/:sessionId", async (req, res) => {
    try {
      await storage.clearChatHistory(req.params.sessionId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Tracked Wallets ──────────────────────────────────────────────────────
  app.get("/api/tracked-wallets", async (_req, res) => {
    const wallets = await storage.getTrackedWallets();
    res.json(wallets);
  });

  app.post("/api/tracked-wallets", async (req, res) => {
    const parsed = insertTrackedWalletSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const wallet = await storage.addTrackedWallet(parsed.data);
    res.json(wallet);
  });

  app.delete("/api/tracked-wallets/:id", async (req, res) => {
    await storage.removeTrackedWallet(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── Token Launches (local cache) ─────────────────────────────────────────
  app.get("/api/token-launches", async (_req, res) => {
    const launches = await storage.getTokenLaunches();
    res.json(launches);
  });

  app.post("/api/token-launches", async (req, res) => {
    const parsed = insertTokenLaunchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const launch = await storage.addTokenLaunch(parsed.data);
    res.json(launch);
  });

  return httpServer;
}

// ─── Built-in knowledge base (fallback when Conway x402 API is unavailable) ───
// Covers 50+ crypto/web3 topics so the assistant stays useful offline.
function generateFallbackResponse(message: string, errCode?: string): string {
  const q = message.toLowerCase();
  const has = (...words: string[]) => words.some(w => q.includes(w));

  // ── Greeting ───────────────────────────────────────────────────────────────
  if (has("hello", "hi ", "hey", "how are you", "greetings")) {
    return "Hey! I'm ConwayPad AI — your assistant for launching tokens on Base blockchain.\n\nI can help you:\n- **Deploy a token** on Base (type: *Deploy token Name: ... Symbol: ... Wallet: 0x...*)\n- **Answer questions** about Bitcoin, Ethereum, DeFi, NFTs, and much more\n- **Explain** how ConwayPad and Clanker work\n\nWhat can I help you with?";
  }

  // ── Platform — deploy ──────────────────────────────────────────────────────
  if (has("deploy", "launch", "create token", "mint token")) {
    return [
      "To deploy a token on ConwayPad, use the following format:",
      "",
      "```",
      "Deploy token",
      "Name: TOKEN NAME",
      "Symbol: SYMBOL",
      "Website: https://yourwebsite.com",
      "X: https://x.com/username",
      "Description: Your token description",
      "Wallet: 0x...your_wallet_address",
      "```",
      "",
      "**Required:** Name, Symbol, and Wallet address (0x...).",
      "",
      "**Automatic fee split:**",
      "- 90% of LP fees → to you (creator)",
      "- 10% of LP fees → to ConwayPad",
      "",
      "A Uniswap V3 liquidity pool is created automatically on Base and locked permanently.",
    ].join("\n");
  }

  // ── Platform — fees ────────────────────────────────────────────────────────
  if (has("fee", "split", "earn", "reward")) {
    return "**ConwayPad Fee Split (90% / 10%):**\n\n- **90%** of LP fees from every trade → directly to your wallet (creator)\n- **10%** of LP fees → to ConwayPad platform\n\nUniswap V3 LP fee is **0.3%** per swap. Fees accumulate automatically and can be claimed anytime at [clanker.world](https://clanker.world).";
  }

  // ── Platform — ConwayPad explanation ──────────────────────────────────────
  if (has("conwaypad", "how does", "how it work", "what is conway", "platform")) {
    return [
      "**ConwayPad** is a no-code token launch platform on Base blockchain.",
      "",
      "**How it works:**",
      "1. Submit your token details (name, symbol, wallet, etc.)",
      "2. ConwayPad deploys your ERC-20 token via Clanker SDK v4",
      "3. A Uniswap V3 liquidity pool is created automatically (permanently locked)",
      "4. You receive 90% of all LP fees (0.3% per trade)",
      "",
      "**Key features:**",
      "- No coding required",
      "- Instant liquidity from the moment of deployment",
      "- LP fees flow automatically to your wallet",
      "- Token appears on DexScreener and Clanker.world immediately",
    ].join("\n");
  }

  // ── Platform — Clanker ─────────────────────────────────────────────────────
  if (has("clanker")) {
    return "**Clanker** is an open-source protocol on Base for deploying ERC-20 tokens with automatic Uniswap V3 liquidity pools.\n\nConwayPad uses **Clanker SDK v4** to:\n- Deploy tokens directly from an agent wallet\n- Configure fee splits (90% creator / 10% platform)\n- Lock liquidity permanently\n\nAll deployed tokens can be explored at [clanker.world](https://clanker.world).";
  }

  // ── Platform — Uniswap / liquidity ────────────────────────────────────────
  if (has("uniswap", "liquidity", "pool", "amm", "swap")) {
    return "ConwayPad tokens automatically receive a **Uniswap V3 liquidity pool on Base**.\n\n- **Liquidity is permanently locked** — no one can withdraw it\n- **0.3% fee** on every swap is split: 90% creator + 10% platform\n- **AMM (Automated Market Maker)** prices tokens based on the pool ratio\n- Trade directly on [Uniswap](https://app.uniswap.org) or [DexScreener](https://dexscreener.com/base)";
  }

  // ── Platform — DexScreener ─────────────────────────────────────────────────
  if (has("dexscreener", "dex screener", "chart")) {
    return "**DexScreener** is a real-time analytics platform for DeFi tokens across all chains.\n\nFor tokens deployed on ConwayPad:\n- Check price, volume, and market cap in real time\n- View candlestick charts and transaction history\n- Link format: `https://dexscreener.com/base/[token_address]`\n\nTokens typically appear on DexScreener within a few minutes of deployment.";
  }

  // ── Platform — stats ───────────────────────────────────────────────────────
  if (has("stat", "total token", "how many", "dashboard")) {
    return "View full platform statistics on the ConwayPad **Dashboard**.\n\nReal-time data from the Clanker API:\n- Total tokens deployed\n- Total market cap\n- Trading volume\n- Top deployers on the leaderboard";
  }

  // ── Bitcoin ────────────────────────────────────────────────────────────────
  if (has("bitcoin", "btc", "satoshi nakamoto", "halving")) {
    return [
      "**Bitcoin (BTC)** — the world's first and largest cryptocurrency.",
      "",
      "- **Created:** 2009 by the pseudonymous Satoshi Nakamoto",
      "- **Supply:** Capped at 21 million BTC — deflationary by design",
      "- **Consensus:** Proof of Work (PoW) — miners secure the network",
      "- **Block time:** ~10 minutes per block",
      "- **Halving:** Every ~4 years, miner rewards are cut in half",
      "- **Use case:** Digital gold / store of value, peer-to-peer payments",
      "",
      "**Last halving:** April 2024 (reward dropped to 3.125 BTC/block)",
      "",
      "Bitcoin runs on its own blockchain, separate from Ethereum/Base.",
    ].join("\n");
  }

  // ── Ethereum ───────────────────────────────────────────────────────────────
  if (has("ethereum", "ether ", " eth ", "vitalik", "the merge", "evm")) {
    return [
      "**Ethereum (ETH)** — the largest smart contract blockchain.",
      "",
      "- **Created:** 2015 by Vitalik Buterin and co-founders",
      "- **Consensus:** Proof of Stake (PoS) since The Merge (Sept 2022)",
      "- **Smart contracts:** EVM-compatible, powering DeFi, NFTs, and DAOs",
      "- **Gas fees:** Paid in ETH (Gwei), can be expensive on mainnet",
      "- **L2 ecosystem:** Base, Optimism, Arbitrum, zkSync built on top of Ethereum",
      "",
      "**Base** (where ConwayPad operates) is an Ethereum L2 — Ethereum security with fees under $0.01 per transaction.",
    ].join("\n");
  }

  // ── Solana ─────────────────────────────────────────────────────────────────
  if (has("solana", " sol ")) {
    return "**Solana (SOL)** — a high-speed Layer 1 blockchain.\n\n- **TPS:** Up to 65,000 transactions per second\n- **Cost:** Very low (< $0.001 per transaction)\n- **Consensus:** Proof of History (PoH) + Proof of Stake\n- **Ecosystem:** Raydium, Jupiter, Magic Eden, Phantom Wallet\n\nConwayPad operates on **Base (Ethereum L2)**, not Solana.";
  }

  // ── BNB Chain ──────────────────────────────────────────────────────────────
  if (has("bnb", "binance smart chain", "bsc", "pancakeswap")) {
    return "**BNB Chain (BSC)** — Binance's blockchain.\n\n- **Token:** BNB (Binance Coin)\n- **Consensus:** Proof of Staked Authority (PoSA)\n- **Main DEX:** PancakeSwap\n- **Advantages:** Low fees, large ecosystem\n\nConwayPad operates on **Base**, not BNB Chain.";
  }

  // ── Polygon ────────────────────────────────────────────────────────────────
  if (has("polygon", "matic")) {
    return "**Polygon (POL)** — Ethereum L2 / sidechain.\n\n- **Token:** POL (formerly MATIC)\n- **Consensus:** Proof of Stake\n- **Speed:** ~65,000 TPS\n- **Cost:** Very low fees\n- **Ecosystem:** QuickSwap, OpenSea, many Web3 games\n\nConwayPad operates on **Base**, not Polygon.";
  }

  // ── Base blockchain ────────────────────────────────────────────────────────
  if (has("base ", "base blockchain", "chain id 8453", "layer 2 base", "coinbase l2")) {
    return "**Base** — Coinbase's Ethereum Layer 2.\n\n- **Chain ID:** 8453\n- **Gas fees:** Typically under $0.01 per transaction\n- **Compatibility:** Fully EVM-compatible (Ethereum smart contracts run on Base)\n- **Security:** Secured by Ethereum mainnet\n- **Ecosystem:** Uniswap V3, Aerodrome, Morpho, ConwayPad\n\nConwayPad deploys all tokens on **Base mainnet**.";
  }

  // ── Layer 2 / L2 ──────────────────────────────────────────────────────────
  if (has("layer 2", "l2", "optimism", "arbitrum", "rollup", "zksync")) {
    return [
      "**Layer 2 (L2)** — networks built on top of a Layer 1 blockchain (like Ethereum) for better scalability.",
      "",
      "**Types of L2:**",
      "- **Optimistic Rollups:** Base, Optimism, Arbitrum — fast and cheap",
      "- **ZK Rollups:** zkSync, StarkNet — use zero-knowledge proofs",
      "",
      "**L2 advantages:**",
      "- Gas fees 10x–100x cheaper than Ethereum mainnet",
      "- Higher transaction throughput",
      "- Still inherits Ethereum's security",
      "",
      "ConwayPad operates on **Base** (an Optimistic Rollup by Coinbase).",
    ].join("\n");
  }

  // ── DeFi ───────────────────────────────────────────────────────────────────
  if (has("defi", "decentralized finance")) {
    return "**DeFi (Decentralized Finance)** — financial services without banks or intermediaries.\n\n**Core components:**\n- **DEX** (Uniswap, Aerodrome) — swap tokens without a broker\n- **Lending** (Aave, Compound) — borrow and lend assets\n- **Yield Farming** — earn rewards by providing liquidity\n- **Stablecoins** (USDC, DAI) — tokens pegged to $1 USD\n\nConwayPad tokens automatically enter Base's DeFi ecosystem through Uniswap V3 on deployment.";
  }

  // ── NFT ────────────────────────────────────────────────────────────────────
  if (has("nft", "non-fungible", "non fungible", "opensea", "digital art")) {
    return "**NFT (Non-Fungible Token)** — a unique digital asset on the blockchain.\n\n- **Standard:** ERC-721 (one-of-a-kind) or ERC-1155 (semi-fungible)\n- **Use cases:** Digital art, gaming items, collectibles, event tickets\n- **Marketplaces:** OpenSea, Blur, Magic Eden\n\n**NFT vs Fungible Token:**\n- NFT: Unique, cannot be exchanged 1:1\n- ERC-20 token (like those on ConwayPad): Identical units, divisible\n\nConwayPad focuses on **ERC-20 tokens** (fungible), not NFTs.";
  }

  // ── Wallet ─────────────────────────────────────────────────────────────────
  if (has("wallet", "metamask", "coinbase wallet", "rainbow")) {
    return "**Crypto Wallet** — stores your private keys to access on-chain assets.\n\n**Popular options:**\n- **MetaMask** — browser extension, supports Base/Ethereum\n- **Coinbase Wallet** — mobile + extension, great for Base\n- **Rainbow** — mobile-first, user-friendly\n- **Hardware wallet** (Ledger, Trezor) — most secure for large holdings\n\n**For ConwayPad:**\nWhen deploying a token, provide your wallet address (0x...) as the *token admin* to receive 90% of LP fees.";
  }

  // ── Private key / seed phrase ──────────────────────────────────────────────
  if (has("private key", "seed phrase", "mnemonic", "recovery phrase")) {
    return "**Wallet Security — IMPORTANT:**\n\n**Private Key / Seed Phrase** is your complete access to your wallet.\n\n**NEVER:**\n- Share your private key or seed phrase with anyone\n- Enter it on a website you don't fully trust\n- Store it in the cloud (Google Drive, email, etc.)\n\n**DO:**\n- Write your seed phrase on physical paper\n- Store it in a secure location (safe)\n- Create multiple backups\n\nAnyone with your seed phrase can drain your wallet completely.";
  }

  // ── Gas fees ───────────────────────────────────────────────────────────────
  if (has("gas", "gas fee", "gwei", "transaction fee")) {
    return "**Gas Fee** — the transaction cost paid to blockchain validators.\n\n**Across chains:**\n- **Ethereum mainnet:** Can be $5–$50+ when congested\n- **Base (ConwayPad):** Typically **< $0.01** per transaction\n- **Solana:** < $0.001\n- **Polygon:** < $0.01\n\nGas is measured in **Gwei** (1 Gwei = 0.000000001 ETH).\n\nToken deployments on ConwayPad use gas from the **ConwayPad agent wallet** — you don't need to pay gas directly.";
  }

  // ── Stablecoin ─────────────────────────────────────────────────────────────
  if (has("stablecoin", "usdc", "usdt", "dai", "stable coin")) {
    return "**Stablecoin** — a token pegged to a stable asset (usually $1 USD).\n\n**Main types:**\n- **USDC** (USD Coin) — fiat-backed, issued by Circle, most used in DeFi\n- **USDT** (Tether) — fiat-backed, highest volume\n- **DAI** — algorithmic / overcollateralized by MakerDAO\n\n**On Base:**\nUSDC Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`\n\nStablecoins are commonly used as the paired asset in Uniswap V3 pools.";
  }

  // ── Staking ────────────────────────────────────────────────────────────────
  if (has("staking", "stake", "validator", "proof of stake")) {
    return "**Staking** — locking tokens to secure a PoS network and earn rewards.\n\n**How it works:**\n1. Lock tokens as collateral\n2. Run a validator node or delegate to one\n3. Receive rewards (typically 3–15% APY)\n\n**Examples:**\n- **Ethereum:** Requires 32 ETH to become a validator\n- **Lido (stETH):** Liquid staking — no 32 ETH minimum\n- **Coinbase cbETH:** Liquid ETH staking\n\nConwayPad uses LP fees (not staking) to reward token creators.";
  }

  // ── Memecoins ─────────────────────────────────────────────────────────────
  if (has("memecoin", "meme coin", "doge", "shib", "pepe", "bonk", "wif")) {
    return "**Memecoins** — tokens based on internet memes, driven by community and hype.\n\n**Famous examples:**\n- **DOGE** (Dogecoin) — the original meme coin, backed by Elon Musk\n- **SHIB** (Shiba Inu) — the \"DOGE killer\", large ecosystem\n- **PEPE** — the Pepe the Frog meme token\n- **BONK** — Solana meme coin\n- **WIF** (dogwifhat) — viral Solana meme\n\nConwayPad lets anyone deploy their own token on Base — memecoin, utility token, or project token.";
  }

  // ── Smart contract ─────────────────────────────────────────────────────────
  if (has("smart contract", "solidity")) {
    return "**Smart Contract** — code that runs automatically on the blockchain when conditions are met.\n\n**Characteristics:**\n- **Immutable:** Cannot be changed after deployment (unless upgradeable)\n- **Trustless:** No intermediaries needed\n- **Transparent:** Anyone can read the code on Etherscan/Basescan\n\n**Programming languages:**\n- **Solidity** — the main language for Ethereum/Base\n- **Vyper** — a safer alternative\n\nAll ERC-20 tokens deployed via ConwayPad are smart contracts on Base.";
  }

  // ── ERC-20 ─────────────────────────────────────────────────────────────────
  if (has("erc-20", "erc20", "fungible token")) {
    return "**ERC-20** — the standard for fungible tokens on Ethereum and all EVM-compatible chains.\n\n**Core functions in the contract:**\n- `transfer()` — send tokens\n- `approve()` + `transferFrom()` — allow contracts to move tokens\n- `balanceOf()` — check balance\n- `totalSupply()` — total supply\n\nAll tokens deployed via ConwayPad use the **ERC-20** standard on Base.";
  }

  // ── Web3 ───────────────────────────────────────────────────────────────────
  if (has("web3", "web 3", "blockchain technology")) {
    return "**Web3** — the decentralized generation of the internet built on blockchain.\n\n**Web1 → Web2 → Web3:**\n- Web1: Read-only (1990s)\n- Web2: Read-Write, controlled by corporations (Google, Facebook)\n- Web3: Read-Write-Own, controlled by users via blockchain\n\n**Web3 components:**\n- Crypto wallets (digital identity)\n- Smart contracts (business logic)\n- DeFi (finance)\n- NFTs (digital asset ownership)\n- DAOs (decentralized organizations)";
  }

  // ── DAO ────────────────────────────────────────────────────────────────────
  if (has("dao", "decentralized autonomous", "governance", "voting")) {
    return "**DAO (Decentralized Autonomous Organization)** — an organization run via smart contracts and on-chain voting.\n\n**How it works:**\n1. Token holders have voting rights\n2. Proposals are submitted on-chain\n3. Voting is done with governance tokens\n4. Results are executed automatically by smart contracts\n\n**DAO examples:** Uniswap, Aave, MakerDAO, Compound\n\nTokens deployed via ConwayPad can serve as governance tokens for a DAO.";
  }

  // ── Yield Farming / LP ────────────────────────────────────────────────────
  if (has("yield farm", "yield farming", "provide liquidity", "lp token", "liquidity provider")) {
    return "**Yield Farming / Liquidity Providing** — supplying liquidity to a DEX in exchange for fee rewards.\n\n**How it works:**\n1. Deposit two tokens into a pool (e.g., TOKEN/ETH)\n2. Receive LP tokens as proof of ownership\n3. Collect fees from every swap in that pool\n\n**Risks:**\n- **Impermanent Loss** — if token prices diverge significantly from deposit time\n- **Smart contract risk** — bugs in the LP contract\n\nConwayPad automatically locks liquidity when a token is deployed.";
  }

  // ── Airdrop ────────────────────────────────────────────────────────────────
  if (has("airdrop", "air drop", "free token")) {
    return "**Airdrop** — distributing tokens for free to user wallets.\n\n**Types of airdrops:**\n- **Retroactive:** Rewards for early users (e.g., Uniswap, ENS, Arbitrum)\n- **Task-based:** Complete tasks (follow, retweet, etc.) to earn tokens\n- **Holder airdrop:** Hold a specific token to receive a new one\n\n**Tip:** Always verify airdrops from official sources. Many fake airdrops steal wallet access.\n\nConwayPad token creators can distribute tokens to their community via airdrop.";
  }

  // ── Market cap ─────────────────────────────────────────────────────────────
  if (has("market cap", "marketcap", "mcap", "fully diluted")) {
    return "**Market Cap** — the total market value of a token.\n\n**Formula:**\n```\nMarket Cap = Token Price × Circulating Supply\n```\n\n**FDV (Fully Diluted Valuation):**\n```\nFDV = Token Price × Total Supply (including unvested tokens)\n```\n\n**Categories:**\n- **Large cap:** > $10B (Bitcoin, Ethereum)\n- **Mid cap:** $1B–$10B\n- **Small cap:** < $1B\n- **Micro cap:** < $50M (most meme/new tokens)\n\nConwayPad token market caps are visible on the Dashboard and DexScreener.";
  }

  // ── Volume ─────────────────────────────────────────────────────────────────
  if (has("volume", "trading volume", "volume 24h")) {
    return "**Trading Volume** — the total value of tokens traded over a period.\n\n- **24H Volume** — total transaction value in the last 24 hours\n- High volume = good liquidity, active trader interest\n- Low volume = harder to buy/sell without moving the price\n\n**Relation to LP Fees:**\nHigher 24H volume = more fees collected for the creator (0.3% × volume = daily fee income).\n\nCheck token volume on the ConwayPad Dashboard or DexScreener.";
  }

  // ── DYOR ──────────────────────────────────────────────────────────────────
  if (has("dyor", "do your own research", "research")) {
    return "**DYOR (Do Your Own Research)** — always research thoroughly before investing.\n\n**Checklist for new tokens:**\n- [ ] Check the smart contract on Basescan (is it verified?)\n- [ ] Is liquidity locked? (ConwayPad locks it permanently)\n- [ ] Is the team doxxed or anonymous?\n- [ ] Check holder distribution (whale concentration?)\n- [ ] Is there a security audit?\n- [ ] Is there a whitepaper / roadmap?\n\n**Tools:**\n- Basescan / Etherscan — inspect contracts\n- DexScreener — charts and volume\n- Clanker.world — ConwayPad token info\n\n⚠️ This is not financial advice. Always do your own research before investing.";
  }

  // ── Rug pull / scam ────────────────────────────────────────────────────────
  if (has("rug pull", "rugpull", "scam", "honeypot")) {
    return "**Rug Pull** — a scam where developers suddenly withdraw liquidity after the price pumps.\n\n**Red flags:**\n- Liquidity not locked (can be withdrawn at any time)\n- Anonymous team with no verifiable info\n- No smart contract audit\n- Honeypot: can buy but cannot sell\n- Ownership concentrated in a few wallets\n\n**ConwayPad vs Rug Pulls:**\nConwayPad tokens are **protected from liquidity rug pulls** because:\n- Liquidity is **permanently locked** in Uniswap V3\n- Developers cannot withdraw LP after deployment\n\n⚠️ Always DYOR on all tokens before investing.";
  }

  // ── Cold wallet vs hot wallet ─────────────────────────────────────────────
  if (has("cold wallet", "hardware wallet", "ledger", "trezor", "hot wallet")) {
    return "**Cold Wallet vs Hot Wallet:**\n\n**Hot Wallet** (online)\n- MetaMask, Coinbase Wallet, Rainbow\n- Connected to the internet — convenient but higher risk\n- Best for small amounts and frequent transactions\n\n**Cold Wallet** (offline)\n- Ledger, Trezor, SafePal\n- Private key stored offline — much more secure\n- Best for large long-term holdings\n\n**Recommendation:**\n- Small amounts (daily use): hot wallet\n- Large amounts (> $1,000): cold wallet\n- Never store your seed phrase on a computer or in the cloud";
  }

  // ── FUD / FOMO ────────────────────────────────────────────────────────────
  if (has("fud", "fomo", "fear of missing", "bull run", "bear market")) {
    return "**Crypto Psychology Terms:**\n\n**FUD** (Fear, Uncertainty, Doubt)\n- Negative information that causes panic selling\n- Often spread to manipulate prices\n\n**FOMO** (Fear Of Missing Out)\n- The urge to buy because you fear missing profits\n- Often leads to buying at the peak\n\n**Bull Market** — rising price trend, positive sentiment\n**Bear Market** — falling price trend, negative sentiment\n\nTip: Stay rational. Never make decisions driven by emotion. Always DYOR.";
  }

  // ── WETH ──────────────────────────────────────────────────────────────────
  if (has("weth", "wrapped eth", "wrapped ether")) {
    return "**WETH (Wrapped ETH)** — the ERC-20 version of ETH.\n\n**Why is WETH needed?**\nETH itself is not an ERC-20 token. WETH is a \"wrapper\" that makes ETH compatible with DeFi smart contracts.\n\n**How to swap:**\n- 1 WETH = 1 ETH (always 1:1)\n- Can be swapped on Uniswap at any time\n\nOn Base, many Uniswap V3 pools use WETH as the paired asset for new tokens.";
  }

  // ── Tokenomics ────────────────────────────────────────────────────────────
  if (has("tokenomics", "tokenomic", "supply", "vesting", "allocation")) {
    return "**Tokenomics** — the economic design behind a token.\n\n**Key components:**\n- **Total Supply** — the maximum number of tokens that will ever exist\n- **Circulating Supply** — tokens currently in circulation\n- **Vesting** — token unlock schedule (usually for team/investors)\n- **Allocation** — distribution: team, investors, community, ecosystem\n- **Burn mechanism** — is there a token burning mechanism?\n\n**Good tokenomics examples:**\n- Non-inflationary supply cap\n- Lock-up period for team/investors\n- Fair distribution to the community\n\nConwayPad tokens use the default supply from Clanker SDK v4.";
  }

  // ── Wallet address lookup ──────────────────────────────────────────────────
  if (q.match(/0x[a-f0-9]{40}/i)) {
    const addr = q.match(/0x[a-f0-9]{40}/i)?.[0] || "";
    return `Address ${addr} detected!\n\nTo check activity for this wallet:\n- **Basescan:** https://basescan.org/address/${addr}\n- **DexScreener:** https://dexscreener.com/base/${addr}\n\nYou can also use the **Wallet Tracker** on ConwayPad to view all tokens deployed by this wallet via Clanker.`;
  }

  // ── Price question ─────────────────────────────────────────────────────────
  if (has("price", "how much is", "how much does")) {
    return "I don't have access to real-time price data right now.\n\nTo check current prices:\n- **CoinGecko:** https://coingecko.com\n- **CoinMarketCap:** https://coinmarketcap.com\n- **DexScreener** (for Base tokens): https://dexscreener.com/base\n\nConwayPad token price data is available on the Dashboard and Token Explorer pages.";
  }

  // ── Help ───────────────────────────────────────────────────────────────────
  if (has("help", "command", "what can you")) {
    return [
      "**ConwayPad AI** — here's what I can help with:",
      "",
      "**Deploy a Token:**",
      "- Type: *Deploy token Name: MyToken Symbol: MTK Wallet: 0x...*",
      "",
      "**ConwayPad Platform:**",
      "- How to deploy tokens, fee splits, how Clanker works",
      "- Platform statistics, leaderboard",
      "",
      "**Crypto & Web3:**",
      "- Bitcoin, Ethereum, Solana, Base, Layer 2",
      "- DeFi, NFTs, staking, yield farming",
      "- Wallets, gas fees, stablecoins",
      "- Memecoins, tokenomics, DYOR",
      "- Rug pull detection, crypto security",
      "",
      "Try asking: *\"What is DeFi?\"* · *\"How do I deploy a token?\"* · *\"What is an NFT?\"*",
    ].join("\n");
  }

  // ── Default fallback ──────────────────────────────────────────────────────
  const creditNote = errCode === "agent_wallet_missing"
    ? "\n\n> ⚠️ **Agent wallet not configured.** Set CONWAY_WALLET_PRIVATE_KEY in environment secrets."
    : errCode === "x402_sign_error"
    ? "\n\n> ⚠️ **x402 payment signing failed.** Ensure the agent wallet has USDC on Base."
    : errCode?.startsWith("x402_")
    ? "\n\n> ⚠️ **Conway x402 payment error.** Check the agent wallet's USDC balance on Base."
    : "";

  return [
    "I'm ConwayPad AI — ready to help!",
    "",
    "I can answer questions about:",
    "- **Platform:** deploying tokens, fee splits, how ConwayPad works",
    "- **Blockchain:** Bitcoin, Ethereum, Solana, Base, Layer 2",
    "- **DeFi:** Uniswap, staking, yield farming, liquidity",
    "- **Tokens:** ERC-20, NFTs, memecoins, tokenomics, market cap",
    "- **Security:** wallets, rug pulls, DYOR, cold vs hot wallets",
    "",
    "Try asking something more specific, like:",
    "*\"What is Bitcoin?\"* · *\"How do I deploy a token?\"* · *\"What is DeFi?\"* · *\"What is an NFT?\"*",
  ].join("\n") + creditNote;
}
