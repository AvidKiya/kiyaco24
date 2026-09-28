import { db } from "@/db";
import { tgSettings, tgChats } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

/* ============================================================
 *  فاز ۱۲ — هستهٔ تلگرام
 *  همهٔ تنظیمات از پنل می‌آید (env فقط جایگزین است).
 *  بدون توکن: حالت dev-log — هیچ بخشی از سایت نمی‌شکند و
 *  QA می‌تواند کل چرخه را بدون اینترنت تلگرام تست کند.
 * ============================================================ */

export type TgConfig = {
  enabled: boolean; botToken: string; botUsername: string; channelId: string;
  adminChatIds: string[]; webhookSecret: string; webhookUrl: string; siteUrl: string; autoPublish: boolean;
};

export async function getTgConfig(): Promise<TgConfig> {
  await db.insert(tgSettings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(tgSettings).where(eq(tgSettings.id, 1));
  // اگر رمز وبهوک هنوز ساخته نشده، یک‌بار بساز و ذخیره کن
  let webhookSecret = row?.webhookSecret || "";
  if (!webhookSecret) {
    webhookSecret = randomBytes(24).toString("hex");
    await db.update(tgSettings).set({ webhookSecret }).where(eq(tgSettings.id, 1));
  }
  return {
    enabled: row?.enabled ?? true,
    botToken: row?.botToken || process.env.TELEGRAM_BOT_TOKEN || "",
    botUsername: row?.botUsername || "",
    channelId: row?.channelId || process.env.TELEGRAM_CHAT_ID || "",
    adminChatIds: (row?.adminChatIds || "").split(",").map(s => s.trim()).filter(Boolean),
    webhookSecret,
    webhookUrl: row?.webhookUrl || "",
    siteUrl: (row?.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, ""),
    autoPublish: row?.autoPublish ?? true,
  };
}

export function tgOnline(config: TgConfig) { return config.enabled && !!config.botToken; }

/** فراخوانی متد Bot API — بدون توکن: dev-log */
export async function tgCall(config: TgConfig, method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; dev?: boolean; result?: unknown; error?: string }> {
  if (!config.botToken) {
    console.log(`[TGBOT:${method}] ${JSON.stringify(payload).slice(0, 400)}`);
    return { ok: true, dev: true };
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!data.ok) return { ok: false, error: String(data.description || response.status) };
    return { ok: true, result: data.result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "ارتباط با تلگرام برقرار نشد." };
  }
}

const fmt = (n: number) => n.toLocaleString("fa-IR");

/* ------------------------------------------------------------
 *  انتشار خودکار در کانال
 * ------------------------------------------------------------ */
type PublishProduct = { name: string; slug: string; price: number; compareAt: number | null; material: string; category: string };

export async function publishProductToChannel(product: PublishProduct, kind: "new" | "flash" = "new") {
  const config = await getTgConfig();
  if (!config.autoPublish || !config.channelId) return { ok: false, skipped: true };
  const discount = product.compareAt && product.compareAt > product.price ? Math.round((1 - product.price / product.compareAt) * 100) : 0;
  const link = `${config.siteUrl || ""}/product/${product.slug}`;
  const lines = [
    kind === "flash" ? `⚡️ فروش ویژه — ${product.name}` : `✨ محصول جدید کیا — ${product.name}`,
    product.material,
    discount ? `💥 ${fmt(discount)}٪ تخفیف: ${fmt(product.price)} تومان (قبلاً ${fmt(product.compareAt!)})` : `💰 ${fmt(product.price)} تومان`,
    "",
    `🛍 سفارش: ${link}`,
    config.botUsername ? `🤖 خرید از ربات: @${config.botUsername}` : "",
  ].filter(Boolean);
  return tgCall(config, "sendMessage", { chat_id: config.channelId, text: lines.join("\n") });
}

export async function publishTextToChannel(text: string) {
  const config = await getTgConfig();
  if (!config.channelId) return { ok: false, error: "شناسهٔ کانال تنظیم نشده است." };
  return tgCall(config, "sendMessage", { chat_id: config.channelId, text });
}

/* ------------------------------------------------------------
 *  ثبت/به‌روزرسانی چت و وضعیت آن
 * ------------------------------------------------------------ */
export type ChatState = {
  mode?: "idle" | "search" | "stylist" | "support" | "checkout" | "size" | "orders" | "broadcast";
  cart?: { productId: number; quantity: number; size: string; color: string }[];
  checkout?: { step: string; requestKey: string; name?: string; phone?: string; city?: string; address?: string; postalCode?: string };
  size?: { productId: number; step: string; height?: number };
  history?: { role: "user" | "assistant"; content: string }[];
};

export async function upsertChat(chatId: string, info: { name?: string; username?: string }) {
  const [existing] = await db.select().from(tgChats).where(eq(tgChats.chatId, chatId));
  if (existing) {
    await db.update(tgChats).set({ lastSeenAt: new Date(), blocked: false, ...(info.name ? { name: info.name } : {}), ...(info.username ? { username: info.username } : {}) }).where(eq(tgChats.id, existing.id));
    return existing;
  }
  const [created] = await db.insert(tgChats).values({ chatId, name: info.name || "", username: info.username || "" }).returning();
  return created;
}

export async function getChatState(chatId: string): Promise<ChatState> {
  const [row] = await db.select({ state: tgChats.state }).from(tgChats).where(eq(tgChats.chatId, chatId));
  return (row?.state as ChatState) || {};
}

export async function setChatState(chatId: string, state: ChatState) {
  await db.update(tgChats).set({ state: state as Record<string, unknown>, lastSeenAt: new Date() }).where(eq(tgChats.chatId, chatId));
}

export async function setChatPhone(chatId: string, phone: string) {
  await db.update(tgChats).set({ phone }).where(eq(tgChats.chatId, chatId));
}

export async function listChats(limit = 200) {
  return db.select().from(tgChats).orderBy(desc(tgChats.lastSeenAt)).limit(limit);
}

/** داشبورد پنل */
export async function getTgDashboard() {
  const config = await getTgConfig();
  const chats = await db.select({ id: tgChats.id, chatId: tgChats.chatId, name: tgChats.name, username: tgChats.username, phone: tgChats.phone, blocked: tgChats.blocked, lastSeenAt: tgChats.lastSeenAt, createdAt: tgChats.createdAt }).from(tgChats).orderBy(desc(tgChats.lastSeenAt)).limit(100);
  const [row] = await db.select().from(tgSettings).where(eq(tgSettings.id, 1));
  return {
    settings: {
      enabled: row.enabled,
      hasToken: !!(row.botToken || process.env.TELEGRAM_BOT_TOKEN),
      tokenHint: row.botToken ? `•••${row.botToken.slice(-4)}` : (process.env.TELEGRAM_BOT_TOKEN ? "از env" : ""),
      botUsername: row.botUsername, channelId: row.channelId, adminChatIds: row.adminChatIds,
      webhookUrl: row.webhookUrl, siteUrl: row.siteUrl, autoPublish: row.autoPublish,
      envToken: !!process.env.TELEGRAM_BOT_TOKEN, envChannel: process.env.TELEGRAM_CHAT_ID || "",
    },
    online: tgOnline(config),
    webhookPath: `/api/telegram/webhook`,
    webhookSecret: config.webhookSecret,
    chats,
    chatCount: chats.length,
  };
}
