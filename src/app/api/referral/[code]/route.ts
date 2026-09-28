import { cookies } from "next/headers";
import { validOrigin, apiError } from "@/lib/server-store";
import { findReferrer } from "@/lib/customer";
export const dynamic = "force-dynamic";

/* فاز ۹ — ثبت کوکی دعوت‌نامه برای پیوستن دوست به معرف
 *  خود کلیک در صفحهٔ /invite/[code] سمت سرور ثبت می‌شود؛ این مسیر فقط کوکی را می‌گذارد. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  try {
    const { code } = await params;
    const referrer = await findReferrer(String(code || ""));
    if (!referrer) return Response.json({ error: "کد دعوت معتبر نیست." }, { status: 404 });
    const jar = await cookies();
    jar.set("kiya_invite", String(code).toUpperCase(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86_400_000 });
    return Response.json({ ok: true, message: "دعوت‌نامه ثبت شد." });
  } catch (error) {
    return apiError(error, "ثبت دعوت‌نامه انجام نشد.");
  }
}
