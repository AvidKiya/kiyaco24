import { db } from "@/db";
import { settings, transactions, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

/* ============================================================
 *  فاز ۱۴ — لایهٔ پرداخت
 *  - زرین‌پال v4 (اصلی/سندباکس) با تأیید مبلغ سمت سرور
 *  - بدون مرچنت: «درگاه آزمایشی» داخلی تا کل چرخه بدون اینترنت
 *    قابل QA باشد و پنل از روز اول کار کند
 *  - کارت‌به‌کارت با رسید + تأیید پنل
 * ============================================================ */

export type PaymentConfig = {
  zarinpalEnabled: boolean; merchantId: string; sandbox: boolean;
  cardEnabled: boolean; cardNumber: string; cardName: string;
  courierEnabled: boolean; courierCost: number; courierNote: string;
};

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const [row] = await db.select({ payment: settings.payment }).from(settings).where(eq(settings.id, 1));
  const p = row?.payment || {};
  return {
    zarinpalEnabled: p.zarinpalEnabled !== false,
    merchantId: p.merchantId || process.env.ZARINPAL_MERCHANT_ID || "",
    sandbox: p.sandbox === true,
    cardEnabled: p.cardEnabled !== false,
    cardNumber: p.cardNumber || "",
    cardName: p.cardName || "",
    courierEnabled: p.courierEnabled === true,
    courierCost: Number(p.courierCost) || 0,
    courierNote: p.courierNote || "",
  };
}

const zarinpalBase = (sandbox: boolean) => sandbox ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com";

/** ساخت تراکنش و آدرس پرداخت — بدون مرچنت: درگاه آزمایشی داخلی */
export async function createPayment(orderCode: string, amount: number, origin: string, description: string) {
  const config = await getPaymentConfig();
  if (!config.zarinpalEnabled) return { error: "پرداخت آنلاین فعلاً غیرفعال است." };
  const callback = `${origin}/api/payment/callback?order=${encodeURIComponent(orderCode)}`;

  if (!config.merchantId) {
    // درگاه آزمایشی: کاربر در /payment/mock نتیجه را انتخاب می‌کند
    const authority = `MOCK-${randomBytes(12).toString("hex").toUpperCase()}`;
    await db.insert(transactions).values({ orderCode, amount, authority, gateway: "mock", status: "pending" });
    return { url: `/payment/mock?authority=${authority}&order=${encodeURIComponent(orderCode)}` };
  }

  try {
    const response = await fetch(`${zarinpalBase(config.sandbox)}/pg/v4/payment/request.json`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ merchant_id: config.merchantId, amount, currency: "IRT", callback_url: callback, description }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    const authority = data?.data?.authority;
    if (!authority) return { error: `درگاه پاسخ نداد: ${data?.errors?.message || "خطای نامشخص"}` };
    await db.insert(transactions).values({ orderCode, amount, authority, gateway: config.sandbox ? "zarinpal-sandbox" : "zarinpal", status: "pending" });
    return { url: `${zarinpalBase(config.sandbox)}/pg/StartPay/${authority}` };
  } catch {
    return { error: "ارتباط با درگاه پرداخت برقرار نشد. کمی بعد دوباره تلاش کنید." };
  }
}

/** تأیید تراکنش — مبلغ از دیتابیس خوانده می‌شود، نه از ورودی کاربر */
export async function verifyPayment(authority: string, orderCode: string, gatewayOk: boolean) {
  const [txn] = await db.select().from(transactions).where(eq(transactions.authority, authority));
  if (!txn || txn.orderCode !== orderCode) return { status: "invalid" as const };
  if (txn.status === "success") return { status: "already" as const, refId: txn.refId, amount: txn.amount };
  if (txn.status === "failed") return { status: "failed" as const };

  if (!gatewayOk) {
    await db.update(transactions).set({ status: "failed", verifiedAt: new Date() }).where(eq(transactions.id, txn.id));
    return { status: "failed" as const };
  }

  let refId = "";
  if (txn.gateway === "mock") {
    refId = `DEV-${txn.id}${Date.now().toString(36).toUpperCase()}`;
  } else {
    const config = await getPaymentConfig();
    try {
      const response = await fetch(`${zarinpalBase(txn.gateway === "zarinpal-sandbox")}/pg/v4/payment/verify.json`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ merchant_id: config.merchantId, amount: txn.amount, currency: "IRT", authority }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      const code = data?.data?.code;
      if (code !== 100 && code !== 101) {
        await db.update(transactions).set({ status: "failed", verifiedAt: new Date() }).where(eq(transactions.id, txn.id));
        return { status: "failed" as const };
      }
      refId = String(data?.data?.ref_id || "");
    } catch {
      // خطای شبکه: تراکنش pending می‌ماند تا تلاش بعدی؛ دوباره شارژ نمی‌شود چون verify تکرارپذیر است
      return { status: "retry" as const };
    }
  }

  await db.update(transactions).set({ status: "success", refId, verifiedAt: new Date() }).where(eq(transactions.id, txn.id));
  await db.update(orders).set({ paymentStatus: "paid", paymentMethod: txn.gateway === "mock" ? "gateway-dev" : "gateway", paymentRef: refId }).where(eq(orders.code, orderCode));
  return { status: "success" as const, refId, amount: txn.amount };
}

/** خلاصهٔ پرداخت برای پنل */
export async function getPaymentDashboard() {
  const config = await getPaymentConfig();
  const { desc } = await import("drizzle-orm");
  const txns = await db.select().from(transactions).orderBy(desc(transactions.id)).limit(200);
  return {
    settings: { ...config, merchantHint: config.merchantId ? `•••${config.merchantId.slice(-4)}` : "", hasMerchant: !!config.merchantId, envMerchant: !!process.env.ZARINPAL_MERCHANT_ID },
    mode: config.merchantId ? (config.sandbox ? "سندباکس زرین‌پال" : "زرین‌پال") : "درگاه آزمایشی (بدون مرچنت)",
    transactions: txns,
  };
}
