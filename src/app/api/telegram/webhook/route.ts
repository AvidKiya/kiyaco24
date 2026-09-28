import { getTgConfig } from "@/lib/telegram";
import { handleUpdate } from "@/lib/telegram-bot";
export const dynamic = "force-dynamic";

/* ============================================================
 *  فاز ۱۲ — وبهوک ربات تلگرام
 *  تلگرام آپدیت‌ها را اینجا POST می‌کند؛ پاسخ اصلی همان‌جا
 *  در بدنهٔ HTTP برمی‌گردد (روش رسمی تلگرام — یک فراخوانی کمتر).
 *  امنیت: هدر X-Telegram-Bot-Api-Secret-Token باید با رمز
 *  ذخیره‌شده یکی باشد.
 * ============================================================ */

export async function POST(request: Request) {
  try {
    const config = await getTgConfig();
    const secret = request.headers.get("x-telegram-bot-api-secret-token") || "";
    if (secret !== config.webhookSecret) return Response.json({ ok: false }, { status: 401 });
    const update = await request.json().catch(() => null);
    if (!update || typeof update !== "object") return Response.json({ ok: true });
    const origin = new URL(request.url).origin;
    const reply = await handleUpdate(update as Record<string, unknown>, origin);
    // اگر پاسخی هست، به‌صورت webhook reply برگردان؛ وگرنه 200 خالی
    return Response.json(reply ?? { ok: true });
  } catch (error) {
    // وبهوک هرگز نباید خطای ۵xx بدهد وگرنه تلگرام مدام تکرار می‌کند
    console.error("Telegram webhook failed:", error instanceof Error ? error.message : error);
    return Response.json({ ok: true });
  }
}
