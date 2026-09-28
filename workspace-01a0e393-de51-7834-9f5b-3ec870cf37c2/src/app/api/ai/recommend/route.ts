import { recommendFor, getAiConfig, featureOn } from "@/lib/ai";
import { allowRequest, apiError, clientIp } from "@/lib/server-store";
export const dynamic = "force-dynamic";

/* ============================================================
 *  پیشنهاد محصول مشابه و مکمل — فاز ۱۱ (قطعی، بدون هزینهٔ توکن)
 *  GET: ?productId=… → { similar, complements, note }
 * ============================================================ */

const publicFields = (p: { id: number; slug: string; name: string; price: number; compareAt: number | null; image: string; category: string; stock: number }) =>
  ({ id: p.id, slug: p.slug, name: p.name, price: p.price, compareAt: p.compareAt, image: p.image, category: p.category, stock: p.stock });

export async function GET(request: Request) {
  if (!allowRequest(`ai-recommend:${clientIp(request)}`, 60, 10 * 60 * 1000)) {
    return Response.json({ error: "تعداد درخواست‌ها زیاد شد." }, { status: 429 });
  }
  try {
    const config = await getAiConfig();
    if (!featureOn(config, "recommend")) return Response.json({ similar: [], complements: [], note: "" });
    const productId = Number(new URL(request.url).searchParams.get("productId"));
    if (!Number.isSafeInteger(productId) || productId < 1) return Response.json({ error: "محصول معتبر نیست." }, { status: 400 });
    const result = await recommendFor(productId);
    if (!result) return Response.json({ error: "محصول پیدا نشد." }, { status: 404 });
    return Response.json({
      note: result.note, source: result.source,
      similar: result.similar.map(publicFields),
      complements: result.complements.map(p => ({ ...publicFields(p), reason: p.reason })),
    });
  } catch (error) { return apiError(error); }
}
