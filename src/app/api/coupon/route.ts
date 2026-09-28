import { evaluateCoupon, evaluateGiftCard } from "@/lib/discount";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";
import { digits } from "@/lib/catalog";
export const dynamic = "force-dynamic";

/* ============================================================
 *  بررسی کد تخفیف یا گیفت‌کارت با context کامل سبد (فاز ۵)
 * ============================================================ */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`coupon:${clientIp(request)}`, 40)) return Response.json({ error: "کمی بعد دوباره تلاش کنید." }, { status: 429 });
  try {
    const body = await request.json();
    const lines = Array.isArray(body.lines)
      ? body.lines.map((line: Record<string, unknown>) => ({
          productId: Number(line.productId),
          price: Number(line.price),
          quantity: Number(line.quantity),
          category: line.category ? String(line.category) : undefined,
        })).filter((line: { productId: number; price: number; quantity: number }) => Number.isFinite(line.productId) && Number.isFinite(line.price) && Number.isFinite(line.quantity))
      : [];
    const subtotal = lines.reduce((sum: number, line: { price: number; quantity: number }) => sum + line.price * line.quantity, 0);
    const phone = digits(String(body.phone || ""));

    // گیفت‌کارت
    if (body.giftCard) {
      const card = await evaluateGiftCard(body.giftCard, { subtotal });
      if (!card.ok) return Response.json({ error: card.reason }, { status: 400 });
      return Response.json({ code: card.code, amount: card.amount, type: "fixed", percent: 0, label: card.label });
    }

    // کد تخفیف
    const result = await evaluateCoupon(body.code, { subtotal, lines, phone });
    if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });

    return Response.json({
      code: result.code,
      percent: result.type === "percent" ? result.percent : 0,
      amount: result.amount,
      type: result.type,
      label: result.label,
    });
  } catch (error) {
    return apiError(error, "بررسی کد تخفیف انجام نشد.");
  }
}
