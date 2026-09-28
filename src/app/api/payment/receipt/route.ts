import { db } from "@/db";
import { orders, media } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { digits } from "@/lib/catalog";
import { getPaymentConfig } from "@/lib/payment";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";

/** ثبت رسید کارت‌به‌کارت — تا تأیید پنل، paymentStatus همان unpaid می‌ماند */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر" }, { status: 403 });
  if (!allowRequest(`receipt:${clientIp(request)}`, 8, 600000)) return Response.json({ error: "کمی بعد دوباره امتحان کنید." }, { status: 429 });
  try {
    const config = await getPaymentConfig();
    if (!config.cardEnabled) return Response.json({ error: "پرداخت کارت‌به‌کارت فعال نیست." }, { status: 400 });
    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();
    const phone = digits(String(body.phone || "")).replace(/\s/g, "");
    const reference = String(body.reference || "").trim().slice(0, 80);
    if (reference.length < 4) return Response.json({ error: "شماره پیگیری واریز را کامل وارد کنید." }, { status: 400 });
    const [order] = await db.select().from(orders).where(and(eq(orders.code, code), eq(orders.phone, phone))).limit(1);
    if (!order) return Response.json({ error: "سفارش پیدا نشد." }, { status: 404 });
    if (order.paymentStatus === "paid") return Response.json({ error: "این سفارش قبلاً پرداخت شده است." }, { status: 400 });
    if (order.status === "cancelled") return Response.json({ error: "این سفارش لغو شده است." }, { status: 400 });

    let receiptImage = order.receiptImage || "";
    const image = String(body.image || "");
    if (image) {
      const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image);
      if (!match) return Response.json({ error: "فرمت تصویر رسید معتبر نیست (PNG/JPG/WebP)." }, { status: 400 });
      if (match[2].length > 550000) return Response.json({ error: "حجم تصویر رسید باید کمتر از ۴۰۰ کیلوبایت باشد." }, { status: 400 });
      const [row] = await db.insert(media).values({ filename: `receipt-${code}.${match[1] === "png" ? "png" : match[1] === "webp" ? "webp" : "jpg"}`, contentType: `image/${match[1] === "jpg" ? "jpeg" : match[1]}`, data: match[2] }).returning({ id: media.id });
      receiptImage = `/api/media/${row.id}`;
    }

    await db.update(orders).set({ paymentMethod: "card", paymentRef: reference, receiptImage }).where(eq(orders.id, order.id));
    return Response.json({ ok: true, message: "رسید ثبت شد. پس از بررسی فروشگاه، پرداخت شما تأیید می‌شود." });
  } catch (error) { return apiError(error); }
}
