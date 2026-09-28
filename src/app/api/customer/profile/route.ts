import { validOrigin, allowRequest, clientIp, apiError } from "@/lib/server-store";
import { getCurrentCustomer, addPoints, pushNotification } from "@/lib/customer";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { pointsRules } from "@/lib/customer-types";
export const dynamic = "force-dynamic";

/* فاز ۹ — ویرایش پروفایل و نشانی‌های مشتری */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`customer-profile:${clientIp(request)}`, 40)) return Response.json({ error: "تلاش‌های زیاد. کمی بعد دوباره امتحان کنید." }, { status: 429 });
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return Response.json({ error: "نشست شما منقضی شده است." }, { status: 401 });
    const body = await request.json();

    if (body.action === "update") {
      const name = String(body.name || "").trim().slice(0, 60);
      const birthDate = String(body.birthDate || "").trim();
      const city = String(body.city || "").trim().slice(0, 40);
      const email = String(body.email || "").trim().slice(0, 80);
      if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return Response.json({ error: "تاریخ تولد باید به شکل ۱۴۰۰-۰۱-۰۱ باشد." }, { status: 400 });
      const wasIncomplete = !customer.name || !customer.city;
      await db.update(customers).set({ name, birthDate, city, email }).where(eq(customers.id, customer.id));
      if (wasIncomplete && name && city) {
        await addPoints(customer.id, pointsRules.profile, "تکمیل اطلاعات پروفایل");
        await pushNotification(customer.id, "پروفایلت تکمیل شد", "امتیاز تکمیل پروفایل به حسابت اضافه شد.", "/account/panel");
      }
      return Response.json({ ok: true, message: "اطلاعات شما ذخیره شد." });
    }

    if (body.action === "address.save") {
      const label = String(body.label || "").trim().slice(0, 30) || "نشانی من";
      const receiver = String(body.receiver || "").trim().slice(0, 60);
      const phone = String(body.phone || "").trim();
      const city = String(body.city || "").trim().slice(0, 40);
      const address = String(body.address || "").trim().slice(0, 300);
      const postalCode = String(body.postalCode || "").trim();
      if (!receiver || !city || address.length < 10) return Response.json({ error: "نام گیرنده، شهر و نشانی کامل را وارد کنید." }, { status: 400 });
      if (!/^09\d{9}$/.test(phone)) return Response.json({ error: "شمارهٔ موبایل گیرنده باید ۱۱ رقم و با ۰۹ شروع شود." }, { status: 400 });
      if (!/^\d{10}$/.test(postalCode)) return Response.json({ error: "کد پستی باید ۱۰ رقم باشد." }, { status: 400 });
      const id = String(body.id || randomBytes(6).toString("hex"));
      const addresses = [...customer.addresses.filter(item => item.id !== id), { id, label, receiver, phone, city, address, postalCode }];
      await db.update(customers).set({ addresses }).where(eq(customers.id, customer.id));
      return Response.json({ ok: true, message: "نشانی ذخیره شد." });
    }

    if (body.action === "address.delete") {
      const id = String(body.id || "");
      await db.update(customers).set({ addresses: customer.addresses.filter(item => item.id !== id) }).where(eq(customers.id, customer.id));
      return Response.json({ ok: true, message: "نشانی حذف شد." });
    }

    return Response.json({ error: "عملیات معتبر نیست." }, { status: 400 });
  } catch (error) {
    return apiError(error, "ذخیرهٔ اطلاعات انجام نشد.");
  }
}
