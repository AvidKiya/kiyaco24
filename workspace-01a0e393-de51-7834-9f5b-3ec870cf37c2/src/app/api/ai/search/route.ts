import { smartSearch, getAiConfig, featureOn } from "@/lib/ai";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";
export const dynamic = "force-dynamic";

/* ============================================================
 *  جستجوی زبان طبیعی — فاز ۱۱
 *  POST: { query } → { products, note, source }
 * ============================================================ */

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`ai-search:${clientIp(request)}`, 30, 10 * 60 * 1000)) {
    return Response.json({ error: "تعداد جستجوها زیاد شد؛ کمی بعد دوباره تلاش کن." }, { status: 429 });
  }
  try {
    const config = await getAiConfig();
    if (!featureOn(config, "search")) return Response.json({ error: "جستجوی هوشمند فعلاً غیرفعال است." }, { status: 403 });
    const body = await request.json();
    const query = String(body.query || "").trim().slice(0, 300);
    if (query.length < 2) return Response.json({ error: "عبارت جستجو کوتاه است." }, { status: 400 });
    const result = await smartSearch(query);
    return Response.json({
      note: result.note,
      source: result.source,
      products: result.products.map(p => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, compareAt: p.compareAt, image: p.image, category: p.category, stock: p.stock })),
    });
  } catch (error) { return apiError(error); }
}
