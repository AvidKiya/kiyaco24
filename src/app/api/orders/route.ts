import { db } from "@/db";
import { products, orders, settings, customers, walletTxns, type OrderItem } from "@/db/schema";
import { getCurrentCustomer, recordCustomerOrder } from "@/lib/customer";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { allowRequest, apiError, clientIp, ensureStore, validOrigin } from "@/lib/server-store";
import { digits } from "@/lib/catalog";
import { evaluateCoupon, evaluateGiftCard, consumeCoupon, redeemGiftCard } from "@/lib/discount";
import { recordEvent } from "@/lib/analytics";
export const dynamic = "force-dynamic";
class OrderError extends Error {}

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`order:${clientIp(request)}`, 15, 600000)) return Response.json({ error: "لطفاً چند دقیقه دیگر تلاش کنید." }, { status: 429 });
  try {
    await ensureStore();
    const body = await request.json();
    const customerName = String(body.name || "").trim().slice(0, 100);
    const phone = digits(String(body.phone || "")).replace(/\s/g, "");
    const city = String(body.city || "").trim().slice(0, 100);
    const address = String(body.address || "").trim().slice(0, 600);
    const postalCode = digits(String(body.postalCode || "")).replace(/\s/g, "");
    const delivery = body.delivery === "pickup" ? "pickup" : body.delivery === "courier" ? "courier" : "shipping";
    const requestKey = String(body.requestKey || "");
    if (customerName.length < 3 || !/^09\d{9}$/.test(phone)) throw new OrderError("نام کامل و شماره موبایل معتبر وارد کنید.");
    if (delivery === "shipping" && (city.length < 2 || address.length < 8 || !/^\d{10}$/.test(postalCode))) throw new OrderError("شهر، آدرس کامل و کد پستی ۱۰ رقمی را وارد کنید.");
    if (delivery === "courier" && address.length < 8) throw new OrderError("برای ارسال با پیک، نشانی کامل را وارد کنید.");
    if (!/^[a-f\d-]{36}$/i.test(requestKey)) throw new OrderError("شناسه سفارش معتبر نیست. صفحه را تازه‌سازی کنید.");
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 30) throw new OrderError("سبد خرید شما خالی یا نامعتبر است.");
    const input: { productId: number; quantity: number; size: string; color: string }[] = body.items.map((item: Record<string, unknown>) => ({ productId: Number(item.productId), quantity: Number(item.quantity), size: String(item.size || ""), color: String(item.color || "") }));
    if (input.some(i => !Number.isSafeInteger(i.productId) || !Number.isSafeInteger(i.quantity) || i.quantity < 1 || i.quantity > 10)) throw new OrderError("تعداد محصول معتبر نیست.");
    const account = await getCurrentCustomer();
    const result = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${requestKey}))`);
      const previous = await tx.select().from(orders).where(eq(orders.requestKey, requestKey)).limit(1);
      if (previous[0]) {
        if (previous[0].phone !== phone) throw new OrderError("شناسه سفارش تکراری است.");
        return { code: previous[0].code, total: previous[0].total, repeated: true };
      }
      const ids = [...new Set(input.map(i => i.productId))];
      const catalog = await tx.select().from(products).where(inArray(products.id, ids)).orderBy(asc(products.id)).for("update");
      const config = (await tx.select().from(settings).where(eq(settings.id, 1)))[0];
      if (delivery === "pickup" && !config.address) throw new OrderError("تحویل حضوری هنوز توسط فروشگاه فعال نشده است.");
      if (delivery === "courier" && config.payment?.courierEnabled !== true) throw new OrderError("ارسال با پیک شهری فعلاً فعال نیست.");
      const quantities = new Map<number, number>();
      const items: OrderItem[] = input.map(i => {
        const p = catalog.find(p => p.id === i.productId);
        if (!p || !p.active) throw new OrderError("یکی از محصولات دیگر در دسترس نیست.");
        const quantity = (quantities.get(p.id) || 0) + i.quantity;
        quantities.set(p.id, quantity);
        if (quantity > p.stock || quantity > 10) throw new OrderError(`موجودی «${p.name}» کافی نیست. سبد خرید را اصلاح کنید.`);
        if (p.sizes.length && !p.sizes.includes(i.size)) throw new OrderError(`سایز «${p.name}» معتبر نیست.`);
        if (p.colors.length && !p.colors.some(c => c.name === i.color)) throw new OrderError(`رنگ «${p.name}» معتبر نیست.`);
        return { productId: p.id, name: p.name, image: p.image, price: p.price, quantity: i.quantity, size: i.size, color: i.color };
      });
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      /* ---- فاز ۵: تخفیف با موتور مشترک؛ همهٔ قواعد سمت سرور ---- */
      const lines = items.map(item => ({ productId: item.productId, price: item.price, quantity: item.quantity, category: catalog.find(p => p.id === item.productId)?.category }));
      let discount = 0;
      const couponCode = String(body.coupon || "").trim().toUpperCase();
      if (couponCode) {
        const couponResult = await evaluateCoupon(couponCode, { subtotal, lines, phone });
        if (!couponResult.ok) throw new OrderError(couponResult.reason);
        discount = couponResult.amount;
        await consumeCoupon(tx, couponCode);
      }

      // گیفت‌کارت: اعتبار هدیه روی مبلغ باقی‌مانده
      let giftCardCode = "";
      let giftCardAmount = 0;
      const giftCardInput = String(body.giftCard || "").trim().toUpperCase();
      if (giftCardInput) {
        const cardResult = await evaluateGiftCard(giftCardInput, { subtotal: Math.max(0, subtotal - discount) });
        if (!cardResult.ok) throw new OrderError(cardResult.reason);
        giftCardAmount = cardResult.amount;
        discount += cardResult.amount;
        giftCardCode = cardResult.code;
      }

      const code = `K-${randomBytes(5).toString("hex").toUpperCase()}`;

      /* ---- فاز ۹: پرداخت با اعتبار کیف پول ---- */
      let walletUsed = 0;
      if (account && body.useWallet === true && account.walletBalance > 0) {
        walletUsed = Math.min(account.walletBalance, Math.max(0, subtotal - discount));
        if (walletUsed > 0) {
          const spent = await tx.update(customers).set({ walletBalance: sql`${customers.walletBalance} - ${walletUsed}` })
            .where(and(eq(customers.id, account.id), sql`${customers.walletBalance} >= ${walletUsed}`)).returning({ balance: customers.walletBalance });
          if (!spent.length) walletUsed = 0;
          else await tx.insert(walletTxns).values({ customerId: account.id, amount: -walletUsed, kind: "debit", note: "پرداخت سفارش", orderCode: code });
        }
      }

      const shipping = delivery === "courier" ? (Number(config.payment?.courierCost) || 0) : delivery === "pickup" || subtotal >= config.shippingThreshold ? 0 : config.shippingCost;
      const total = subtotal - discount + shipping - walletUsed;
      if (!Number.isSafeInteger(total) || subtotal > 2000000000 || total > 2000000000) throw new OrderError("مبلغ سفارش از سقف ثبت آنلاین بیشتر است. برای هماهنگی سفارش عمده به پشتیبانی پیام دهید.");
      const giftMessage = String(body.giftMessage || "").slice(0, 400);
      const giftWrap = body.giftWrap === true;
      await tx.insert(orders).values({ code, requestKey, customerId: account?.id ?? null, customerName, phone, city: delivery === "pickup" ? "تحویل حضوری" : delivery === "courier" ? (city || "پیک شهری") : city, address: delivery === "pickup" ? config.address : address, postalCode, items, subtotal, discount, shipping, total, coupon: couponCode || null, delivery, note: String(body.note || "").slice(0, 600), giftMessage, giftWrap, giftCard: giftCardCode });
      for (const [id, quantity] of quantities) await tx.update(products).set({ stock: sql`${products.stock} - ${quantity}` }).where(eq(products.id, id));
      if (giftCardCode && giftCardAmount > 0) await redeemGiftCard(tx, giftCardCode, giftCardAmount, phone, code);
      return { code, total, repeated: false };
    });
    if (!result.repeated && account) await recordCustomerOrder(account.id, result.total, result.code);
    if (!result.repeated) await recordEvent("purchase", result.code, result.total).catch(() => {}); // فاز ۱۵ — آمار فروش
    if (!result.repeated && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      after(async () => {
        try {
          const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: `سفارش جدید کیا\n${result.code}\n${customerName}\n${phone}\nمبلغ: ${result.total.toLocaleString("fa-IR")} تومان\nدر انتظار تأیید فروشگاه` }), signal: AbortSignal.timeout(8000) });
          if (!response.ok) console.error("Telegram notification could not be delivered");
        } catch { console.error("Telegram notification unavailable"); }
      });
    }
    return Response.json({ ok: true, code: result.code, total: result.total });
  } catch (error) {
    if (error instanceof OrderError || error instanceof SyntaxError) return Response.json({ error: error instanceof OrderError ? error.message : "درخواست معتبر نیست." }, { status: 400 });
    return apiError(error);
  }
}
