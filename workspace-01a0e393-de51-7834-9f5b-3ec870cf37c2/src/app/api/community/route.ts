import { db } from "@/db";
import { subscribers, messages } from "@/db/schema";
import { digits } from "@/lib/catalog";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر" }, { status: 403 });
  if (!allowRequest(`community:${clientIp(request)}`, 8, 600000)) return Response.json({ error: "لطفاً کمی بعد دوباره تلاش کنید." }, { status: 429 });
  try {
    const body = await request.json();
    const phone = digits(String(body.phone || "")).replace(/\s/g, "");
    if (!/^09\d{9}$/.test(phone)) return Response.json({ error: "شماره موبایل ۱۱ رقمی معتبر وارد کنید." }, { status: 400 });
    if (body.type === "message") {
      const name = String(body.name || "").trim(); const message = String(body.message || "").trim();
      if (name.length < 2 || name.length > 100 || message.length < 10 || message.length > 2000) return Response.json({ error: "نام و پیام بین ۱۰ تا ۲۰۰۰ کاراکتر را وارد کنید." }, { status: 400 });
      await db.insert(messages).values({ name, phone, message });
    } else if (body.type === "subscribe") {
      await db.insert(subscribers).values({ phone }).onConflictDoNothing();
    } else return Response.json({ error: "درخواست نامعتبر" }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
