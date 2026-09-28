import { db } from "@/db";
import { products, orders, messages, tgChats } from "@/db/schema";
import { categories, categoryName, orderStatuses } from "@/lib/catalog";
import { stylistReply, smartSearch, suggestSize } from "@/lib/ai";
import { getTgConfig, tgCall, upsertChat, getChatState, setChatState, setChatPhone, type ChatState, type TgConfig } from "@/lib/telegram";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

/* ============================================================
 *  فاز ۱۲ — مغز ربات تلگرام کیا
 *  ورودی: آپدیت تلگرام → خروجی: پاسخ اصلی به‌صورت webhook reply
 *  (پاسخ‌دادن داخل جواب HTTP وبهوک؛ یک فراخوانی API کمتر)
 * ============================================================ */

const fmt = (n: number) => n.toLocaleString("fa-IR");
const digits = (value: string) => value.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

type Reply = Record<string, unknown> | null;
const send = (chatId: string, text: string, keyboard?: { inline_keyboard: { text: string; callback_data?: string; url?: string }[][] }): Reply =>
  ({ method: "sendMessage", chat_id: chatId, text, ...(keyboard ? { reply_markup: keyboard } : {}) });

const mainKeyboard = (config: TgConfig) => ({
  inline_keyboard: [
    [{ text: "🛍 دسته‌بندی‌ها و خرید", callback_data: "cats" }],
    [{ text: "🔥 تخفیف‌دارها", callback_data: "sale" }, { text: "🔎 جستجو", callback_data: "search" }],
    [{ text: "🧺 سبد خرید", callback_data: "cart" }, { text: "📦 سفارش‌های من", callback_data: "orders" }],
    [{ text: "📏 مشاوره سایز", callback_data: "size" }, { text: "✨ مشاور استایل", callback_data: "stylist" }],
    [{ text: "💬 پشتیبانی", callback_data: "support" }],
    ...(config.channelId && config.channelId.startsWith("@") ? [[{ text: "📣 کانال کیا", url: `https://t.me/${config.channelId.slice(1)}` }]] : []),
  ],
});
const backRow = [{ text: "🏠 منوی اصلی", callback_data: "home" }];

async function activeProducts() {
  return db.select().from(products).where(eq(products.active, true)).orderBy(desc(products.featured), products.id);
}

function productLine(p: { name: string; price: number; compareAt: number | null; stock: number }) {
  const discount = p.compareAt && p.compareAt > p.price ? ` (${fmt(Math.round((1 - p.price / p.compareAt) * 100))}٪ تخفیف)` : "";
  return `${p.name} — ${fmt(p.price)} تومان${discount}${p.stock === 0 ? " — ناموجود" : ""}`;
}

/* ------------------------------------------------------------
 *  ورودی اصلی: پردازش آپدیت
 * ------------------------------------------------------------ */
export async function handleUpdate(update: Record<string, unknown>, origin: string): Promise<Reply> {
  const config = await getTgConfig();
  if (!config.enabled) return null;

  const callback = update.callback_query as { id: string; data?: string; from?: { id: number; first_name?: string; last_name?: string; username?: string }; message?: { chat?: { id: number } } } | undefined;
  const message = update.message as { text?: string; chat?: { id: number; first_name?: string; last_name?: string; username?: string }; from?: { id: number } } | undefined;

  if (callback?.message?.chat) {
    const chatId = String(callback.message.chat.id);
    const name = [callback.from?.first_name, callback.from?.last_name].filter(Boolean).join(" ");
    await upsertChat(chatId, { name, username: callback.from?.username });
    // پاسخ سریع به کلیک (بدون توکن → dev-log)
    void tgCall(config, "answerCallbackQuery", { callback_query_id: callback.id });
    return handleAction(config, chatId, String(callback.data || ""), origin);
  }

  if (message?.chat && typeof message.text === "string") {
    const chatId = String(message.chat.id);
    const name = [message.chat.first_name, message.chat.last_name].filter(Boolean).join(" ");
    await upsertChat(chatId, { name, username: message.chat.username });
    return handleText(config, chatId, message.text.trim().slice(0, 1000), name, origin);
  }
  return null;
}

/* ------------------------------------------------------------
 *  دستورها و پیام‌های متنی
 * ------------------------------------------------------------ */
async function handleText(config: TgConfig, chatId: string, text: string, name: string, origin: string): Promise<Reply> {
  const isAdmin = config.adminChatIds.includes(chatId);

  // ---- دستورها ----
  if (text.startsWith("/start")) {
    await setChatState(chatId, {});
    return send(chatId, `سلام${name ? ` ${name}` : ""}! 👋\nبه ربات فروشگاه کیا خوش اومدی — کمربند و اکسسوری‌هایی که امضای استایل تو می‌شن ✨\n\nاز منوی زیر انتخاب کن:`, mainKeyboard(config));
  }
  if (text === "/cancel" || text === "لغو") { await setChatState(chatId, {}); return send(chatId, "باشه، برگشتیم به منوی اصلی 🏠", mainKeyboard(config)); }
  if (text.startsWith("/orders")) return handleAction(config, chatId, "orders", origin);
  if (text.startsWith("/size")) return handleAction(config, chatId, "size", origin);
  if (text.startsWith("/stylist")) return handleAction(config, chatId, "stylist", origin);
  if (text.startsWith("/support")) return handleAction(config, chatId, "support", origin);
  if (text.startsWith("/search")) return handleAction(config, chatId, "search", origin);
  if (text.startsWith("/cart")) return handleAction(config, chatId, "cart", origin);

  // ---- دستورهای مدیر ----
  if (isAdmin && text.startsWith("/stats")) return adminStats(chatId);
  if (isAdmin && text.startsWith("/broadcast")) {
    const body = text.replace("/broadcast", "").trim();
    if (!body) return send(chatId, "متن پیام همگانی را بعد از دستور بنویس:\n/broadcast متن پیام");
    return adminBroadcast(config, chatId, body);
  }
  if (isAdmin && /^\/reply_\d+/.test(text)) {
    const id = Number(text.match(/^\/reply_(\d+)/)?.[1]);
    const body = text.replace(/^\/reply_\d+/, "").trim();
    if (!body) return send(chatId, "متن پاسخ را بعد از دستور بنویس:\n/reply_" + id + " متن پاسخ");
    return adminReply(config, chatId, id, body);
  }

  // ---- بر اساس وضعیت گفتگو ----
  const state = await getChatState(chatId);

  if (state.mode === "checkout") return checkoutStep(config, chatId, state, text, origin);

  if (state.mode === "search") {
    await setChatState(chatId, { ...state, mode: "idle" });
    const result = await smartSearch(text);
    if (!result.products.length) return send(chatId, `چیزی مطابق «${text}» پیدا نکردم 🙈 یک عبارت ساده‌تر امتحان کن یا از دسته‌بندی‌ها ببین.`, { inline_keyboard: [[{ text: "🛍 دسته‌بندی‌ها", callback_data: "cats" }], backRow] });
    return send(chatId, `نتیجهٔ جستجو:\n${result.note}`, {
      inline_keyboard: [...result.products.slice(0, 6).map(p => [{ text: productLine(p), callback_data: `p:${p.id}` }]), backRow],
    });
  }

  if (state.mode === "stylist") {
    const history = (state.history || []).slice(-6);
    const result = await stylistReply(text, history);
    await setChatState(chatId, { ...state, history: [...history, { role: "user" as const, content: text }, { role: "assistant" as const, content: result.reply.slice(0, 500) }].slice(-8) });
    const buttons = result.products.slice(0, 4).map(p => [{ text: `🛒 ${p.name} — ${fmt(p.price)} ت`, callback_data: `p:${p.id}` }]);
    return send(chatId, result.reply, { inline_keyboard: [...buttons, [{ text: "پایان گفتگو", callback_data: "home" }]] });
  }

  if (state.mode === "support") {
    await setChatState(chatId, { ...state, mode: "idle" });
    const [chat] = await db.select().from(tgChats).where(eq(tgChats.chatId, chatId));
    const [saved] = await db.insert(messages).values({ name: name || chat?.name || "کاربر تلگرام", phone: chat?.phone || `tg:${chatId}`, message: text }).returning();
    // اطلاع به مدیرها با شناسهٔ پاسخ‌دهی
    for (const adminId of config.adminChatIds) void tgCall(config, "sendMessage", { chat_id: adminId, text: `💬 پیام پشتیبانی جدید از ${name || chatId}:\n${text}\n\nپاسخ: /reply_${saved.id} متن پاسخ` });
    return send(chatId, "پیامت به پشتیبانی کیا رسید ✅ به‌زودی همین‌جا یا با شماره‌ات جواب می‌دیم.", mainKeyboard(config));
  }

  if (state.mode === "size" && state.size) return sizeStep(config, chatId, state, text);

  if (state.mode === "orders") {
    const phone = digits(text).replace(/\D/g, "");
    if (!/^09\d{9}$/.test(phone)) return send(chatId, "شماره موبایل را مثل 09121234567 بفرست.");
    await setChatPhone(chatId, phone);
    await setChatState(chatId, { ...state, mode: "idle" });
    return listOrders(config, chatId, phone);
  }

  // پیش‌فرض: راهنما
  return send(chatId, "متوجه نشدم 🙈 از منوی زیر انتخاب کن یا /start را بزن:", mainKeyboard(config));
}

/* ------------------------------------------------------------
 *  کلیک روی دکمه‌ها (callback query)
 * ------------------------------------------------------------ */
async function handleAction(config: TgConfig, chatId: string, data: string, origin: string): Promise<Reply> {
  const state = await getChatState(chatId);

  if (data === "home") { await setChatState(chatId, { ...state, mode: "idle", history: [] }); return send(chatId, "منوی اصلی کیا 🏠", mainKeyboard(config)); }

  if (data === "cats") return send(chatId, "دنبال چه جزئیاتی می‌گردی؟ 🛍", {
    inline_keyboard: [...categories.map(c => [{ text: c.name, callback_data: `cat:${c.id}` }]), backRow],
  });

  if (data.startsWith("cat:")) {
    const category = data.slice(4);
    const list = (await activeProducts()).filter(p => p.category === category && p.stock > 0).slice(0, 8);
    if (!list.length) return send(chatId, "فعلاً محصول موجودی در این دسته نیست 🙈", { inline_keyboard: [[{ text: "↩️ دسته‌ها", callback_data: "cats" }], backRow] });
    return send(chatId, `${categoryName(category)} کیا:`, {
      inline_keyboard: [...list.map(p => [{ text: productLine(p), callback_data: `p:${p.id}` }]), [{ text: "↩️ دسته‌ها", callback_data: "cats" }], backRow],
    });
  }

  if (data === "sale") {
    const list = (await activeProducts()).filter(p => p.compareAt && p.compareAt > p.price && p.stock > 0).slice(0, 8);
    if (!list.length) return send(chatId, "فعلاً تخفیف فعالی نداریم؛ ولی به‌زودی خبرهای خوب می‌رسه ✨", { inline_keyboard: [backRow] });
    return send(chatId, "🔥 تخفیف‌دارهای الان کیا:", { inline_keyboard: [...list.map(p => [{ text: productLine(p), callback_data: `p:${p.id}` }]), backRow] });
  }

  if (data.startsWith("p:")) {
    const id = Number(data.slice(2));
    const [p] = await db.select().from(products).where(eq(products.id, id));
    if (!p || !p.active) return send(chatId, "این محصول دیگر در دسترس نیست.", { inline_keyboard: [backRow] });
    const discount = p.compareAt && p.compareAt > p.price ? `\n💥 ${fmt(Math.round((1 - p.price / p.compareAt) * 100))}٪ تخفیف (قبلاً ${fmt(p.compareAt)} تومان)` : "";
    const link = config.siteUrl ? `\n🖼 عکس و جزئیات: ${config.siteUrl}/product/${p.slug}` : "";
    const text = `«${p.name}»\n${p.material}\n\n💰 ${fmt(p.price)} تومان${discount}\n📦 موجودی: ${p.stock ? fmt(p.stock) + " عدد" : "ناموجود"}\n${p.sizes.length ? `📐 سایزها: ${p.sizes.join("، ")}\n` : ""}${p.colors.length ? `🎨 رنگ‌ها: ${p.colors.map(c => c.name).join("، ")}` : ""}${link}\n\n${p.description.slice(0, 250)}`;
    return send(chatId, text, {
      inline_keyboard: [
        ...(p.stock > 0 ? [[{ text: "🛒 افزودن به سبد", callback_data: `add:${p.id}` }]] : []),
        [{ text: "↩️ دستهٔ " + categoryName(p.category), callback_data: `cat:${p.category}` }], backRow,
      ],
    });
  }

  if (data.startsWith("add:")) {
    const id = Number(data.slice(4));
    const [p] = await db.select().from(products).where(eq(products.id, id));
    if (!p || !p.active || p.stock < 1) return send(chatId, "این محصول فعلاً موجود نیست.", { inline_keyboard: [backRow] });
    if (p.sizes.length > 1) return send(chatId, `سایز «${p.name}» را انتخاب کن:`, {
      inline_keyboard: [p.sizes.map((s, i) => ({ text: /^\d+$/.test(s) ? fmt(Number(s)) : s, callback_data: `sz:${p.id}:${i}` })), backRow],
    });
    return pickColor(config, chatId, p, 0);
  }

  if (data.startsWith("sz:")) {
    const [, idText, indexText] = data.split(":");
    const [p] = await db.select().from(products).where(eq(products.id, Number(idText)));
    if (!p) return send(chatId, "محصول پیدا نشد.", { inline_keyboard: [backRow] });
    return pickColor(config, chatId, p, Number(indexText));
  }

  if (data.startsWith("cl:")) {
    const [, idText, sizeIndex, colorIndex] = data.split(":");
    const [p] = await db.select().from(products).where(eq(products.id, Number(idText)));
    if (!p) return send(chatId, "محصول پیدا نشد.", { inline_keyboard: [backRow] });
    return addToCart(config, chatId, p, Number(sizeIndex), Number(colorIndex));
  }

  if (data === "cart") return showCart(config, chatId);
  if (data === "cart:clear") { await setChatState(chatId, { ...state, cart: [] }); return send(chatId, "سبد خالی شد 🧺", mainKeyboard(config)); }

  if (data === "checkout") {
    const cart = state.cart || [];
    if (!cart.length) return send(chatId, "سبدت خالیه! اول یک محصول انتخاب کن 🛍", { inline_keyboard: [[{ text: "🛍 دسته‌بندی‌ها", callback_data: "cats" }], backRow] });
    await setChatState(chatId, { ...state, mode: "checkout", checkout: { step: "name", requestKey: randomUUID() } });
    return send(chatId, "بریم برای ثبت سفارش ✍️\n\nنام و نام خانوادگی گیرنده را بنویس:\n(برای انصراف: /cancel)");
  }

  if (data === "confirm") return submitOrder(config, chatId, origin);

  if (data === "orders") {
    const [chat] = await db.select().from(tgChats).where(eq(tgChats.chatId, chatId));
    if (chat?.phone) return listOrders(config, chatId, chat.phone);
    await setChatState(chatId, { ...state, mode: "orders" });
    return send(chatId, "شماره موبایلی که با آن سفارش دادی را بفرست (مثل 09121234567):");
  }

  if (data === "search") { await setChatState(chatId, { ...state, mode: "search" }); return send(chatId, "چی می‌خوای؟ راحت بنویس 🔎\nمثلاً: «گردنبند نقره‌ای زیر ۵۰۰ هزار تومان»"); }
  if (data === "stylist") { await setChatState(chatId, { ...state, mode: "stylist", history: [] }); return send(chatId, "من مشاور استایل کیام ✨ بگو برای چه مناسبتی و با چه بودجه‌ای دنبال چی هستی تا بهترین‌ها رو دست‌چین کنم.\n(برای پایان: /cancel)"); }
  if (data === "support") { await setChatState(chatId, { ...state, mode: "support" }); return send(chatId, "پیامت را بنویس؛ مستقیم به صندوق پشتیبانی کیا می‌رسد 💬"); }

  if (data === "size") {
    const list = (await activeProducts()).filter(p => p.stock > 0 && p.sizes.some(s => /^\d+$/.test(s))).slice(0, 8);
    return send(chatId, "برای کدام محصول مشاورهٔ سایز می‌خوای؟ 📏", {
      inline_keyboard: [...list.map(p => [{ text: p.name, callback_data: `szp:${p.id}` }]), backRow],
    });
  }

  if (data.startsWith("szp:")) {
    const id = Number(data.slice(4));
    const [p] = await db.select().from(products).where(eq(products.id, id));
    if (!p) return send(chatId, "محصول پیدا نشد.", { inline_keyboard: [backRow] });
    await setChatState(chatId, { ...state, mode: "size", size: { productId: id, step: p.category === "rings" ? "usual" : "height" } });
    return send(chatId, p.category === "rings" ? `سایز همیشگی انگشترت چنده؟ (مثلاً 9)` : `قدت چند سانتی‌متره؟ (مثلاً 175)`);
  }

  return send(chatId, "این گزینه را نشناختم؛ منوی اصلی:", mainKeyboard(config));
}

/* ------------------------------------------------------------
 *  سبد خرید
 * ------------------------------------------------------------ */
async function pickColor(config: TgConfig, chatId: string, p: typeof products.$inferSelect, sizeIndex: number): Promise<Reply> {
  if (p.colors.length > 1) return send(chatId, `رنگ «${p.name}» را انتخاب کن:`, {
    inline_keyboard: [p.colors.map((c, i) => ({ text: c.name, callback_data: `cl:${p.id}:${sizeIndex}:${i}` })), backRow],
  });
  return addToCart(config, chatId, p, sizeIndex, 0);
}

async function addToCart(config: TgConfig, chatId: string, p: typeof products.$inferSelect, sizeIndex: number, colorIndex: number): Promise<Reply> {
  const state = await getChatState(chatId);
  const size = p.sizes[sizeIndex] ?? p.sizes[0] ?? "";
  const color = p.colors[colorIndex]?.name ?? p.colors[0]?.name ?? "";
  const cart = [...(state.cart || [])];
  const existing = cart.find(item => item.productId === p.id && item.size === size && item.color === color);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, 10);
  else cart.push({ productId: p.id, quantity: 1, size, color });
  await setChatState(chatId, { ...state, cart });
  return send(chatId, `«${p.name}» به سبدت اضافه شد ✅${size ? `\nسایز: ${/^\d+$/.test(size) ? fmt(Number(size)) : size}` : ""}${color ? ` · رنگ: ${color}` : ""}`, {
    inline_keyboard: [
      [{ text: "🧺 مشاهدهٔ سبد و ثبت سفارش", callback_data: "cart" }],
      [{ text: "🛍 ادامهٔ خرید", callback_data: "cats" }], backRow,
    ],
  });
}

async function showCart(config: TgConfig, chatId: string): Promise<Reply> {
  const state = await getChatState(chatId);
  const cart = state.cart || [];
  if (!cart.length) return send(chatId, "سبدت خالیه 🧺 بریم یه چیز خوب پیدا کنیم؟", { inline_keyboard: [[{ text: "🛍 دسته‌بندی‌ها", callback_data: "cats" }], backRow] });
  const ids = [...new Set(cart.map(i => i.productId))];
  const catalog = await db.select().from(products).where(inArray(products.id, ids));
  let total = 0;
  const lines = cart.map(item => {
    const p = catalog.find(x => x.id === item.productId);
    if (!p) return null;
    total += p.price * item.quantity;
    return `• ${p.name} ×${fmt(item.quantity)}${item.size ? ` — سایز ${/^\d+$/.test(item.size) ? fmt(Number(item.size)) : item.size}` : ""}${item.color ? ` — ${item.color}` : ""} — ${fmt(p.price * item.quantity)} تومان`;
  }).filter(Boolean);
  return send(chatId, `🧺 سبد خرید تو:\n\n${lines.join("\n")}\n\nجمع کالاها: ${fmt(total)} تومان\n(هزینهٔ ارسال هنگام ثبت نهایی محاسبه می‌شود)`, {
    inline_keyboard: [
      [{ text: "✅ ثبت سفارش", callback_data: "checkout" }],
      [{ text: "🗑 خالی کردن سبد", callback_data: "cart:clear" }, { text: "🛍 ادامهٔ خرید", callback_data: "cats" }],
      backRow,
    ],
  });
}

/* ------------------------------------------------------------
 *  ثبت سفارش (همان مسیر /api/orders سایت — منطق مشترک)
 * ------------------------------------------------------------ */
async function checkoutStep(config: TgConfig, chatId: string, state: ChatState, text: string, origin: string): Promise<Reply> {
  const checkout = { ...(state.checkout || { step: "name", requestKey: randomUUID() }) };
  if (checkout.step === "name") {
    if (text.length < 3) return send(chatId, "نام کامل را بنویس (حداقل ۳ حرف):");
    checkout.name = text.slice(0, 100); checkout.step = "phone";
    await setChatState(chatId, { ...state, checkout });
    return send(chatId, "شماره موبایل گیرنده؟ (مثل 09121234567)");
  }
  if (checkout.step === "phone") {
    const phone = digits(text).replace(/\D/g, "");
    if (!/^09\d{9}$/.test(phone)) return send(chatId, "شماره معتبر نیست؛ مثل 09121234567 بفرست:");
    checkout.phone = phone; checkout.step = "city";
    await setChatPhone(chatId, phone);
    await setChatState(chatId, { ...state, checkout });
    return send(chatId, "شهر محل تحویل؟");
  }
  if (checkout.step === "city") {
    if (text.length < 2) return send(chatId, "نام شهر را بنویس:");
    checkout.city = text.slice(0, 100); checkout.step = "address";
    await setChatState(chatId, { ...state, checkout });
    return send(chatId, "آدرس کامل پستی را بنویس:");
  }
  if (checkout.step === "address") {
    if (text.length < 8) return send(chatId, "آدرس کامل‌تری بنویس (حداقل ۸ حرف):");
    checkout.address = text.slice(0, 600); checkout.step = "postal";
    await setChatState(chatId, { ...state, checkout });
    return send(chatId, "کد پستی ۱۰ رقمی؟");
  }
  if (checkout.step === "postal") {
    const postal = digits(text).replace(/\D/g, "");
    if (!/^\d{10}$/.test(postal)) return send(chatId, "کد پستی باید ۱۰ رقم باشد:");
    checkout.postalCode = postal; checkout.step = "confirm";
    await setChatState(chatId, { ...state, checkout });
    // خلاصهٔ سفارش
    const cart = state.cart || [];
    const ids = [...new Set(cart.map(i => i.productId))];
    const catalog = await db.select().from(products).where(inArray(products.id, ids));
    const subtotal = cart.reduce((sum, item) => sum + (catalog.find(p => p.id === item.productId)?.price || 0) * item.quantity, 0);
    return send(chatId, `مرور نهایی سفارش 📋\n\n👤 ${checkout.name}\n📱 ${checkout.phone}\n📍 ${checkout.city} — ${checkout.address}\n🏷 کد پستی: ${checkout.postalCode}\n\nجمع کالاها: ${fmt(subtotal)} تومان (+ ارسال طبق تعرفهٔ فروشگاه)\n\nثبت کنم؟`, {
      inline_keyboard: [[{ text: "✅ ثبت نهایی سفارش", callback_data: "confirm" }], [{ text: "❌ انصراف", callback_data: "cart" }]],
    });
  }
  return send(chatId, "برای ثبت نهایی روی دکمهٔ «ثبت نهایی سفارش» بزن یا /cancel را بفرست.");
}

async function submitOrder(config: TgConfig, chatId: string, origin: string): Promise<Reply> {
  const state = await getChatState(chatId);
  const checkout = state.checkout;
  const cart = state.cart || [];
  if (!checkout || checkout.step !== "confirm" || !cart.length) return send(chatId, "اطلاعات سفارش کامل نیست؛ از سبد شروع کن 🧺", { inline_keyboard: [[{ text: "🧺 سبد خرید", callback_data: "cart" }]] });
  // همان مسیر امن سایت: قیمت/موجودی سمت سرور، idempotent با requestKey
  const response = await fetch(`${origin}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `tgbot-${chatId}` },
    body: JSON.stringify({
      requestKey: checkout.requestKey, name: checkout.name, phone: checkout.phone,
      city: checkout.city, address: checkout.address, postalCode: checkout.postalCode,
      delivery: "shipping", items: cart, note: "ثبت‌شده از ربات تلگرام کیا",
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return send(chatId, `ثبت نشد: ${result.error || "خطای ناشناخته"}\nسبد را بررسی کن:`, { inline_keyboard: [[{ text: "🧺 سبد خرید", callback_data: "cart" }], backRow] });
  await setChatState(chatId, { ...state, mode: "idle", cart: [], checkout: undefined });
  return send(chatId, `سفارشت ثبت شد 🎉\n\n🧾 کد پیگیری: ${result.code}\n💰 مبلغ نهایی: ${fmt(result.total)} تومان\n\nفروشگاه برای هماهنگی پرداخت و ارسال باهات تماس می‌گیرد.\nهر وقت خواستی با «📦 سفارش‌های من» وضعیتش را ببین.`, mainKeyboard(config));
}

/* ------------------------------------------------------------
 *  پیگیری سفارش، سایز، مدیر
 * ------------------------------------------------------------ */
async function listOrders(config: TgConfig, chatId: string, phone: string): Promise<Reply> {
  const list = await db.select().from(orders).where(eq(orders.phone, phone)).orderBy(desc(orders.createdAt)).limit(5);
  if (!list.length) return send(chatId, "سفارشی با این شماره پیدا نکردم. اگر تازه ثبت کردی چند دقیقه صبر کن 🙏", mainKeyboard(config));
  const lines = list.map(o => `🧾 ${o.code}\n${orderStatuses[o.status] || o.status}${o.trackingNumber ? ` — کد رهگیری پست: ${o.trackingNumber}` : ""} — ${fmt(o.total)} تومان`);
  return send(chatId, `سفارش‌های اخیر تو 📦\n\n${lines.join("\n\n")}`, mainKeyboard(config));
}

async function sizeStep(config: TgConfig, chatId: string, state: ChatState, text: string): Promise<Reply> {
  const flow = state.size!;
  const value = Number(digits(text).replace(/[^\d.]/g, ""));
  if (flow.step === "usual") {
    const result = await suggestSize(flow.productId, { usualSize: String(value || text) });
    await setChatState(chatId, { ...state, mode: "idle", size: undefined });
    return send(chatId, result ? result.reply : "محصول پیدا نشد.", { inline_keyboard: [[{ text: "🛒 مشاهدهٔ محصول", callback_data: `p:${flow.productId}` }], backRow] });
  }
  if (flow.step === "height") {
    if (!value || value < 100 || value > 230) return send(chatId, "قد را به سانتی‌متر بفرست (مثلاً 175):");
    await setChatState(chatId, { ...state, size: { ...flow, step: "weight", height: value } });
    return send(chatId, "وزنت چند کیلوگرمه؟ (مثلاً 75)");
  }
  if (flow.step === "weight") {
    if (!value || value < 30 || value > 200) return send(chatId, "وزن را به کیلوگرم بفرست (مثلاً 75):");
    const result = await suggestSize(flow.productId, { height: flow.height, weight: value });
    await setChatState(chatId, { ...state, mode: "idle", size: undefined });
    return send(chatId, result ? result.reply : "محصول پیدا نشد.", { inline_keyboard: [[{ text: "🛒 مشاهدهٔ محصول", callback_data: `p:${flow.productId}` }], backRow] });
  }
  return send(chatId, "از «📏 مشاوره سایز» شروع کن.", mainKeyboard(config));
}

async function adminStats(chatId: string): Promise<Reply> {
  const monthStart = new Date(Date.now() - 30 * 86400000);
  const [monthOrders] = await db.select({ count: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(total), 0)` })
    .from(orders).where(and(gte(orders.createdAt, monthStart), sql`${orders.status} <> 'cancelled'`));
  const [pending] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "pending"));
  const lowStock = await db.select({ name: products.name, stock: products.stock }).from(products).where(and(eq(products.active, true), sql`${products.stock} <= 3`)).limit(5);
  const [chats] = await db.select({ count: sql<number>`count(*)` }).from(tgChats);
  return send(chatId, [
    "📊 آمار فروشگاه کیا",
    "",
    `🧾 سفارش‌های ۳۰ روز: ${fmt(Number(monthOrders.count))}`,
    `💰 فروش ۳۰ روز: ${fmt(Number(monthOrders.revenue))} تومان`,
    `⏳ در انتظار تأیید: ${fmt(Number(pending.count))}`,
    `👥 کاربران ربات: ${fmt(Number(chats.count))}`,
    lowStock.length ? `\n⚠️ موجودی کم:\n${lowStock.map(p => `• ${p.name} (${fmt(p.stock)})`).join("\n")}` : "",
  ].filter(Boolean).join("\n"));
}

async function adminBroadcast(config: TgConfig, chatId: string, body: string): Promise<Reply> {
  const chats = await db.select({ chatId: tgChats.chatId }).from(tgChats).where(eq(tgChats.blocked, false)).limit(1000);
  let sent = 0;
  for (const chat of chats) {
    if (chat.chatId === chatId) continue;
    const result = await tgCall(config, "sendMessage", { chat_id: chat.chatId, text: body });
    if (result.ok) sent++;
    else if ((result.error || "").includes("blocked")) await db.update(tgChats).set({ blocked: true }).where(eq(tgChats.chatId, chat.chatId));
  }
  return send(chatId, `پیام همگانی برای ${fmt(sent)} کاربر ربات ارسال شد ✅`);
}

async function adminReply(config: TgConfig, chatId: string, messageId: number, body: string): Promise<Reply> {
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
  if (!msg) return send(chatId, `پیامی با شناسهٔ ${fmt(messageId)} پیدا نشد.`);
  await db.update(messages).set({ read: true }).where(eq(messages.id, messageId));
  if (msg.phone.startsWith("tg:")) {
    const target = msg.phone.slice(3);
    const result = await tgCall(config, "sendMessage", { chat_id: target, text: `💬 پاسخ پشتیبانی کیا:\n${body}` });
    return send(chatId, result.ok ? "پاسخ در تلگرام برای کاربر ارسال شد ✅" : `ارسال نشد: ${result.error}`);
  }
  // پیام از سایت بوده؛ پاسخ با پیامک از صف اعلان‌ها
  const { queueMessage, flushOutbox } = await import("@/lib/notify");
  await queueMessage({ channel: "sms", recipient: msg.phone, body: `پاسخ پشتیبانی کیا: ${body}`, subject: "پاسخ پشتیبانی", link: "", ruleKey: "support_reply" });
  await flushOutbox(5);
  return send(chatId, "پاسخ برای شمارهٔ کاربر در صف پیامک ثبت و ارسال شد ✅");
}
