import { suggestSize, getAiConfig, featureOn } from "@/lib/ai";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";
export const dynamic = "force-dynamic";

/* ============================================================
 *  پیشنهاد سایز هوشمند — فاز ۱۱ (محاسبهٔ قطعی، بدون توهم)
 *  POST: { productId, height?, weight?, usualSize? }
 * ============================================================ */

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`ai-size:${clientIp(request)}`, 30, 10 * 60 * 1000)) {
    return Response.json({ error: "تعداد درخواست‌ها زیاد شد؛ کمی بعد دوباره تلاش کن." }, { status: 429 });
  }
  try {
    const config = await getAiConfig();
    if (!featureOn(config, "size")) return Response.json({ error: "پیشنهاد سایز فعلاً غیرفعال است." }, { status: 403 });
    const body = await request.json();
    const productId = Number(body.productId);
    if (!Number.isSafeInteger(productId) || productId < 1) return Response.json({ error: "محصول معتبر نیست." }, { status: 400 });
    const result = await suggestSize(productId, {
      height: Number(body.height) || undefined,
      weight: Number(body.weight) || undefined,
      usualSize: String(body.usualSize || "").slice(0, 20),
    });
    if (!result) return Response.json({ error: "محصول پیدا نشد." }, { status: 404 });
    return Response.json(result);
  } catch (error) { return apiError(error); }
}
