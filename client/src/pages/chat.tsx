import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bot, Send, Trash2, User, Wallet, CheckCircle, Loader2, Rocket,
  Coins, BarChart3, TrendingUp, HelpCircle, X, ChevronDown,
} from "lucide-react";
import {
  getOrCreateSessionId, getUserWallet, setUserWallet, truncateAddress,
} from "@/lib/conway";
import { queryClient } from "@/lib/queryClient";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  const formatInline = (text: string, key: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let partKey = 0;
    while (remaining.length > 0) {
      const codeMatch = remaining.match(/^([\s\S]*?)`([^`]+)`([\s\S]*)/);
      if (codeMatch) {
        if (codeMatch[1]) parts.push(<span key={partKey++}>{codeMatch[1]}</span>);
        parts.push(<code key={partKey++} className="text-xs bg-muted/60 px-1 py-0.5 rounded font-mono break-all">{codeMatch[2]}</code>);
        remaining = codeMatch[3];
        continue;
      }
      const boldMatch = remaining.match(/^([\s\S]*?)\*\*([^*]+)\*\*([\s\S]*)/);
      if (boldMatch) {
        if (boldMatch[1]) parts.push(<span key={partKey++}>{boldMatch[1]}</span>);
        parts.push(<strong key={partKey++} className="font-semibold">{boldMatch[2]}</strong>);
        remaining = boldMatch[3];
        continue;
      }
      const linkMatch = remaining.match(/^([\s\S]*?)(https?:\/\/[^\s]+)([\s\S]*)/);
      if (linkMatch) {
        if (linkMatch[1]) parts.push(<span key={partKey++}>{linkMatch[1]}</span>);
        parts.push(
          <a key={partKey++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
            className="text-primary hover:underline break-all text-xs">{linkMatch[2]}</a>
        );
        remaining = linkMatch[3];
        continue;
      }
      parts.push(<span key={partKey++}>{remaining}</span>);
      break;
    }
    return <span key={key}>{parts}</span>;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-bold text-sm mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="font-bold text-base mt-3 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="font-bold text-lg mt-3 mb-1">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(<li key={i} className="text-sm">{formatInline(lines[i].slice(2), String(i))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-1 pl-1">{items}</ul>);
      continue;
    } else if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-muted/70 rounded-md p-3 text-xs font-mono overflow-x-auto my-2 whitespace-pre-wrap">
          {codeLines.join("\n")}
        </pre>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="border-border my-2" />);
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed">{formatInline(line, String(i))}</p>);
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

const QUICK_PROMPTS = [
  { label: "How to Deploy", prompt: "How do I deploy a token on ConwayPad?", icon: HelpCircle },
  { label: "Fee Split", prompt: "Explain the 90/10 fee split system on ConwayPad", icon: BarChart3 },
  { label: "Platform Stats", prompt: "How many tokens have been deployed via ConwayPad?", icon: TrendingUp },
  { label: "Latest Tokens", prompt: "Show the latest tokens deployed on ConwayPad", icon: Coins },
];

const DEPLOY_TEMPLATE = `Deploy token
Name: TOKEN_NAME
Symbol: SYMBOL
Website: https://website.com
X: https://x.com/username
Wallet: 0xYOUR_WALLET`;

interface DeployFormData {
  name: string;
  symbol: string;
  wallet: string;
  website: string;
  twitter: string;
  description: string;
}

function DeployPanel({ onSend, userWallet }: { onSend: (msg: string) => void; userWallet: string }) {
  const [form, setForm] = useState<DeployFormData>({
    name: "",
    symbol: "",
    wallet: userWallet,
    website: "",
    twitter: "",
    description: "",
  });

  function buildMessage() {
    const lines = [`Deploy token`];
    if (form.name) lines.push(`Name: ${form.name}`);
    if (form.symbol) lines.push(`Symbol: ${form.symbol.toUpperCase()}`);
    if (form.website) lines.push(`Website: ${form.website}`);
    if (form.twitter) lines.push(`X: ${form.twitter}`);
    if (form.description) lines.push(`Description: ${form.description}`);
    if (form.wallet) lines.push(`Wallet: ${form.wallet}`);
    return lines.join("\n");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.symbol || !form.wallet) return;
    onSend(buildMessage());
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Rocket className="w-4 h-4 text-primary" />
          Form Deploy Token
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Token Name *</Label>
              <Input
                placeholder="e.g. CLAUDE"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-0.5 h-8 text-sm"
                data-testid="deploy-form-name"
                required
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Symbol *</Label>
              <Input
                placeholder="e.g. CLA"
                value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                className="mt-0.5 h-8 text-sm uppercase"
                maxLength={10}
                data-testid="deploy-form-symbol"
                required
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Wallet Address (Token Admin) *</Label>
            <Input
              placeholder="0x..."
              value={form.wallet}
              onChange={e => setForm(f => ({ ...f, wallet: e.target.value }))}
              className="mt-0.5 h-8 text-xs font-mono"
              data-testid="deploy-form-wallet"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Website</Label>
              <Input
                placeholder="claude.com"
                value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                className="mt-0.5 h-8 text-sm"
                data-testid="deploy-form-website"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">X</Label>
              <Input
                placeholder="https://x.com/..."
                value={form.twitter}
                onChange={e => setForm(f => ({ ...f, twitter: e.target.value }))}
                className="mt-0.5 h-8 text-sm"
                data-testid="deploy-form-twitter"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
              Fee: <span className="text-primary font-medium">90%</span> you · 10% ConwayPad
            </div>
            <Button type="submit" size="sm" className="gap-1.5 h-8 px-3" disabled={!form.name || !form.symbol || !form.wallet}>
              <Rocket className="w-3.5 h-3.5" />
              Deploy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
        isUser ? "bg-primary text-primary-foreground" : "bg-muted border border-border"
      }`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
      </div>
      <div className={`flex-1 max-w-[82%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border/60 text-foreground rounded-tl-sm"
        }`}>
          {message.streaming && !message.content ? (
            <div className="flex gap-1 items-center h-4">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : (
            <SimpleMarkdown content={message.content + (message.streaming ? "▋" : "")} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const sessionId = getOrCreateSessionId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [wallet, setWallet] = useState(getUserWallet());
  const [editingWallet, setEditingWallet] = useState(false);
  const [walletInput, setWalletInput] = useState("");
  const [showDeployPanel, setShowDeployPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["/api/chat/history", sessionId],
    queryFn: () => fetch(`/api/chat/history/${sessionId}`).then(r => r.json()),
  });

  useEffect(() => {
    if (history && Array.isArray(history) && messages.length === 0) {
      setMessages(history.map((m: any) => ({ role: m.role, content: m.content })));
    }
  }, [history]);

  useEffect(() => {
    const handleUnload = () => {
      fetch(`/api/chat/history/${sessionId}`, { method: "DELETE", keepalive: true }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setMessages(prev => [
      ...prev,
      { role: "user", content: text.trim() },
      { role: "assistant", content: "", streaming: true },
    ]);
    setInput("");
    setShowDeployPanel(false);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          sessionId,
          userWallet: getUserWallet(),
        }),
      });

      if (!res.ok && res.status !== 200) {
        throw new Error(`Server error ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data);
            if (parsed.done) continue;
            if (parsed.content) {
              fullContent += parsed.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullContent, streaming: true };
                return updated;
              });
            }
          } catch { }
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: fullContent || "No response received.", streaming: false };
        return updated;
      });

      queryClient.invalidateQueries({ queryKey: ["/api/chat/history", sessionId] });
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Error: ${err.message || "Failed to get response"}. Please try again.`,
          streaming: false,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, sessionId]);

  async function clearHistory() {
    await fetch(`/api/chat/history/${sessionId}`, { method: "DELETE" });
    setMessages([]);
    queryClient.invalidateQueries({ queryKey: ["/api/chat/history", sessionId] });
  }

  function saveWallet() {
    const w = walletInput.trim();
    if (w.startsWith("0x") && w.length === 42) {
      setUserWallet(w);
      setWallet(w);
      window.dispatchEvent(new Event("walletUpdated"));
      setEditingWallet(false);
      setWalletInput("");
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">ConwayPad AI</p>
            <p className="text-[10px] text-muted-foreground">Token deployment assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {editingWallet ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={walletInput}
                onChange={e => setWalletInput(e.target.value)}
                placeholder="0x..."
                className="h-7 text-xs font-mono w-40"
                onKeyDown={e => e.key === "Enter" && saveWallet()}
                data-testid="input-wallet"
              />
              <Button size="sm" onClick={saveWallet} className="h-7 px-2 text-xs" data-testid="button-save-wallet">
                <CheckCircle className="w-3 h-3 mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingWallet(false)} className="h-7 px-2">
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingWallet(true); setWalletInput(wallet); }}
              className="h-7 px-2 text-xs"
              data-testid="button-set-wallet"
            >
              <Wallet className="w-3 h-3 mr-1" />
              {wallet ? truncateAddress(wallet) : "Set Wallet"}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={clearHistory}
            disabled={messages.length === 0}
            className="h-7 w-7"
            data-testid="button-clear-chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {historyLoading && messages.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-12 w-1/2 ml-auto" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">ConwayPad AI</h2>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Ask anything or deploy a token directly from here.
            </p>

            {/* Quick prompts */}
            <div className="grid grid-cols-2 gap-2 max-w-sm w-full mb-4">
              {QUICK_PROMPTS.map(({ label, prompt, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(prompt)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card border border-border text-left hover:bg-muted/40 transition-colors"
                  data-testid={`quick-${label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium text-foreground">{label}</span>
                </button>
              ))}
            </div>

            {/* Deploy button */}
            <button
              onClick={() => setShowDeployPanel(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
              data-testid="button-open-deploy-panel"
            >
              <Rocket className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Deploy New Token</span>
            </button>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Deploy panel (above input) */}
      {showDeployPanel && (
        <div className="flex-shrink-0 border-t border-border px-4 pt-3 pb-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Deploy Token</p>
            <Button size="icon" variant="ghost" onClick={() => setShowDeployPanel(false)} className="h-6 w-6">
              <X className="w-3 h-3" />
            </Button>
          </div>
          <DeployPanel onSend={sendMessage} userWallet={wallet} />
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-border bg-background/90 backdrop-blur-sm p-3">
        <div className="flex gap-2 items-end">
          <Button
            size="icon"
            variant={showDeployPanel ? "default" : "outline"}
            onClick={() => setShowDeployPanel(!showDeployPanel)}
            className="h-9 w-9 flex-shrink-0"
            title="Deploy Token"
            data-testid="button-toggle-deploy"
          >
            <Rocket className="w-4 h-4" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Ask something or type "Deploy token Name: X Symbol: Y Wallet: 0x..."'
            className="resize-none min-h-[38px] max-h-32 text-sm flex-1"
            rows={1}
            disabled={isStreaming}
            data-testid="input-chat-message"
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            data-testid="button-send-message"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
          Enter to send · Shift+Enter for new line · 🚀 for deploy form
        </p>
      </div>
    </div>
  );
}
