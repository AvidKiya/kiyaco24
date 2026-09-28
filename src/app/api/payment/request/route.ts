import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { digits } from "@/lib/catalog";
import { createPayment } from "@/lib/payment";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";

/** شروع پرداخت آنلاین برای سفارش ثبت‌شده */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر" }, { status: 403 });
  if (!allowRequest(`pay:${clientIp(request)}`, 10, 600000)) return Response.json({ error: "کمی بعد دوباره امتحان کنید." }, { status: 429 });
  try {
    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();
    const phone = digits(String(body.phone || "")).replace(/\s/g, "");
    const [order] = await db.select().from(orders).where(and(eq(orders.code, code), eq(orders.phone, phone))).limit(1);
    if (!order) return Response.json({ error: "سفارش پیدا نشد." }, { status: 404 });
    if (order.paymentStatus === "paid") return Response.json({ error: "این سفارش قبلاً پرداخت شده است." }, { status: 400 });
    if (order.status === "cancelled") return Response.json({ error: "این سفارش لغو شده و قابل پرداخت نیست." }, { status: 400 });
    if (order.total <= 0) return Response.json({ error: "مبلغ قابل پرداختی برای این سفارش وجود ندارد." }, { status: 400 });
    const origin = new URL(request.url).origin;
    const result = await createPayment(order.code, order.total, origin, `پرداخت سفارش ${order.code} — کیا`);
    if ("error" in result) return Response.json({ error: result.error }, { status: 502 });
    return Response.json({ url: result.url });
  } catch (error) { return apiError(error); }
}
