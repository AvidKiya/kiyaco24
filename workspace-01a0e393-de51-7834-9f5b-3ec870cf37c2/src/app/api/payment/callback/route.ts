import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPayment } from "@/lib/payment";
import { notifyOrderChange } from "@/lib/notify";

/** بازگشت از درگاه — تأیید سمت سرور و هدایت به رهگیری */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderCode = String(url.searchParams.get("order") || "").trim().toUpperCase();
  const authority = String(url.searchParams.get("Authority") || "").trim();
  const gatewayOk = url.searchParams.get("Status") === "OK";
  const redirect = (payment: string) => Response.redirect(`${url.origin}/track?code=${encodeURIComponent(orderCode)}&payment=${payment}`, 302);
  if (!orderCode || !authority) return redirect("failed");
  try {
    const result = await verifyPayment(authority, orderCode, gatewayOk);
    if (result.status === "success") {
      const [order] = await db.select().from(orders).where(eq(orders.code, orderCode)).limit(1);
      if (order) {
        await notifyOrderChange(
          { id: String(order.id), code: order.code, customerName: order.customerName, phone: order.phone, total: order.total, status: order.status, paymentStatus: "paid", trackingNumber: order.trackingNumber || "" },
          { status: order.status, paymentStatus: "unpaid" },
        ).catch(() => {});
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
          fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: `پرداخت موفق کیا\n${order.code}\nمبلغ: ${order.total.toLocaleString("fa-IR")} تومان\nمرجع: ${result.refId || "—"}` }),
            signal: AbortSignal.timeout(8000),
          }).catch(() => {});
        }
      }
      return redirect("success");
    }
    if (result.status === "already") return redirect("success");
    if (result.status === "retry") return redirect("retry");
    return redirect("failed");
  } catch {
    return redirect("failed");
  }
}
