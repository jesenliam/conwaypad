import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  chatMessages, trackedWallets, tokenLaunches,
  type ChatMessage, type InsertChatMessage,
  type TrackedWallet, type InsertTrackedWallet,
  type TokenLaunch, type InsertTokenLaunch,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  // Chat
  getChatHistory(sessionId: string): Promise<ChatMessage[]>;
  addChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  clearChatHistory(sessionId: string): Promise<void>;
  // Wallets
  getTrackedWallets(): Promise<TrackedWallet[]>;
  addTrackedWallet(wallet: InsertTrackedWallet): Promise<TrackedWallet>;
  removeTrackedWallet(id: number): Promise<void>;
  // Token launches
  getTokenLaunches(): Promise<TokenLaunch[]>;
  addTokenLaunch(launch: InsertTokenLaunch): Promise<TokenLaunch>;
}

export class PgStorage implements IStorage {
  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  }

  async addChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const [row] = await db.insert(chatMessages).values(msg).returning();
    return row;
  }

  async clearChatHistory(sessionId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  }

  async getTrackedWallets(): Promise<TrackedWallet[]> {
    return await db.select().from(trackedWallets).orderBy(trackedWallets.createdAt);
  }

  async addTrackedWallet(wallet: InsertTrackedWallet): Promise<TrackedWallet> {
    const [row] = await db.insert(trackedWallets).values(wallet).returning();
    return row;
  }

  async removeTrackedWallet(id: number): Promise<void> {
    await db.delete(trackedWallets).where(eq(trackedWallets.id, id));
  }

  async getTokenLaunches(): Promise<TokenLaunch[]> {
    return await db.select().from(tokenLaunches).orderBy(tokenLaunches.createdAt);
  }

  async addTokenLaunch(launch: InsertTokenLaunch): Promise<TokenLaunch> {
    const [row] = await db.insert(tokenLaunches).values(launch).returning();
    return row;
  }
}

export const storage = new PgStorage();
