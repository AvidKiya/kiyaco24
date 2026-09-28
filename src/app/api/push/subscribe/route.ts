import { validOrigin, allowRequest, clientIp, apiError } from "@/lib/server-store";
import { getCurrentCustomer } from "@/lib/customer";
import { savePushSubscription } from "@/lib/notify";
export const dynamic = "force-dynamic";

/* فاز ۱۰ — عضویت مرورگر در Push (PWA) */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`push-sub:${clientIp(request)}`, 30)) return Response.json({ error: "تلاش‌های زیاد. کمی بعد دوباره امتحان کنید." }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    const endpoint = String(body.endpoint || "").trim().slice(0, 700);
    const p256dh = String(body.keys?.p256dh || body.p256dh || "").trim().slice(0, 200);
    const auth = String(body.keys?.auth || body.auth || "").trim().slice(0, 100);
    if (!endpoint.startsWith("http") || !p256dh || !auth) return Response.json({ error: "اشتراک مرورگر معتبر نیست." }, { status: 400 });
    const customer = await getCurrentCustomer();
    await savePushSubscription({ endpoint, p256dh, auth, phone: customer?.phone ?? "", customerId: customer?.id ?? null });
    return Response.json({ ok: true, message: "اعلان‌های مرورگر فعال شد." });
  } catch (error) {
    return apiError(error, "فعال‌سازی اعلان مرورگر انجام نشد.");
  }
}
