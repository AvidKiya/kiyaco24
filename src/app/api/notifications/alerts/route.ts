import { validOrigin, allowRequest, clientIp, apiError } from "@/lib/server-store";
import { db } from "@/db";
import { products, stockAlerts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isValidIranPhone } from "@/lib/customer";
import { trackAbandonedCart } from "@/lib/notify";
export const dynamic = "force-dynamic";

/* فاز ۱۰ — درخواست اطلاع‌رسانی مشتری:
 *  subscribe  → «وقتی موجود شد / قیمتش کم شد بگو»
 *  track-cart  → ثبت سبد رهاشده برای یادآوری خودکار
 */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`stock-alert:${clientIp(request)}`, 20)) return Response.json({ error: "تلاش‌های زیاد. کمی بعد دوباره امتحان کنید." }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "subscribe");

    if (action === "track-cart") {
      const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
      if (!items.length) return Response.json({ error: "سبد خرید خالی است." }, { status: 400 });
      await trackAbandonedCart({
        phone: String(body.phone || "").slice(0, 20),
        customerId: body.customerId ? Number(body.customerId) : undefined,
        items: items.map((item: { productId: unknown; name: unknown; image: unknown; price: unknown; quantity: unknown; size: unknown; color: unknown }) => ({
          productId: Number(item.productId) || 0, name: String(item.name || "").slice(0, 160), image: String(item.image || "").slice(0, 500),
          price: Number(item.price) || 0, quantity: Number(item.quantity) || 1, size: String(item.size || "").slice(0, 30), color: String(item.color || "").slice(0, 30),
        })),
        total: Number(body.total) || 0,
        step: String(body.step || "cart").slice(0, 20),
      });
      return Response.json({ ok: true, message: "سبد شما ثبت شد؛ اگر خرید را کامل نکنید یادآوری می‌کنیم." });
    }

    const productId = Number(body.productId);
    if (!Number.isSafeInteger(productId) || productId <= 0) return Response.json({ error: "محصول را انتخاب کنید." }, { status: 400 });
    const [product] = await db.select({ id: products.id, name: products.name }).from(products).where(and(eq(products.id, productId), eq(products.active, true))).limit(1);
    if (!product) return Response.json({ error: "محصول پیدا نشد." }, { status: 404 });

    const type = body.type === "price_drop" ? "price_drop" : "back_in_stock";
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim().slice(0, 200);
    if (!isValidIranPhone(phone) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return Response.json({ error: "شماره موبایل یا ایمیل معتبر وارد کنید." }, { status: 400 });
    }

    const existing = await db.select().from(stockAlerts).where(and(eq(stockAlerts.productId, productId), eq(stockAlerts.type, type))).limit(50);
    if (existing.some(row => (phone && row.phone === phone) || (email && row.email === email))) {
      return Response.json({ ok: true, message: "قبلاً ثبت شده بود؛ به‌محض تغییر خبرش می‌کنیم." });
    }

    await db.insert(stockAlerts).values({ productId, type, phone: isValidIranPhone(phone) ? phone : "", email, priceAtRequest: Number(body.priceAtRequest) || 0 });
    return Response.json({ ok: true, message: type === "price_drop" ? "اگر قیمت «" + product.name + "» کم شود بهت خبر می‌دهیم." : "اگر «" + product.name + "» موجود شد بهت خبر می‌دهیم." });
  } catch (error) {
    return apiError(error, "ثبت درخواست اطلاع‌رسانی انجام نشد.");
  }
}
