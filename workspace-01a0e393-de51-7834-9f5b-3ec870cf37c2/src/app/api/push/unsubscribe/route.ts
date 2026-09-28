import { validOrigin, apiError } from "@/lib/server-store";
import { removePushSubscription } from "@/lib/notify";
export const dynamic = "force-dynamic";

/* فاز ۱۰ — لغو اشتراک Push مرورگر */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const endpoint = String(body.endpoint || "").trim().slice(0, 700);
    if (!endpoint) return Response.json({ error: "اشتراک مشخص نیست." }, { status: 400 });
    await removePushSubscription(endpoint);
    return Response.json({ ok: true, message: "اعلان‌های مرورگر خاموش شد." });
  } catch (error) {
    return apiError(error, "لغو اشتراک انجام نشد.");
  }
}
