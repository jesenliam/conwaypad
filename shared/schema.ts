import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trackedWallets = pgTable("tracked_wallets", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull().unique(),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tokenLaunches = pgTable("token_launches", {
  id: serial("id").primaryKey(),
  tokenAddress: text("token_address"),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  deployerWallet: text("deployer_wallet").notNull(),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertTrackedWalletSchema = createInsertSchema(trackedWallets).omit({ id: true, createdAt: true });
export const insertTokenLaunchSchema = createInsertSchema(tokenLaunches).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertTrackedWallet = z.infer<typeof insertTrackedWalletSchema>;
export type TrackedWallet = typeof trackedWallets.$inferSelect;

export type InsertTokenLaunch = z.infer<typeof insertTokenLaunchSchema>;
export type TokenLaunch = typeof tokenLaunches.$inferSelect;
