import { recordEvent, eventTypes, type EventType } from "@/lib/analytics";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";

/** فاز ۱۵ — ثبت رویداد آنالیتیکس از سمت مشتری (ناشناس، بدون کوکی ردیابی) */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر" }, { status: 403 });
  if (!allowRequest(`events:${clientIp(request)}`, 120, 60000)) return Response.json({ ok: true, skipped: true });
  /* فاز ۱۶ — بدنهٔ JSON خراب باید ۴۰۰ برگرداند نه ۵۰۰ */
  let parsed: unknown;
  try { parsed = await request.json(); } catch { return Response.json({ error: "بدنهٔ درخواست معتبر نیست." }, { status: 400 }); }
  try {
    const body = parsed as { type?: unknown; ref?: unknown };
    const type = String(body.type || "");
    /* purchase فقط سمت سرور (هنگام ثبت سفارش) ثبت می‌شود تا آمار فروش قابل دستکاری نباشد */
    if (!eventTypes.includes(type as EventType) || type === "purchase" || type === "wholesale_request") return Response.json({ error: "نوع رویداد معتبر نیست." }, { status: 400 });
    await recordEvent(type as EventType, String(body.ref || "").slice(0, 160));
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
