import { db } from "@/db";
import { aiSettings, aiLogs, aiCache, products, orders, stockAlerts, abandonedCarts } from "@/db/schema";
import { categoryName } from "@/lib/catalog";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { createHash } from "crypto";

/* ============================================================
 *  فاز ۱۱ — لایهٔ هوش مصنوعی کیا
 *  معماری: اتصال به هر سرویس OpenAI-compatible (سرویس ایرانی،
 *  واسط یا مدل متن‌باز) که از پنل تنظیم می‌شود — بدون hardcode.
 *  اگر سرویسی وصل نباشد، «موتور آفلاین» قانون‌محور جواب می‌دهد
 *  تا سایت هرگز بی‌پاسخ نماند و هیچ محصولی «توهم» نشود.
 * ============================================================ */

export type AiFeature = "stylist" | "search" | "size" | "recommend" | "captions" | "trends" | "test";
export type AiSource = "ai" | "fallback" | "cache" | "rule";

export type AiConfig = {
  enabled: boolean; baseUrl: string; apiKey: string; model: string;
  temperature: number; maxTokens: number; monthlyTokenBudget: number;
  features: Record<string, boolean>; assistantName: string;
};

export const aiFeatureLabels: Record<string, string> = {
  stylist: "مشاور استایل (چت)", search: "جستجوی هوشمند", size: "پیشنهاد سایز",
  recommend: "پیشنهاد محصول مکمل", captions: "تولید کپشن", trends: "تحلیل ترند",
};

/** خواندن تنظیمات: ردیف دیتابیس + جایگزین از env (AI_BASE_URL / AI_API_KEY / AI_MODEL) */
export async function getAiConfig(): Promise<AiConfig> {
  await db.insert(aiSettings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1));
  return {
    enabled: row?.enabled ?? true,
    baseUrl: (row?.baseUrl || process.env.AI_BASE_URL || "").replace(/\/+$/, ""),
    apiKey: row?.apiKey || process.env.AI_API_KEY || "",
    model: row?.model || process.env.AI_MODEL || "gpt-4o-mini",
    temperature: (row?.temperature ?? 70) / 100,
    maxTokens: row?.maxTokens ?? 700,
    monthlyTokenBudget: row?.monthlyTokenBudget ?? 0,
    features: row?.features ?? {},
    assistantName: row?.assistantName || "مشاور کیا",
  };
}

export function featureOn(config: AiConfig, feature: AiFeature) {
  return config.features[feature] !== false;
}

/** آیا سرویس آنلاین AI در دسترس است؟ (کلید + آدرس + فعال بودن) */
export function aiOnline(config: AiConfig) {
  return config.enabled && !!config.apiKey && !!config.baseUrl;
}

/** بررسی سقف توکن ماهانه — بعد از عبور، به موتور آفلاین برمی‌گردیم */
async function budgetLeft(config: AiConfig): Promise<boolean> {
  if (!config.monthlyTokenBudget) return true;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [row] = await db.select({ total: sql<number>`coalesce(sum(${aiLogs.promptTokens} + ${aiLogs.completionTokens}), 0)` })
    .from(aiLogs).where(gte(aiLogs.createdAt, monthStart));
  return Number(row?.total ?? 0) < config.monthlyTokenBudget;
}

async function logAi(feature: AiFeature, source: AiSource | "error", extra: { model?: string; promptTokens?: number; completionTokens?: number; durationMs?: number; error?: string } = {}) {
  try {
    await db.insert(aiLogs).values({ feature, source, model: extra.model || "", promptTokens: extra.promptTokens || 0, completionTokens: extra.completionTokens || 0, durationMs: extra.durationMs || 0, error: (extra.error || "").slice(0, 500) });
  } catch { /* گزارش نباید مسیر اصلی را بشکند */ }
}

/* ------------------------------------------------------------
 *  فراخوانی مدل (OpenAI-compatible chat/completions)
 * ------------------------------------------------------------ */
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callModel(config: AiConfig, options: { system: string; messages: ChatMessage[]; json?: boolean; maxTokens?: number; temperature?: number }): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        max_tokens: options.maxTokens ?? config.maxTokens,
        temperature: options.temperature ?? config.temperature,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "system", content: options.system }, ...options.messages],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI API ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const data = await response.json();
    return {
      content: String(data.choices?.[0]?.message?.content ?? ""),
      promptTokens: Number(data.usage?.prompt_tokens ?? 0),
      completionTokens: Number(data.usage?.completion_tokens ?? 0),
    };
  } finally { clearTimeout(timer); }
}

/* ------------------------------------------------------------
 *  کش پاسخ‌های تکراری (صرفه‌جویی توکن)
 * ------------------------------------------------------------ */
function cacheKey(feature: string, payload: unknown) {
  return createHash("sha256").update(`${feature}:${JSON.stringify(payload)}`).digest("hex");
}

async function readCache<T>(key: string): Promise<T | null> {
  const [hit] = await db.select().from(aiCache).where(eq(aiCache.key, key));
  if (!hit || hit.expiresAt < new Date()) return null;
  await db.update(aiCache).set({ hits: hit.hits + 1 }).where(eq(aiCache.id, hit.id));
  return hit.response as T;
}

async function writeCache(key: string, feature: string, response: unknown, ttlMinutes: number) {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60000);
  await db.insert(aiCache).values({ key, feature, response, expiresAt })
    .onConflictDoUpdate({ target: aiCache.key, set: { response, expiresAt, feature } });
}

/* ------------------------------------------------------------
 *  کاتالوگ برای مدل (RAG): فقط محصولات فعال و موجود
 * ------------------------------------------------------------ */
export type CatalogItem = { id: number; slug: string; name: string; category: string; description: string; material: string; price: number; compareAt: number | null; stock: number; image: string; colors: { name: string; hex: string }[]; sizes: string[]; featured: boolean };

export async function getCatalog(): Promise<CatalogItem[]> {
  const rows = await db.select().from(products).where(eq(products.active, true)).orderBy(desc(products.featured), products.id);
  return rows as CatalogItem[];
}

const fmt = (n: number) => n.toLocaleString("fa-IR");

function catalogText(catalog: CatalogItem[]) {
  return catalog.filter(p => p.stock > 0).map(p =>
    `[[${p.slug}]] ${p.name} | ${categoryName(p.category)} | ${fmt(p.price)} تومان${p.compareAt ? ` (قبلاً ${fmt(p.compareAt)})` : ""} | جنس: ${p.material} | رنگ: ${p.colors.map(c => c.name).join("، ") || "-"} | سایز: ${p.sizes.join("، ") || "-"} | موجودی: ${p.stock}`
  ).join("\n");
}

/** متن‌های نرمال‌شده برای جستجو (ی/ک عربی + ارقام فارسی) */
function normalize(value: string) {
  return value.replace(/ي/g, "ی").replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .toLowerCase();
}

/** استخراج بودجه از متن فارسی: «تا ۳ میلیون»، «۵۰۰ هزار تومان»، «زیر 800000» */
export function parseBudget(message: string): number | null {
  const text = normalize(message).replace(/[،,]/g, "");
  let match = text.match(/(\d+(?:\.\d+)?)\s*میلیون/);
  if (match) return Math.round(parseFloat(match[1]) * 1_000_000);
  match = text.match(/(\d+(?:\.\d+)?)\s*هزار/);
  if (match) return Math.round(parseFloat(match[1]) * 1_000);
  match = text.match(/(\d{5,})/);
  if (match) return parseInt(match[1], 10);
  return null;
}

const categoryKeywords: [string, RegExp][] = [
  ["belts", /کمربند/], ["necklaces", /گردنبند|زنجیر|کوبان|گردن‌بند/], ["bracelets", /دستبند|دست‌بند|مچ/],
  ["rings", /انگشتر|رینگ/], ["earrings", /گوشواره|گوش‌واره/], ["sets", /\bست\b|هدیه|کادو|گیفت/],
];

function detectCategories(message: string): string[] {
  const text = normalize(message);
  return categoryKeywords.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
}

/* ============================================================
 *  ۱) مشاور استایل — چت
 * ============================================================ */
export type StylistResult = { reply: string; products: CatalogItem[]; source: AiSource };

const stylistSystem = (name: string, catalog: string) => `تو «${name}» هستی؛ مشاور استایل فروشگاه اکسسوری کیا (کمربند چرم، گردنبند، دستبند، انگشتر، گوشواره و ست هدیه). همیشه فارسی، صمیمی و کوتاه جواب بده — مثل یک دوست خوش‌سلیقه، نه ربات.
قوانین:
۱. فقط از کاتالوگ زیر محصول پیشنهاد بده؛ هرگز محصولی خارج از آن نساز.
۲. هر محصولی که پیشنهاد می‌دهی، بلافاصله بعد از نامش تگ [[slug]] همان محصول را بنویس.
۳. قیمت‌ها را به تومان و با ارقام فارسی بنویس.
۴. اگر مناسبت/بودجه داد، ۲ تا ۳ پیشنهاد بده و برای هر کدام یک جملهٔ «چرا» بنویس.
۵. اگر بودجه گفت، از آن عبور نکن؛ اگر چیزی در بودجه نبود صادقانه بگو و نزدیک‌ترین را پیشنهاد کن.
۶. برای سایز، قد/وزن یا سایز معمول را بپرس.
۷. حداکثر ۱۲ خط. در پایان یک سوال کوتاه بپرس تا گفتگو ادامه پیدا کند.
کاتالوگ موجود:
${catalog}`;

function extractProducts(reply: string, catalog: CatalogItem[]): CatalogItem[] {
  const found: CatalogItem[] = [];
  const bySlug = new Map(catalog.map(p => [p.slug, p]));
  for (const match of reply.matchAll(/\[\[([a-z0-9-]+)\]\]/g)) {
    const product = bySlug.get(match[1]);
    if (product && !found.some(p => p.id === product.id)) found.push(product);
  }
  if (!found.length) for (const p of catalog) if (reply.includes(p.name) && !found.some(x => x.id === p.id)) found.push(p);
  return found.slice(0, 4);
}

/** موتور آفلاین مشاور استایل: بودجه + دسته + مناسبت را از متن درمی‌آورد و از کاتالوگ واقعی ست می‌سازد */
export function fallbackStylist(message: string, catalog: CatalogItem[]): { reply: string; products: CatalogItem[] } {
  const text = normalize(message);
  const budget = parseBudget(message);
  const wantedCategories = detectCategories(message);
  const formal = /مجلسی|مهمونی|مهمانی|رسمی|شب|قرار|عروسی|جشن/.test(text);
  const casual = /روزمره|اسپرت|ساده|روزانه|هرروز|محل کار|اداری/.test(text);
  const gift = /هدیه|کادو|گیفت|تولد/.test(text);
  const cheaper = /ارزون|ارزان|اقتصادی|کمتر/.test(text);
  const colorWanted = ["مشکی", "نقره‌ای", "طلایی", "قهوه‌ای"].filter(c => text.includes(normalize(c)));

  let pool = catalog.filter(p => p.stock > 0);
  if (budget) pool = pool.filter(p => p.price <= budget);
  const scored = pool.map(p => {
    let score = 0;
    if (wantedCategories.includes(p.category)) score += 5;
    if (gift && p.category === "sets") score += 4;
    if (formal && p.featured) score += 2;
    if (colorWanted.length && p.colors.some(c => colorWanted.includes(c.name))) score += 2;
    if (p.compareAt && p.compareAt > p.price) score += 1;
    if (p.featured) score += 1;
    return { p, score };
  }).sort((a, b) => b.score - a.score || (cheaper || casual ? a.p.price - b.p.price : b.p.price - a.p.price));

  const picks = scored.slice(0, 3).map(s => s.p);
  if (!picks.length) {
    const reply = budget
      ? `فعلاً محصول موجودی زیر ${fmt(budget)} تومان با این مشخصات نداریم 🙈 اگر بودجه کمی بازتر باشه یا دسته‌بندی دیگه‌ای مدنظرت باشه، حتماً گزینهٔ خوب برات دارم. دوست داری همهٔ تخفیف‌دارها رو ببینی؟`
      : `هنوز دقیق متوجه سلیقه‌ات نشدم! بگو برای چه مناسبتی می‌خوای (روزمره، مهمونی، هدیه؟) و حدود بودجه‌ات چقدره تا بهترین‌ها رو برات دست‌چین کنم ✨`;
    return { reply, products: [] };
  }

  const reasons: Record<string, string> = {
    belts: "با شلوار جین و شلوار پارچه‌ای هر دو می‌شینه و استایل رو جمع می‌کنه",
    necklaces: "روی لباس ساده حسابی خودنمایی می‌کنه و به تیپ شخصیت می‌ده",
    bracelets: "کنار ساعت یا تکی، یک جزئیات مینیمال و همیشه‌درسته",
    rings: "مینیمال و بی‌سروصدا؛ با هر استایلی هماهنگ می‌شه",
    earrings: "سبکه و برای استفادهٔ هر روز راحته",
    sets: "چند تکهٔ هماهنگ توی یک جعبهٔ هدیه — انتخابی که فکر پشتشه",
  };
  const opener = gift ? "برای هدیه دادن این‌ها رو دست‌چین کردم 🎁" : formal ? "برای یک استایل رسمی و شیک، این‌ها پیشنهاد منه ✨" : budget ? `با بودجهٔ حدود ${fmt(budget)} تومان، این‌ها بهترین انتخاب‌هان ✨` : "این‌ها رو مخصوص تو انتخاب کردم ✨";
  const lines = picks.map((p, i) => `${["۱", "۲", "۳"][i]}. ${p.name} — ${fmt(p.price)} تومان${p.compareAt ? ` (${Math.round((1 - p.price / p.compareAt) * 100).toLocaleString("fa-IR")}٪ تخفیف)` : ""}\n   ${reasons[p.category] || "یک انتخاب خوش‌سلیقه"}`);
  const total = picks.reduce((sum, p) => sum + p.price, 0);
  const closing = picks.length > 1 ? `\nجمع این ست: ${fmt(total)} تومان.` : "";
  return { reply: `${opener}\n\n${lines.join("\n")}${closing}\n\nکدوم بیشتر به سلیقه‌ات نزدیکه؟ 🙂`, products: picks };
}

export async function stylistReply(message: string, history: { role: "user" | "assistant"; content: string }[] = []): Promise<StylistResult> {
  const config = await getAiConfig();
  const catalog = await getCatalog();
  if (aiOnline(config) && featureOn(config, "stylist") && await budgetLeft(config)) {
    const start = Date.now();
    try {
      const result = await callModel(config, {
        system: stylistSystem(config.assistantName, catalogText(catalog)),
        messages: [...history.slice(-8).map(h => ({ role: h.role, content: h.content.slice(0, 600) })), { role: "user" as const, content: message }],
        maxTokens: Math.min(config.maxTokens, 900), temperature: Math.min(config.temperature + 0.1, 1),
      });
      const productsFound = extractProducts(result.content, catalog);
      await logAi("stylist", "ai", { model: config.model, promptTokens: result.promptTokens, completionTokens: result.completionTokens, durationMs: Date.now() - start });
      return { reply: result.content.replace(/\s*\[\[[a-z0-9-]+\]\]/g, "").trim(), products: productsFound, source: "ai" };
    } catch (error) {
      await logAi("stylist", "error", { model: config.model, durationMs: Date.now() - start, error: error instanceof Error ? error.message : "خطای ناشناخته" });
    }
  }
  const fallback = fallbackStylist(message, catalog);
  await logAi("stylist", "fallback");
  return { ...fallback, source: "fallback" };
}

/* ============================================================
 *  ۲) جستجوی زبان طبیعی
 * ============================================================ */
export type SearchResult = { products: CatalogItem[]; note: string; source: AiSource };

/** امتیازدهی کلیدواژه‌ای برای جستجوی آفلاین */
export function fallbackSearch(query: string, catalog: CatalogItem[]): { products: CatalogItem[]; note: string } {
  const text = normalize(query);
  const budget = /زیر|تا|کمتر|حداکثر|ارزون|ارزان/.test(text) ? parseBudget(query) : null;
  const wantedCategories = detectCategories(query);
  const tokens = text.split(/\s+/).filter(t => t.length > 1 && !["برای", "میخوام", "می‌خوام", "خوام", "یه", "یک", "که", "با", "تا", "زیر", "تومان", "تومن", "هزار", "میلیون"].includes(t));
  const scored = catalog.filter(p => p.stock > 0 && (!budget || p.price <= budget)).map(p => {
    const haystack = normalize(`${p.name} ${p.description} ${p.material} ${categoryName(p.category)} ${p.colors.map(c => c.name).join(" ")}`);
    let score = 0;
    if (wantedCategories.includes(p.category)) score += 6;
    for (const token of tokens) if (haystack.includes(token)) score += 2;
    if (score > 0 && p.featured) score += 1; // منتخب بودن فقط رتبه را بالا می‌برد؛ به‌تنهایی «تطبیق» نیست
    return { p, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  const found = scored.slice(0, 6).map(s => s.p);
  const note = found.length
    ? `${fmt(found.length)} محصول مرتبط پیدا شد${budget ? ` (تا سقف ${fmt(budget)} تومان)` : ""}.`
    : "چیزی دقیقاً مطابق جستجوی شما پیدا نشد؛ عبارت ساده‌تری امتحان کنید.";
  return { products: found, note };
}

export async function smartSearch(query: string): Promise<SearchResult> {
  const config = await getAiConfig();
  const catalog = await getCatalog();
  const key = cacheKey("search", normalize(query));
  if (aiOnline(config) && featureOn(config, "search") && await budgetLeft(config)) {
    const cached = await readCache<{ slugs: string[]; note: string }>(key);
    if (cached) {
      await logAi("search", "cache");
      const bySlug = new Map(catalog.map(p => [p.slug, p]));
      return { products: cached.slugs.map(s => bySlug.get(s)).filter((p): p is CatalogItem => !!p && p.stock > 0), note: cached.note, source: "cache" };
    }
    const start = Date.now();
    try {
      const result = await callModel(config, {
        system: `تو موتور جستجوی فروشگاه اکسسوری کیا هستی. کاربر با زبان طبیعی فارسی جستجو می‌کند. از کاتالوگ زیر فقط محصولات واقعاً مرتبط را انتخاب کن (حداکثر ۶). خروجی فقط JSON با این ساختار: {"slugs":["..."],"note":"یک جملهٔ کوتاه فارسی"}\nکاتالوگ:\n${catalogText(catalog)}`,
        messages: [{ role: "user", content: query.slice(0, 300) }],
        json: true, maxTokens: 300, temperature: 0.2,
      });
      const parsed = JSON.parse(result.content) as { slugs?: unknown; note?: unknown };
      const slugs = Array.isArray(parsed.slugs) ? parsed.slugs.filter((s): s is string => typeof s === "string") : [];
      const bySlug = new Map(catalog.map(p => [p.slug, p]));
      const found = slugs.map(s => bySlug.get(s)).filter((p): p is CatalogItem => !!p && p.stock > 0).slice(0, 6);
      const note = typeof parsed.note === "string" ? parsed.note : "";
      await writeCache(key, "search", { slugs: found.map(p => p.slug), note }, 60 * 6);
      await logAi("search", "ai", { model: config.model, promptTokens: result.promptTokens, completionTokens: result.completionTokens, durationMs: Date.now() - start });
      if (found.length) return { products: found, note, source: "ai" };
    } catch (error) {
      await logAi("search", "error", { model: config.model, durationMs: Date.now() - start, error: error instanceof Error ? error.message : "خطای ناشناخته" });
    }
  }
  const fallback = fallbackSearch(query, catalog);
  await logAi("search", "fallback");
  return { ...fallback, source: "fallback" };
}

/* ============================================================
 *  ۳) پیشنهاد سایز هوشمند — قطعی و بدون توهم
 *  (محاسبه سمت سرور انجام می‌شود؛ عدد از مدل زبانی نمی‌آید)
 * ============================================================ */
export type SizeResult = { size: string; confidence: number; tip: string; reply: string; source: AiSource };

export async function suggestSize(productId: number, input: { height?: number; weight?: number; usualSize?: string }): Promise<SizeResult | null> {
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) return null;
  const sizes = (product.sizes as string[]).filter(s => /^\d+$/.test(s)).map(Number).sort((a, b) => a - b);
  const height = input.height && input.height >= 100 && input.height <= 230 ? input.height : null;
  const weight = input.weight && input.weight >= 30 && input.weight <= 200 ? input.weight : null;

  const pickNearest = (target: number) => sizes.reduce((best, s) => Math.abs(s - target) < Math.abs(best - target) ? s : best, sizes[0]);

  let size = "", confidence = 70, tip = "";
  if (product.category === "belts" && sizes.length) {
    if (!height || !weight) return { size: "", confidence: 0, tip: "برای پیشنهاد دقیق، قد و وزن را وارد کنید.", reply: "قد و وزنت را وارد کن تا سایز دقیق کمربند را حساب کنم.", source: "rule" };
    // برآورد دور کمر (سانتی‌متر) از قد و وزن + ۱۵ سانت اضافهٔ استاندارد کمربند
    const bmi = weight / ((height / 100) ** 2);
    const waist = Math.round(height * 0.4 + (bmi - 22) * 2.2);
    const target = waist + 15;
    const nearest = pickNearest(target);
    size = String(nearest);
    confidence = Math.max(55, 95 - Math.abs(nearest - target) * 3);
    tip = nearest < target ? "اگر بین دو سایز بودی، سایز بزرگ‌تر برای کمربند چرم امن‌تر است." : "کمربند چرم کمی جا باز می‌کند؛ این سایز جای تنظیم دارد.";
  } else if (product.category === "rings" && sizes.length) {
    const usual = parseInt(normalize(input.usualSize || ""), 10);
    if (usual && sizes.includes(usual)) { size = String(usual); confidence = 90; tip = "همان سایز همیشگی‌ات موجود است."; }
    else if (usual) { const nearest = pickNearest(usual); size = String(nearest); confidence = 70; tip = `سایز ${fmt(usual)} موجود نیست؛ نزدیک‌ترین سایز موجود ${fmt(nearest)} است.`; }
    else return { size: "", confidence: 0, tip: "سایز همیشگی انگشترت را وارد کن.", reply: "سایز همیشگی انگشترت را بگو تا نزدیک‌ترین سایز موجود را پیدا کنم. (راهنما: سایز ۸ ≈ ۱۸٫۲ میلی‌متر قطر داخلی، هر سایز ۰٫۸ میلی‌متر بزرگ‌تر)", source: "rule" };
  } else if (product.category === "necklaces" && sizes.length) {
    const target = height ? (height < 165 ? 45 : height < 180 ? 50 : 60) : 50;
    const nearest = pickNearest(target);
    size = String(nearest); confidence = height ? 80 : 65;
    tip = nearest <= 45 ? "این طول، بالای یقه می‌نشیند (چوکر/پرنسسی)." : nearest <= 55 ? "طول متوسط؛ روی اکثر یقه‌ها خوش می‌نشیند." : "طول بلند؛ مناسب لایه‌لایه کردن و یقهٔ باز.";
  } else if (product.category === "bracelets" && sizes.length) {
    const wrist = weight ? (weight < 60 ? 16 : weight < 85 ? 17.5 : 19) : 17.5;
    const nearest = pickNearest(Math.round(wrist + 1.5));
    size = String(nearest); confidence = weight ? 78 : 65;
    tip = "دور مچ + ۱ تا ۲ سانتی‌متر، اندازهٔ راحت دستبند است.";
  } else {
    size = (product.sizes as string[])[0] || "استاندارد"; confidence = 95;
    tip = "این محصول تک‌سایز است و نیاز به انتخاب ندارد.";
  }
  const reply = `📏 سایز پیشنهادی: ${fmt(Number(size)) || size}\n✅ میزان اطمینان: ${fmt(Math.round(confidence))}٪\n💡 نکته: ${tip}`;
  await logAi("size", "rule");
  return { size, confidence: Math.round(confidence), tip, reply, source: "rule" };
}

/* ============================================================
 *  ۴) پیشنهاد هوشمند محصول (مشابه + مکمل / cross-sell)
 *  قطعی و بدون هزینهٔ توکن
 * ============================================================ */
const complementMap: Record<string, string[]> = {
  belts: ["bracelets", "necklaces", "sets"],
  necklaces: ["earrings", "bracelets", "rings"],
  bracelets: ["rings", "necklaces", "belts"],
  rings: ["bracelets", "earrings", "necklaces"],
  earrings: ["necklaces", "rings", "sets"],
  sets: ["belts", "necklaces", "earrings"],
};

export type RecommendResult = { similar: CatalogItem[]; complements: (CatalogItem & { reason: string })[]; note: string; source: AiSource };

export async function recommendFor(productId: number): Promise<RecommendResult | null> {
  const catalog = await getCatalog();
  const product = catalog.find(p => p.id === productId);
  if (!product) return null;
  const inStock = catalog.filter(p => p.id !== product.id && p.stock > 0);
  const similar = inStock.filter(p => p.category === product.category)
    .sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price)).slice(0, 4);
  const wanted = complementMap[product.category] || [];
  const shareColor = (p: CatalogItem) => p.colors.some(c => product.colors.some(pc => pc.name === c.name));
  const complements = wanted.flatMap(category =>
    inStock.filter(p => p.category === category)
      .sort((a, b) => Number(shareColor(b)) - Number(shareColor(a)) || Number(b.featured) - Number(a.featured))
      .slice(0, 2)
  ).slice(0, 4).map(p => ({
    ...p,
    reason: shareColor(p) ? `هم‌رنگ ${product.name} است و ست هماهنگی می‌سازد` : `${categoryName(p.category)} مکمل کلاسیک ${categoryName(product.category)} است`,
  }));
  await logAi("recommend", "rule");
  return { similar, complements, note: complements.length ? `این‌ها با ${product.name} یک ست کامل می‌سازند.` : "", source: "rule" };
}

/* ============================================================
 *  ۵) تولید کپشن (اینستاگرام / تلگرام / صفحه محصول)
 * ============================================================ */
export type CaptionsResult = { instagram: string; telegram: string; page: string; source: AiSource };

const categoryHashtags: Record<string, string> = {
  belts: "#کمربند_چرم #کمربند_مردانه #چرم_طبیعی",
  necklaces: "#گردنبند #زنجیر_استیل #اکسسوری_مردانه",
  bracelets: "#دستبند #دستبند_چرم #اکسسوری",
  rings: "#انگشتر #انگشتر_مردانه #اکسسوری_مینیمال",
  earrings: "#گوشواره #اکسسوری_زنانه #استایل",
  sets: "#ست_هدیه #کادو #هدیه_خاص",
};

export function fallbackCaptions(product: CatalogItem): Omit<CaptionsResult, "source"> {
  const discount = product.compareAt && product.compareAt > product.price ? Math.round((1 - product.price / product.compareAt) * 100) : 0;
  const priceLine = discount ? `💥 ${fmt(discount)}٪ تخفیف: ${fmt(product.price)} تومان (قبلاً ${fmt(product.compareAt!)})` : `💰 ${fmt(product.price)} تومان`;
  return {
    instagram: `✨ ${product.name} ✨\n\nجزئیات کوچیک، تفاوت‌های بزرگ.\n${product.material} — ساخته شده برای هر روزِ استایل تو.\n\n${priceLine}\n🚚 ارسال به سراسر ایران\n\n${categoryHashtags[product.category] || "#اکسسوری"} #کیا_اکسسوری #استایل`,
    telegram: `🖤 ${product.name}\n${product.material}\n${priceLine}\n\nهمین حالا از ربات کیا سفارش بده 👇\n@KiyaAccessoryBot`,
    page: `${product.name} با ${product.material}، انتخابی است که استایل روزمره را بی‌سروصدا خاص می‌کند. ${discount ? `همین حالا با ${fmt(discount)}٪ تخفیف در دسترس است. ` : ""}با ۷ روز ضمانت بازگشت، بدون ریسک امتحانش کن.`,
  };
}

export async function generateCaptions(productId: number): Promise<CaptionsResult | null> {
  const catalog = await getCatalog();
  const product = catalog.find(p => p.id === productId);
  if (!product) return null;
  const config = await getAiConfig();
  if (aiOnline(config) && featureOn(config, "captions") && await budgetLeft(config)) {
    const start = Date.now();
    try {
      const result = await callModel(config, {
        system: `برای محصول فروشگاه اکسسوری کیا سه کپشن فارسی بنویس. خروجی فقط JSON: {"instagram":"...","telegram":"...","page":"..."}
- instagram: با ایموجی و ۳-۴ هشتگ فارسی، حس‌برانگیز
- telegram: کوتاه با دعوت به خرید از ربات
- page: ۳ خط فروشندگی بر اساس فایده‌ها، بدون ایموجی`,
        messages: [{ role: "user", content: `محصول: ${product.name} | جنس: ${product.material} | دسته: ${categoryName(product.category)} | قیمت: ${fmt(product.price)} تومان${product.compareAt ? ` | قیمت قبل: ${fmt(product.compareAt)}` : ""} | توضیح: ${product.description.slice(0, 300)}` }],
        json: true, maxTokens: 600, temperature: 0.8,
      });
      const parsed = JSON.parse(result.content) as Record<string, unknown>;
      await logAi("captions", "ai", { model: config.model, promptTokens: result.promptTokens, completionTokens: result.completionTokens, durationMs: Date.now() - start });
      if (typeof parsed.instagram === "string" && typeof parsed.telegram === "string" && typeof parsed.page === "string") {
        return { instagram: parsed.instagram, telegram: parsed.telegram, page: parsed.page, source: "ai" };
      }
    } catch (error) {
      await logAi("captions", "error", { model: config.model, durationMs: Date.now() - start, error: error instanceof Error ? error.message : "خطای ناشناخته" });
    }
  }
  await logAi("captions", "fallback");
  return { ...fallbackCaptions(product), source: "fallback" };
}

/* ============================================================
 *  ۶) تحلیل ترند — آمار واقعی فروش + روایت مدل
 * ============================================================ */
export type TrendStats = {
  period: string;
  categories: { category: string; name: string; recentQty: number; previousQty: number; recentRevenue: number; growth: number | null }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  demandSignals: { name: string; waiting: number }[];
  abandonedTotal: number;
};
export type TrendsResult = { report: string; stats: TrendStats; source: AiSource };

async function computeTrendStats(): Promise<TrendStats> {
  const now = Date.now();
  const recentStart = new Date(now - 30 * 86400000);
  const previousStart = new Date(now - 60 * 86400000);
  const allOrders = await db.select({ items: orders.items, createdAt: orders.createdAt, status: orders.status })
    .from(orders).where(gte(orders.createdAt, previousStart));
  const catalog = await getCatalog();
  const byId = new Map(catalog.map(p => [p.id, p]));
  const categoryAggregate = new Map<string, { recentQty: number; previousQty: number; recentRevenue: number }>();
  const productAggregate = new Map<string, { qty: number; revenue: number }>();
  for (const order of allOrders) {
    if (order.status === "canceled") continue;
    const recent = order.createdAt >= recentStart;
    for (const item of order.items as { productId: number; name: string; quantity: number; price: number }[]) {
      const category = byId.get(item.productId)?.category || "other";
      const entry = categoryAggregate.get(category) || { recentQty: 0, previousQty: 0, recentRevenue: 0 };
      if (recent) { entry.recentQty += item.quantity; entry.recentRevenue += item.quantity * item.price; }
      else entry.previousQty += item.quantity;
      categoryAggregate.set(category, entry);
      if (recent) {
        const productEntry = productAggregate.get(item.name) || { qty: 0, revenue: 0 };
        productEntry.qty += item.quantity; productEntry.revenue += item.quantity * item.price;
        productAggregate.set(item.name, productEntry);
      }
    }
  }
  const waiting = await db.select({ productId: stockAlerts.productId, count: sql<number>`count(*)` })
    .from(stockAlerts).where(sql`${stockAlerts.notifiedAt} is null`).groupBy(stockAlerts.productId);
  const [abandoned] = await db.select({ count: sql<number>`count(*)` })
    .from(abandonedCarts).where(and(sql`${abandonedCarts.recoveredAt} is null`, gte(abandonedCarts.createdAt, recentStart)));
  return {
    period: "۳۰ روز اخیر در مقایسه با ۳۰ روز قبل از آن",
    categories: [...categoryAggregate.entries()].map(([category, v]) => ({
      category, name: categoryName(category), ...v,
      growth: v.previousQty ? Math.round(((v.recentQty - v.previousQty) / v.previousQty) * 100) : (v.recentQty ? null : 0),
    })).sort((a, b) => b.recentQty - a.recentQty),
    topProducts: [...productAggregate.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 5),
    demandSignals: waiting.map(w => ({ name: byId.get(w.productId)?.name || `محصول ${w.productId}`, waiting: Number(w.count) })).sort((a, b) => b.waiting - a.waiting).slice(0, 5),
    abandonedTotal: Number(abandoned?.count ?? 0),
  };
}

export function fallbackTrendReport(stats: TrendStats): string {
  const rising = stats.categories.filter(c => (c.growth ?? 1) > 0 && c.recentQty > 0).slice(0, 3);
  const falling = stats.categories.filter(c => (c.growth ?? 0) < 0).slice(0, 2);
  const lines: string[] = [`📊 تحلیل فروش (${stats.period})`, ""];
  lines.push("🔥 دسته‌های پرتقاضا:");
  lines.push(...(rising.length ? rising.map(c => `• ${c.name}: ${fmt(c.recentQty)} فروش${c.growth !== null && c.previousQty ? ` (رشد ${fmt(c.growth)}٪)` : ""} — درآمد ${fmt(c.recentRevenue)} تومان`) : ["• هنوز فروش کافی برای تحلیل ثبت نشده است."]));
  if (falling.length) { lines.push("", "📉 دسته‌های در حال افت:"); lines.push(...falling.map(c => `• ${c.name}: ${fmt(c.growth ?? 0)}٪ نسبت به دورهٔ قبل`)); }
  if (stats.topProducts.length) { lines.push("", "⭐ پرفروش‌ترین محصولات:"); lines.push(...stats.topProducts.map(p => `• ${p.name} — ${fmt(p.qty)} عدد`)); }
  if (stats.demandSignals.length) { lines.push("", "🔔 تقاضای در انتظار (هشدار موجودی):"); lines.push(...stats.demandSignals.map(d => `• ${d.name} — ${fmt(d.waiting)} نفر منتظر`)); }
  lines.push("", `🛒 سبدهای رهاشدهٔ ۳۰ روز اخیر: ${fmt(stats.abandonedTotal)}`);
  lines.push("", "🎯 پیشنهاد: موجودی دسته‌های پرتقاضا را تقویت کنید و برای محصولات دارای لیست انتظار، اطلاع‌رسانی «موجود شد» را فعال نگه دارید.");
  return lines.join("\n");
}

export async function analyzeTrends(): Promise<TrendsResult> {
  const stats = await computeTrendStats();
  const config = await getAiConfig();
  if (aiOnline(config) && featureOn(config, "trends") && await budgetLeft(config)) {
    const start = Date.now();
    try {
      const result = await callModel(config, {
        system: `تو تحلیلگر ترند فروشگاه اکسسوری کیا در بازار ایران هستی. بر اساس دادهٔ واقعی زیر گزارش فارسی بده با بخش‌های: 🔥 ترندهای در حال رشد، 📉 در حال افت، 🎯 ۳ پیشنهاد عملی برای خرید/موجودی، 📝 ۳ ایده محتوا برای اینستاگرام و تلگرام. همهٔ اعداد با ارقام فارسی و تومان. حداکثر ۲۰ خط.`,
        messages: [{ role: "user", content: JSON.stringify(stats) }],
        maxTokens: 800, temperature: 0.5,
      });
      await logAi("trends", "ai", { model: config.model, promptTokens: result.promptTokens, completionTokens: result.completionTokens, durationMs: Date.now() - start });
      return { report: result.content, stats, source: "ai" };
    } catch (error) {
      await logAi("trends", "error", { model: config.model, durationMs: Date.now() - start, error: error instanceof Error ? error.message : "خطای ناشناخته" });
    }
  }
  await logAi("trends", "fallback");
  return { report: fallbackTrendReport(stats), stats, source: "fallback" };
}

/* ============================================================
 *  داشبورد پنل مدیریت
 * ============================================================ */
export async function getAiDashboard() {
  await db.insert(aiSettings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1));
  const config = await getAiConfig();
  const logs = await db.select().from(aiLogs).orderBy(desc(aiLogs.id)).limit(60);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const usage = await db.select({
    feature: aiLogs.feature,
    calls: sql<number>`count(*)`,
    tokens: sql<number>`coalesce(sum(${aiLogs.promptTokens} + ${aiLogs.completionTokens}), 0)`,
  }).from(aiLogs).where(gte(aiLogs.createdAt, monthStart)).groupBy(aiLogs.feature);
  const [cacheStats] = await db.select({ entries: sql<number>`count(*)`, hits: sql<number>`coalesce(sum(${aiCache.hits}), 0)` }).from(aiCache);
  return {
    settings: {
      enabled: row.enabled, baseUrl: row.baseUrl, model: row.model,
      hasKey: !!(row.apiKey || process.env.AI_API_KEY),
      keyHint: row.apiKey ? `•••${row.apiKey.slice(-4)}` : (process.env.AI_API_KEY ? "از env" : ""),
      temperature: row.temperature, maxTokens: row.maxTokens, monthlyTokenBudget: row.monthlyTokenBudget,
      features: row.features, assistantName: row.assistantName,
      envBaseUrl: process.env.AI_BASE_URL || "", envModel: process.env.AI_MODEL || "",
    },
    online: aiOnline(config),
    effectiveModel: config.model,
    logs,
    usage: usage.map(u => ({ ...u, calls: Number(u.calls), tokens: Number(u.tokens) })),
    monthlyTokens: usage.reduce((sum, u) => sum + Number(u.tokens), 0),
    cache: { entries: Number(cacheStats?.entries ?? 0), hits: Number(cacheStats?.hits ?? 0) },
  };
}

/** تست اتصال از پنل */
export async function testAiConnection(): Promise<{ ok: boolean; message: string; latency?: number }> {
  const config = await getAiConfig();
  if (!aiOnline(config)) return { ok: false, message: "سرویس AI پیکربندی نشده (آدرس یا کلید خالی است). موتور آفلاین فعال است." };
  const start = Date.now();
  try {
    const result = await callModel(config, { system: "فقط بنویس: سلام از کیا", messages: [{ role: "user", content: "تست" }], maxTokens: 20, temperature: 0 });
    await logAi("test", "ai", { model: config.model, promptTokens: result.promptTokens, completionTokens: result.completionTokens, durationMs: Date.now() - start });
    return { ok: true, message: `اتصال برقرار است — پاسخ مدل «${config.model}»: ${result.content.slice(0, 80)}`, latency: Date.now() - start };
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای ناشناخته";
    await logAi("test", "error", { model: config.model, durationMs: Date.now() - start, error: message });
    return { ok: false, message: `اتصال برقرار نشد: ${message.slice(0, 200)}` };
  }
}
