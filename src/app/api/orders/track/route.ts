import { db } from "@/db";
import { orders, returns } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { digits } from "@/lib/catalog";
import { getPaymentConfig } from "@/lib/payment";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر" }, { status: 403 });
  if (!allowRequest(`track:${clientIp(request)}`, 20, 600000)) return Response.json({ error: "کمی بعد دوباره امتحان کنید." }, { status: 429 });
  try {
    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();
    const phone = digits(String(body.phone || "")).replace(/\s/g, "");
    const [order] = await db.select({ code: orders.code, status: orders.status, total: orders.total, items: orders.items, trackingNumber: orders.trackingNumber, createdAt: orders.createdAt, delivery: orders.delivery, paymentStatus: orders.paymentStatus, paymentMethod: orders.paymentMethod, paymentRef: orders.paymentRef, receiptImage: orders.receiptImage }).from(orders).where(and(eq(orders.code, code), eq(orders.phone, phone))).limit(1);
    if (!order) return Response.json({ error: "سفارشی با این کد و شماره موبایل پیدا نشد." }, { status: 404 });
    const config = await getPaymentConfig();
    const orderReturns = await db.select({ id: returns.id, status: returns.status, reason: returns.reason, adminNote: returns.adminNote, refundAmount: returns.refundAmount, refundMethod: returns.refundMethod, createdAt: returns.createdAt }).from(returns).where(eq(returns.orderCode, code)).orderBy(desc(returns.id));
    return Response.json({
      order,
      returns: orderReturns,
      payment: {
        gatewayEnabled: config.zarinpalEnabled,
        cardEnabled: config.cardEnabled,
        cardNumber: config.cardNumber,
        cardName: config.cardName,
        canPay: order.paymentStatus !== "paid" && order.status !== "cancelled" && order.total > 0,
        canReturn: (order.status === "shipped" || order.status === "delivered") && !orderReturns.some((r) => r.status === "requested" || r.status === "approved"),
      },
    });
  } catch (error) { return apiError(error); }
}
