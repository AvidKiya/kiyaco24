import "server-only";
import { db } from "@/db";
import { coupons, giftCards, giftCardUses, orders } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

/* ============================================================
 *  فاز ۵ — موتور تخفیف: کوپن پیشرفته + گیفت‌کارت
 *  همهٔ قواعد سمت سرور اعتبارسنجی می‌شوند.
 * ============================================================ */

export type CartLine = { productId: number; price: number; quantity: number; category?: string };

export type DiscountResult =
  | { ok: true; code: string; type: "percent" | "fixed"; percent: number; amount: number; label: string }
  | { ok: false; reason: string };

const fail = (reason: string): DiscountResult => ({ ok: false, reason });

/**
 * ارزیابی کامل یک کد تخفیف در برابر سبد واقعی
 */
export async function evaluateCoupon(rawCode: unknown, context: { subtotal: number; lines: CartLine[]; phone?: string }): Promise<DiscountResult> {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return fail("کد تخفیف معتبر نیست.");
  if (!Number.isFinite(context.subtotal) || context.subtotal <= 0) return fail("سبد خرید خالی است.");

  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
  if (!coupon || !coupon.active) return fail("این کد تخفیف معتبر نیست.");
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return fail("مهلت استفاده از این کد تمام شده است.");
  if (coupon.used >= coupon.maxUses) return fail("ظرفیت استفاده از این کد تخفیف تمام شده است.");

  // حداقل مبلغ سفارش
  if (coupon.minOrder > 0 && context.subtotal < coupon.minOrder) {
    return fail(`این کد برای سفارش‌های بالای ${coupon.minOrder.toLocaleString("fa-IR")} تومان فعال می‌شود.`);
  }

  // محدودیت دسته یا محصول
  const lines = context.lines;
  if (coupon.categoryIds.length) {
    const eligible = lines.filter(line => line.category && coupon.categoryIds.includes(line.category));
    if (!eligible.length) return fail("این کد فقط برای دسته‌بندی‌های خاصی از محصولات معتبر است.");
  }
  if (coupon.productIds.length) {
    const eligible = lines.filter(line => coupon.productIds.includes(line.productId));
    if (!eligible.length) return fail("این کد فقط برای محصولات مشخص‌شده معتبر است.");
  }

  // سقف استفادهٔ هر مشتری
  const phone = String(context.phone || "").replace(/\D/g, "");
  if (coupon.perUserLimit > 0 && /^09\d{9}$/.test(phone)) {
    const [usage] = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.coupon, code), eq(orders.phone, phone)));
    if ((usage?.count ?? 0) >= coupon.perUserLimit) return fail("شما قبلاً از این کد استفاده کرده‌اید.");
  }

  // فقط اولین سفارش
  if (coupon.firstOrderOnly && /^09\d{9}$/.test(phone)) {
    const [previous] = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.phone, phone), ne(orders.status, "cancelled")));
    if ((previous?.count ?? 0) > 0) return fail("این کد فقط برای اولین سفارش شماست.");
  }

  // محاسبهٔ مبلغ تخفیف
  const type = coupon.type === "fixed" ? "fixed" : "percent";
  let amount: number;
  if (type === "fixed") {
    amount = Math.min(coupon.percent, context.subtotal); // در حالت مبلغی، «percent» مقدار ثابت تومان است
  } else {
    amount = Math.floor((context.subtotal * coupon.percent) / 100);
    if (coupon.maxDiscount > 0) amount = Math.min(amount, coupon.maxDiscount);
  }
  amount = Math.max(0, Math.min(amount, context.subtotal));
  if (amount <= 0) return fail("این کد برای سفارش شما تخفیفی ندارد.");

  const label = type === "fixed"
    ? `${amount.toLocaleString("fa-IR")} تومان تخفیف`
    : `${coupon.percent.toLocaleString("fa-IR")}٪ تخفیف`;

  return { ok: true, code: coupon.code, type, percent: coupon.percent, amount, label };
}

/**
 * ارزیابی گیفت‌کارت و کسر از اعتبار
 */
export async function evaluateGiftCard(rawCode: unknown, context: { subtotal: number }): Promise<DiscountResult> {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return fail("کد گیفت‌کارت را وارد کنید.");
  if (!Number.isFinite(context.subtotal) || context.subtotal <= 0) return fail("سبد خرید خالی است.");

  const [card] = await db.select().from(giftCards).where(eq(giftCards.code, code));
  if (!card || !card.active) return fail("این گیفت‌کارت معتبر نیست.");
  if (card.expiresAt && new Date(card.expiresAt).getTime() < Date.now()) return fail("مهلت استفاده از این گیفت‌کارت تمام شده است.");
  if (card.balance <= 0) return fail("اعتبار این گیفت‌کارت تمام شده است.");

  const amount = Math.min(card.balance, context.subtotal);
  if (amount <= 0) return fail("اعتبار این گیفت‌کارت برای سفارش شما کافی نیست.");

  return {
    ok: true,
    code: card.code,
    type: "fixed",
    percent: amount,
    amount,
    label: `${card.balance.toLocaleString("fa-IR")} تومان اعتبار هدیه`,
  };
}

/**
 * کسر اعتبار گیفت‌کارت (درون تراکنش سفارش صدا زده می‌شود)
 */
export async function redeemGiftCard(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], code: string, amount: number, phone: string, orderCode: string) {
  const [card] = await tx.select().from(giftCards).where(eq(giftCards.code, code)).for("update");
  if (!card || !card.active || card.balance < amount) throw new Error("اعتبار گیفت‌کارت کافی نیست.");
  await tx.update(giftCards).set({ balance: card.balance - amount }).where(eq(giftCards.code, code));
  await tx.insert(giftCardUses).values({ code, phone, amount, orderCode });
}

/** افزایش شمارندهٔ استفادهٔ کوپن (درون تراکنش سفارش) */
export async function consumeCoupon(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], code: string) {
  await tx.update(coupons).set({ used: sql`${coupons.used} + 1` }).where(eq(coupons.code, code));
}
