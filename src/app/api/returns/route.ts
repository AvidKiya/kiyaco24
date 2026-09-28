import { db } from "@/db";
import { orders, returns } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { digits } from "@/lib/catalog";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";

/** ثبت درخواست مرجوعی — فقط برای سفارش‌های ارسال/تحویل‌شده */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر" }, { status: 403 });
  if (!allowRequest(`returns:${clientIp(request)}`, 6, 600000)) return Response.json({ error: "کمی بعد دوباره امتحان کنید." }, { status: 429 });
  try {
    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();
    const phone = digits(String(body.phone || "")).replace(/\s/g, "");
    const reason = String(body.reason || "").trim().slice(0, 600);
    if (reason.length < 10) return Response.json({ error: "دلیل مرجوعی را کامل‌تر بنویسید (حداقل ۱۰ حرف)." }, { status: 400 });
    const [order] = await db.select().from(orders).where(and(eq(orders.code, code), eq(orders.phone, phone))).limit(1);
    if (!order) return Response.json({ error: "سفارش پیدا نشد." }, { status: 404 });
    if (order.status !== "shipped" && order.status !== "delivered") return Response.json({ error: "مرجوعی فقط برای سفارش‌های ارسال یا تحویل‌شده قابل ثبت است." }, { status: 400 });
    const open = await db.select({ id: returns.id }).from(returns).where(and(eq(returns.orderCode, code), inArray(returns.status, ["requested", "approved"]))).limit(1);
    if (open.length) return Response.json({ error: "برای این سفارش یک درخواست مرجوعی باز وجود دارد." }, { status: 400 });
    const [row] = await db.insert(returns).values({ orderCode: code, phone, reason }).returning({ id: returns.id });
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: `درخواست مرجوعی جدید کیا\nسفارش: ${code}\nدلیل: ${reason.slice(0, 150)}` }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => {});
    }
    return Response.json({ ok: true, id: row.id, message: "درخواست مرجوعی ثبت شد. طبق سیاست ۷ روزه، پس از بررسی با شما تماس می‌گیریم." });
  } catch (error) { return apiError(error); }
}
