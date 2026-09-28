import { validOrigin, allowRequest, clientIp, apiError } from "@/lib/server-store";
import {
  requestOtp, verifyOtp, loginWithPassword, destroyCustomerSession, setCustomerPassword, getCurrentCustomer,
} from "@/lib/customer";
export const dynamic = "force-dynamic";

/* فاز ۹ — ورود مشتری با کد پیامکی یا رمز عبور */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`customer-auth:${clientIp(request)}`, 20)) return Response.json({ error: "تلاش‌های زیاد. کمی بعد دوباره امتحان کنید." }, { status: 429 });
  try {
    const body = await request.json();

    if (body.action === "logout") { await destroyCustomerSession(); return Response.json({ ok: true }); }

    if (body.action === "set-password") {
      const customer = await getCurrentCustomer();
      if (!customer) return Response.json({ error: "نشست شما منقضی شده است." }, { status: 401 });
      const result = await setCustomerPassword(customer.id, String(body.password || ""));
      if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ ok: true, message: "رمز عبور تنظیم شد." });
    }

    if (body.action === "request-otp") {
      const result = await requestOtp(String(body.phone || ""));
      if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ ok: true, message: "کد تأیید ارسال شد.", devCode: result.devCode, expiresIn: result.expiresIn });
    }

    if (body.action === "verify-otp") {
      const result = await verifyOtp(String(body.phone || ""), String(body.code || ""));
      if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ ok: true, isNew: result.isNew, message: result.isNew ? "حساب شما ساخته شد." : "خوش آمدید." });
    }

    if (body.action === "login-password") {
      const result = await loginWithPassword(String(body.phone || ""), String(body.password || ""));
      if (!result.ok) return Response.json({ error: result.error }, { status: 401 });
      return Response.json({ ok: true, message: "خوش آمدید." });
    }

    return Response.json({ error: "عملیات معتبر نیست." }, { status: 400 });
  } catch (error) {
    return apiError(error, "ورود مشتری انجام نشد.");
  }
}
