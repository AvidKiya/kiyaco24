import { validOrigin, apiError } from "@/lib/server-store";
import { flushOutbox, processAbandonedCarts, processBirthdays } from "@/lib/notify";
export const dynamic = "force-dynamic";

/* فاز ۱۰ — کرونjobs روزانه (cronTab سرور ایرانی: 0 * * * * *)
 *  خروجی صف پیام‌ها + یادآوری سبد رهاشده + تبرک تولد مشتریان
 *  محافظت با CRON_SECRET (در پنل ادمین قابل تنظیم است)
 */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const provided = request.headers.get("x-cron-key") || new URL(request.url).searchParams.get("key") || "";
  if (secret && provided !== secret) return Response.json({ error: "کلید کرون معتبر نیست." }, { status: 401 });
  try {
    const started = Date.now();
    const [delivered, birthdays, carts] = await Promise.all([
      flushOutbox(200),
      processBirthdays(),
      processAbandonedCarts(),
    ]);
    return Response.json({ ok: true, delivered, birthdays, carts, durationMs: Date.now() - started, at: new Date().toISOString() });
  } catch (error) {
    return apiError(error, "اجرای کارهای زمان‌بندی‌شده انجام نشد.");
  }
}
