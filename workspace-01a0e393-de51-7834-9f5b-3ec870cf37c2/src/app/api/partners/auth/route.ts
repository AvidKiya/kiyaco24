import { validOrigin, allowRequest, clientIp, apiError } from "@/lib/server-store";
import { loginPartner, destroyPartnerSession, currentPartner, partnerPasswordHash } from "@/lib/partner-auth";
import { partnerPhone } from "@/lib/partner";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { eq } from "drizzle-orm";
export const dynamic = "force-dynamic";

/* ============================================================
 *  فاز ۶ — ورود/خروج/تغییر رمز همکار عمده
 * ============================================================ */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`partner-auth:${clientIp(request)}`, 10)) return Response.json({ error: "تلاش‌های زیاد. ۱۵ دقیقهٔ دیگر دوباره امتحان کنید." }, { status: 429 });
  try {
    const body = await request.json();

    if (body.action === "logout") { await destroyPartnerSession(); return Response.json({ ok: true }); }

    if (body.action === "change-password") {
      const partner = await currentPartner();
      if (!partner) return Response.json({ error: "نشست شما منقضی شده است." }, { status: 401 });
      const next = String(body.password || "");
      if (next.length < 8) return Response.json({ error: "رمز جدید باید حداقل ۸ کاراکتر باشد." }, { status: 400 });
      await db.update(partners).set({ passwordHash: partnerPasswordHash(next) }).where(eq(partners.id, partner.id));
      return Response.json({ ok: true, message: "رمز عبور شما تغییر کرد." });
    }

    const phone = partnerPhone(body.phone);
    const password = String(body.password || "");
    if (!phone || password.length < 8) return Response.json({ error: "شماره موبایل و رمز عبور (حداقل ۸ کاراکتر) را وارد کنید." }, { status: 400 });
    const result = await loginPartner(phone, password);
    if (!result.ok) return Response.json({ error: result.reason }, { status: 401 });
    return Response.json({ ok: true, partner: { businessName: result.partner?.businessName ?? "", status: result.partner?.status ?? "" } });
  } catch (error) {
    return apiError(error, "ورود همکار انجام نشد.");
  }
}
