import { validOrigin, apiError } from "@/lib/server-store";
import { getCurrentCustomer } from "@/lib/customer";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, eq } from "drizzle-orm";
export const dynamic = "force-dynamic";

/* فاز ۹ — خواندن اعلان‌های مشتری */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return Response.json({ error: "نشست شما منقضی شده است." }, { status: 401 });
    const body = await request.json().catch(() => ({}));

    if (body.action === "read-all") {
      await db.update(notifications).set({ read: true }).where(and(eq(notifications.customerId, customer.id), eq(notifications.read, false)));
      return Response.json({ ok: true, message: "همهٔ اعلان‌ها خوانده‌شده علامت خورد." });
    }

    if (body.id) {
      await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, Number(body.id)), eq(notifications.customerId, customer.id)));
      return Response.json({ ok: true });
    }

    return Response.json({ error: "اعلان مشخص نیست." }, { status: 400 });
  } catch (error) {
    return apiError(error, "به‌روزرسانی اعلان‌ها انجام نشد.");
  }
}
