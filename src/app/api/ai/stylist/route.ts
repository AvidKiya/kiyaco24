import { stylistReply, getAiConfig, featureOn } from "@/lib/ai";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";
export const dynamic = "force-dynamic";

/* ============================================================
 *  چت مشاور استایل — فاز ۱۱
 *  GET: وضعیت (برای نمایش/مخفی‌کردن ویجت)
 *  POST: { message, history? } → { reply, products, source }
 * ============================================================ */

export async function GET() {
  try {
    const config = await getAiConfig();
    return Response.json({ enabled: featureOn(config, "stylist"), name: config.assistantName });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`ai-stylist:${clientIp(request)}`, 20, 10 * 60 * 1000)) {
    return Response.json({ error: "تعداد پیام‌ها زیاد شد؛ چند دقیقه بعد دوباره تلاش کن." }, { status: 429 });
  }
  try {
    const config = await getAiConfig();
    if (!featureOn(config, "stylist")) return Response.json({ error: "مشاور استایل فعلاً غیرفعال است." }, { status: 403 });
    const body = await request.json();
    const message = String(body.message || "").trim().slice(0, 500);
    if (message.length < 2) return Response.json({ error: "پیام کوتاه است." }, { status: 400 });
    const history = Array.isArray(body.history)
      ? body.history.slice(-8).map((h: { role?: unknown; content?: unknown }) => ({
          role: h.role === "assistant" ? "assistant" as const : "user" as const,
          content: String(h.content || "").slice(0, 600),
        }))
      : [];
    const result = await stylistReply(message, history);
    return Response.json({
      reply: result.reply,
      source: result.source,
      products: result.products.map(p => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, compareAt: p.compareAt, image: p.image, category: p.category, stock: p.stock })),
    });
  } catch (error) { return apiError(error); }
}
