import { allowRequest, apiError, clientIp, ensureStore, validOrigin } from "@/lib/server-store";
import { digits } from "@/lib/catalog";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { eq } from "drizzle-orm";
import { defaultTierForNewPartner, partnerExists, partnerPhone } from "@/lib/partner";
export const dynamic = "force-dynamic";

/* ============================================================
 *  فاز ۶ — درخواست همکاری عمده
 *  POST: ثبت درخواست تازه (از لندینگ «همکاری با ما»)
 * ============================================================ */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`partner-apply:${clientIp(request)}`, 5)) return Response.json({ error: "چند درخواست پشت سر هم ثبت شده. کمی بعد دوباره تلاش کنید." }, { status: 429 });
  try {
    await ensureStore();
    const body = await request.json();
    const phone = partnerPhone(body.phone);
    if (!phone) return Response.json({ error: "شماره موبایل معتبر وارد کنید (مثلاً ۰۹۱۲۱۲۳۴۵۶۷)." }, { status: 400 });
    const businessName = String(body.businessName || "").trim().slice(0, 120);
    const contactName = String(body.contactName || "").trim().slice(0, 80);
    if (businessName.length < 2) return Response.json({ error: "نام کسب‌وکار یا برند خود را وارد کنید." }, { status: 400 });
    if (contactName.length < 2) return Response.json({ error: "نام و نام خانوادگی مسئول همکاری را وارد کنید." }, { status: 400 });
    const city = String(body.city || "").trim().slice(0, 80);
    if (city.length < 2) return Response.json({ error: "شهر خود را وارد کنید." }, { status: 400 });
    const landline = digits(String(body.landline || "")).slice(0, 20);
    const instagram = String(body.instagram || "").trim().replace(/^@/, "").slice(0, 60);
    const about = String(body.about || "").trim().slice(0, 1200);

    if (await partnerExists(phone)) {
      return Response.json({ error: "برای این شماره موبایل قبلاً درخواست همکاری ثبت شده است. اگر رمز عبور دارید وارد شوید." }, { status: 409 });
    }

    const tier = await defaultTierForNewPartner();
    const password = String(body.password || "");
    if (password.length > 0 && password.length < 8) return Response.json({ error: "رمز عبور باید حداقل ۸ کاراکتر باشد." }, { status: 400 });

    const { partnerPasswordHash } = await import("@/lib/partner-auth");
    await db.insert(partners).values({
      phone,
      businessName,
      contactName,
      city,
      landline,
      instagram,
      about,
      tierId: tier?.id || null,
      status: "pending",
      passwordHash: password.length >= 8 ? partnerPasswordHash(password) : "",
    });

    return Response.json({ ok: true, message: "درخواست همکاری شما ثبت شد. پس از بررسی توسط تیم کیا با شما تماس می‌گیریم." });
  } catch (error) {
    return apiError(error, "ثبت درخواست همکاری انجام نشد. دوباره تلاش کنید.");
  }
}

/* فهرست درخواست‌ها برای پنل مدیر (با کوکی نشست مدیر) */
export async function GET(request: Request) {
  try {
    const { isAdmin } = await import("@/lib/auth");
    if (!(await isAdmin())) return Response.json({ error: "دسترسی ندارید." }, { status: 401 });
    const rows = await db.select().from(partners).orderBy(partners.id);
    return Response.json({
      partners: rows.map(({ passwordHash: _passwordHash, ...partner }) => partner),
    });
  } catch (error) {
    return apiError(error, "دریافت فهرست همکاران انجام نشد.");
  }
}
