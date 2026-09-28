import { validOrigin, allowRequest, clientIp, apiError, ensureStore } from "@/lib/server-store";
import { db } from "@/db";
import { partnerOrders, products, partnerTiers, type PartnerOrderItem } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { currentPartner } from "@/lib/partner-auth";
import { getPartnerTiers, normalizeTier, tierPrice, partnerOrderCode, invoiceNumberFor, meetsTierMinimum, tierMinOrder } from "@/lib/partner";
import { randomUUID } from "node:crypto";
export const dynamic = "force-dynamic";

/* ============================================================
 *  فاز ۶ — سفارش‌های عمده
 *  POST: ثبت سفارش عمده با قیمت لایهٔ همکار (قیمت‌گذاری سمت سرور)
 *  GET : تاریخچهٔ سفارش‌های خود همکار
 * ============================================================ */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  try {
    const partner = await currentPartner();
    if (!partner) return Response.json({ error: "برای ثبت سفارش عمده باید وارد شوید." }, { status: 401 });
    if (partner.status !== "approved") return Response.json({ error: "حساب همکاری شما هنوز تأیید نشده است." }, { status: 403 });
    if (!allowRequest(`partner-order:${partner.id}`, 30)) return Response.json({ error: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید." }, { status: 429 });

    const body = await request.json();
    const requestKey = String(body.requestKey || "");
    if (!/^[a-f\d-]{36}$/i.test(requestKey)) return Response.json({ error: "شناسهٔ سفارش معتبر نیست. صفحه را تازه‌سازی کنید." }, { status: 400 });

    const lines: { productId: number; quantity: number; size: string; color: string }[] = Array.isArray(body.items)
      ? body.items.map((item: Record<string, unknown>) => ({ productId: Number(item.productId), quantity: Number(item.quantity), size: String(item.size || "").slice(0, 40), color: String(item.color || "").slice(0, 40) }))
      : [];
    if (!lines.length || lines.length > 60) return Response.json({ error: "سبد عمدهٔ شما خالی یا نامعتبر است." }, { status: 400 });
    if (lines.some(line => !Number.isSafeInteger(line.productId) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 500)) {
      return Response.json({ error: "تعداد یا محصول انتخابی معتبر نیست." }, { status: 400 });
    }

    const tierRows = await db.select().from(partnerTiers).where(eq(partnerTiers.id, partner.tierId ?? 0)).limit(1);
    const tier = normalizeTier(tierRows[0] ?? (await getPartnerTiers()).find(t => t.key === "retail") ?? (await getPartnerTiers())[0] ?? null);

    /* قیمت‌گذاری همیشه سمت سرور — قیمت ارسالی کلاینت نادیده گرفته می‌شود */
    const ids = [...new Set(lines.map(line => line.productId))];
    const catalog = await db.select().from(products).where(and(inArray(products.id, ids), eq(products.active, true)));
    const items: PartnerOrderItem[] = [];
    let subtotal = 0;
    let retailTotal = 0;
    for (const line of lines) {
      const product = catalog.find(p => p.id === line.productId);
      if (!product) return Response.json({ error: "یکی از محصولات انتخابی دیگر در دسترس نیست." }, { status: 400 });
      if (line.quantity > product.stock) return Response.json({ error: `موجودی «${product.name}» کافی نیست (${product.stock} قلم).` }, { status: 400 });
      const priced = tierPrice(product.price, tier);
      const unitPrice = priced.unitPrice;
      subtotal += unitPrice * line.quantity;
      retailTotal += product.price * line.quantity;
      items.push({ productId: product.id, name: product.name, image: product.image, quantity: line.quantity, retailPrice: product.price, partnerPrice: unitPrice, size: line.size, color: line.color });
    }

    const minimum = tierMinOrder(tier);
    if (!meetsTierMinimum(subtotal, tier)) {
      return Response.json({ error: `حداقل مبلغ سفارش برای لایهٔ ${tier?.name ?? "همکاری"} ${minimum.toLocaleString("fa-IR")} تومان است.` }, { status: 400 });
    }

    const shipping = subtotal >= 15000000 ? 0 : 250000;
    const total = subtotal + shipping;
    const code = partnerOrderCode();

    const created = await db.insert(partnerOrders).values({
      code, requestKey, partnerId: partner.id, items, subtotal,
      discount: retailTotal - subtotal, shipping, total,
      tierName: tier?.name ?? "", status: "pending", paymentStatus: "unpaid",
      note: String(body.note || "").slice(0, 800),
    }).onConflictDoNothing().returning();

    if (!created.length) {
      const existing = await db.select().from(partnerOrders).where(eq(partnerOrders.requestKey, requestKey)).limit(1);
      return Response.json({ ok: true, code: existing[0].code, total: existing[0].total, duplicate: true });
    }

    /* کسر موجودی در همان تراکنش سفارش عمده */
    await db.transaction(async tx => {
      for (const item of items) {
        await tx.update(products).set({ stock: sql`greatest(0, ${products.stock} - ${item.quantity})` }).where(eq(products.id, item.productId));
      }
    });

    return Response.json({ ok: true, code, total, discount: retailTotal - subtotal });
  } catch (error) {
    return apiError(error, "ثبت سفارش عمده انجام نشد.");
  }
}

export async function GET() {
  try {
    const partner = await currentPartner();
    if (!partner) return Response.json({ error: "برای مشاهدهٔ سفارش‌ها باید وارد شوید." }, { status: 401 });
    await ensureStore();
    const orders = await db.select().from(partnerOrders).where(eq(partnerOrders.partnerId, partner.id)).orderBy(desc(partnerOrders.createdAt)).limit(100);
    const tierRows = partner.tierId ? await db.select().from(partnerTiers).where(eq(partnerTiers.id, partner.tierId)).limit(1) : [];
    const tier = tierRows[0] ?? null;
    return Response.json({
      partner: { id: partner.id, phone: partner.phone, businessName: partner.businessName, contactName: partner.contactName, city: partner.city, status: partner.status, tierName: tier?.name ?? "—" },
      orders: orders.map(order => ({ ...order, invoiceNumber: order.status === "pending" ? "" : (order.invoiceNumber || invoiceNumberFor(order.code)) })),
    });
  } catch (error) {
    return apiError(error, "دریافت سفارش‌های عمده انجام نشد.");
  }
}

/** سفارش مجدد — همان اقلام سفارش قبلی برای پرکردن سریع سبد */
export async function PUT(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  try {
    const partner = await currentPartner();
    if (!partner) return Response.json({ error: "برای سفارش مجدد باید وارد شوید." }, { status: 401 });
    const body = await request.json();
    const code = String(body.code || "");
    const order = (await db.select().from(partnerOrders).where(and(eq(partnerOrders.code, code), eq(partnerOrders.partnerId, partner.id))).limit(1))[0];
    if (!order) return Response.json({ error: "سفارش پیدا نشد." }, { status: 404 });
    const items = (order.items as { productId: number; quantity: number; size: string; color: string }[]).map(item => ({ productId: item.productId, quantity: item.quantity, size: item.size, color: item.color }));
    return Response.json({ ok: true, items, requestKey: randomUUID() });
  } catch (error) {
    return apiError(error, "سفارش مجدد آماده نشد.");
  }
}
