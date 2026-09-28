import { db } from "@/db";
import { products, reviews, questions } from "@/db/schema";
import { allowRequest, apiError, clientIp, validOrigin } from "@/lib/server-store";
import { eq } from "drizzle-orm";
import { getCurrentCustomer } from "@/lib/customer";
export const dynamic = "force-dynamic";

/* ============================================================
 *  ثبت نظر و پرسش مشتری — نیازمند تأیید مدیر
 * ============================================================ */

const name = (value: unknown) => String(value || "").trim().slice(0, 60);
const body = (value: unknown, max: number) => String(value || "").trim().slice(0, max);

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`feedback:${clientIp(request)}`, 5, 10 * 60 * 1000)) {
    return Response.json({ error: "تعداد درخواست‌های شما زیاد است. کمی بعد دوباره تلاش کنید." }, { status: 429 });
  }

  try {
    const payload = await request.json();
    const productId = Number(payload.productId);

    if (!Number.isSafeInteger(productId) || productId < 1) {
      return Response.json({ error: "محصول معتبر نیست." }, { status: 400 });
    }

    // محصول باید فعال باشد
    const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return Response.json({ error: "محصول پیدا نشد." }, { status: 404 });

    const customer = name(payload.name);
    if (customer.length < 2) return Response.json({ error: "نام خود را وارد کنید." }, { status: 400 });

    if (payload.type === "review") {
      const text = body(payload.text, 1200);
      if (text.length < 10) return Response.json({ error: "متن نظر باید حداقل ۱۰ حرف باشد." }, { status: 400 });
      const rating = Number(payload.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return Response.json({ error: "امتیاز باید بین ۱ تا ۵ باشد." }, { status: 400 });
      const image = body(payload.image, 700);

      const account = await getCurrentCustomer();
      await db.insert(reviews).values({
        productId,
        name: customer,
        phone: account?.phone ?? "",
        rating,
        text,
        image: /^\/api\/media\/[a-f\d-]{36}$/.test(image) ? image : "",
        approved: false,
      });
      return Response.json({ ok: true, message: "نظر شما ثبت شد و پس از تأیید فروشگاه نمایش داده می‌شود." });
    }

    if (payload.type === "question") {
      const question = body(payload.question, 800);
      if (question.length < 5) return Response.json({ error: "متن پرسش باید حداقل ۵ حرف باشد." }, { status: 400 });

      await db.insert(questions).values({
        productId,
        name: customer,
        question,
        answer: "",
        approved: false,
      });
      return Response.json({ ok: true, message: "پرسش شما ثبت شد؛ پاسخ فروشگاه به‌زودی اینجا منتشر می‌شود." });
    }

    return Response.json({ error: "نوع درخواست معتبر نیست." }, { status: 400 });
  } catch (error) {
    return apiError(error, "ثبت نظر انجام نشد. دوباره تلاش کنید.");
  }
}
