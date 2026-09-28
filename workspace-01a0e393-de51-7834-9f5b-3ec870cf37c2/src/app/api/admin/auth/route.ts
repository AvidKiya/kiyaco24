import { db } from "@/db";
import { adminUsers, adminSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, destroySession, hashPassword, isAdmin, verifyPassword } from "@/lib/auth";
import { allowRequest, apiError, clientIp, ensureStore, validOrigin } from "@/lib/server-store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ensureStore();
    const users = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
    return Response.json({ configured: !!users.length, authenticated: await isAdmin(), setupKeyRequired: !!process.env.ADMIN_SETUP_KEY });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  try {
    const body = await request.json();
    if (body.action === "logout") { await destroySession(); return Response.json({ ok: true }); }
    if (!allowRequest(`auth:${clientIp(request)}`, 8, 15 * 60000)) return Response.json({ error: "تعداد تلاش‌ها زیاد است. ۱۵ دقیقه دیگر امتحان کنید." }, { status: 429 });
    const password = String(body.password || "");
    if (password.length < 10 || password.length > 128) return Response.json({ error: "رمز عبور باید بین ۱۰ تا ۱۲۸ کاراکتر باشد." }, { status: 400 });
    const users = await db.select().from(adminUsers).limit(1);
    if (body.action === "password.change") {
      if (!await isAdmin() || !users[0] || !verifyPassword(String(body.currentPassword || ""), users[0].passwordHash)) return Response.json({ error: "نشست یا رمز فعلی معتبر نیست." }, { status: 401 });
      await db.transaction(async tx => {
        await tx.update(adminUsers).set({ passwordHash: hashPassword(password) }).where(eq(adminUsers.id, 1));
        await tx.delete(adminSessions);
      });
      await createSession();
      return Response.json({ ok: true });
    }
    if (body.action === "setup") {
      if (users.length) return Response.json({ error: "مدیر قبلاً ساخته شده است. وارد شوید." }, { status: 409 });
      if (process.env.NODE_ENV === "production" && !process.env.ADMIN_SETUP_KEY) return Response.json({ error: "برای راه‌اندازی امن، ابتدا کلید ADMIN_SETUP_KEY باید روی سرور تنظیم شود." }, { status: 503 });
      if (process.env.ADMIN_SETUP_KEY && body.setupKey !== process.env.ADMIN_SETUP_KEY) return Response.json({ error: "کلید راه‌اندازی صحیح نیست." }, { status: 403 });
      const created = await db.insert(adminUsers).values({ id: 1, passwordHash: hashPassword(password) }).onConflictDoNothing().returning();
      if (!created.length) return Response.json({ error: "مدیر قبلاً ساخته شده است." }, { status: 409 });
    } else if (body.action !== "login" || !users[0] || !verifyPassword(password, users[0].passwordHash)) {
      return Response.json({ error: "رمز عبور صحیح نیست." }, { status: 401 });
    }
    await createSession();
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
