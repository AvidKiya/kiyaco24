import { db } from "@/db";
import { products, orders, settings, coupons, subscribers, messages, heroSlides, flashSales, trends, looks, reviews, questions, giftCards, giftCardUses, partners, partnerTiers, partnerOrders, articles, guides, collections, customers, pointsLogs, walletTxns, referrals, notifications } from "@/db/schema";
import { addPoints, pushNotification } from "@/lib/customer";
import { pointsRules } from "@/lib/customer-types";
import { isAdmin } from "@/lib/auth";
import { ensureStore, apiError, validOrigin } from "@/lib/server-store";
import { invoiceNumberFor } from "@/lib/partner";
import { slugify } from "@/lib/daily-types";
import { notifyOrderChange, notifyPartnerUpdate, notifyNewCollection, processProductAlerts, getNotificationDashboard, flushOutbox, broadcastPush, ensureAlertRules, triggerLabels, channelLabels, queueMessage, renderTemplate, remindAbandonedCart, channelStatus, type Channel, type Trigger } from "@/lib/notify";
import { alertRules, outbox, stockAlerts, abandonedCarts, pushSubscriptions, homeSections, transactions, returns } from "@/db/schema";
import { getPaymentDashboard } from "@/lib/payment";
import { getBiDashboard } from "@/lib/analytics";
import { getAiDashboard, testAiConnection, generateCaptions, analyzeTrends } from "@/lib/ai";
import { getTgDashboard, getTgConfig, tgCall, publishProductToChannel, publishTextToChannel } from "@/lib/telegram";
import { tgSettings, tgChats } from "@/db/schema";
import { aiSettings, aiLogs, aiCache } from "@/db/schema";
import { categories, orderStatuses } from "@/lib/catalog";
import { after } from "next/server";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
export const dynamic = "force-dynamic";
class ValidationError extends Error {}
const integer = (value: unknown, min = 0, max = 1000000000) => {
  const n = Number(value); if (!Number.isSafeInteger(n) || n < min || n > max) throw new ValidationError("مقدار عددی واردشده معتبر نیست."); return n;
};
const text = (value: unknown, max = 500) => String(value || "").trim().slice(0, max);
function url(value: unknown) {
  const valueString = text(value, 500);
  if (!valueString) return "";
  try { const parsed = new URL(valueString); if (parsed.protocol !== "https:") throw new Error(); return parsed.toString(); } catch { throw new ValidationError("آدرس لینک باید معتبر و با https شروع شود."); }
}
export async function GET() {
  try {
    if (!await isAdmin()) return Response.json({ error: "ابتدا وارد پنل شوید." }, { status: 401 });
    await ensureStore();
    const [catalog, allOrders, preferences, allCoupons, members, inbox, allSlides, allFlash, allTrends, allLooks, allReviews, allQuestions, allGiftCards, allGiftCardUses, allPartners, allPartnerTiers, allPartnerOrders, allArticles, allGuides, allCollections, allClubMembers, allPointsLogs, allWalletTxns, allReferrals, allNotifications] = await Promise.all([
      db.select().from(products).orderBy(desc(products.id)), db.select().from(orders).orderBy(desc(orders.createdAt)).limit(1000),
      db.select().from(settings).where(eq(settings.id, 1)), db.select().from(coupons),
      db.select().from(subscribers).orderBy(desc(subscribers.createdAt)).limit(1000), db.select().from(messages).orderBy(desc(messages.createdAt)).limit(300),
      db.select().from(heroSlides).orderBy(asc(heroSlides.position)), db.select().from(flashSales).orderBy(desc(flashSales.endsAt)),
      db.select().from(trends).orderBy(asc(trends.position)), db.select().from(looks).orderBy(asc(looks.position)),
      db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(500), db.select().from(questions).orderBy(desc(questions.createdAt)).limit(500),
      db.select().from(giftCards).orderBy(desc(giftCards.createdAt)), db.select().from(giftCardUses).orderBy(desc(giftCardUses.createdAt)).limit(500),
      db.select().from(partners).orderBy(desc(partners.id)), db.select().from(partnerTiers).orderBy(partnerTiers.position), db.select().from(partnerOrders).orderBy(desc(partnerOrders.createdAt)).limit(500),
      db.select().from(articles).orderBy(asc(articles.position), desc(articles.id)),
      db.select().from(guides).orderBy(asc(guides.position), desc(guides.id)), db.select().from(collections).orderBy(asc(collections.position), desc(collections.id)),
      db.select().from(customers).orderBy(desc(customers.id)).limit(2000), db.select().from(pointsLogs).orderBy(desc(pointsLogs.id)).limit(300),
      db.select().from(walletTxns).orderBy(desc(walletTxns.id)).limit(300), db.select().from(referrals).orderBy(desc(referrals.id)).limit(500),
      db.select().from(notifications).orderBy(desc(notifications.id)).limit(300),
    ]);
    const allHomeSections = await db.select().from(homeSections).orderBy(asc(homeSections.position), asc(homeSections.id));
    const allPushSubscriptions = await db.select({ id: pushSubscriptions.id, phone: pushSubscriptions.phone, customerId: pushSubscriptions.customerId, createdAt: pushSubscriptions.createdAt }).from(pushSubscriptions).orderBy(desc(pushSubscriptions.id)).limit(500);
    const notifyDashboard = await getNotificationDashboard();
    return Response.json({ products: catalog, orders: allOrders, settings: preferences[0], coupons: allCoupons, subscribers: members, messages: inbox,
      slides: allSlides, flashSales: allFlash, trends: allTrends, looks: allLooks, reviews: allReviews, questions: allQuestions,
      homeSections: allHomeSections,
      giftCards: allGiftCards, giftCardUses: allGiftCardUses,
      partners: allPartners.map(({ passwordHash: _passwordHash, ...partner }) => partner),
      partnerTiers: allPartnerTiers,
      partnerOrders: allPartnerOrders,
      articles: allArticles,
      guides: allGuides,
      collections: allCollections,
      clubMembers: allClubMembers.map(({ passwordHash: _passwordHash, ...member }) => member),
      pointsLogs: allPointsLogs, walletTxns: allWalletTxns, referrals: allReferrals, notifications: allNotifications,
      rules: notifyDashboard.rules, outbox: notifyDashboard.messages, abandonedCarts: notifyDashboard.carts, stockAlerts: notifyDashboard.alerts,
      notificationChannels: channelStatus(),
      pushSubscriptions: allPushSubscriptions,
      integrations: { telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID), payment: true },
      payment: await getPaymentDashboard(),
      returns: await db.select().from(returns).orderBy(desc(returns.id)).limit(300),
      bi: await getBiDashboard(30),
      ai: await getAiDashboard(),
      telegramBot: await getTgDashboard() });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  try {
    if (!await isAdmin()) return Response.json({ error: "نشست شما تمام شده؛ دوباره وارد شوید." }, { status: 401 });
    const body = await request.json();
    if (body.action === "product.save") {
      const p = body.product || {};
      if (text(p.name).length < 3 || !categories.some(c => c.id === p.category)) throw new ValidationError("نام و دسته‌بندی معتبر وارد کنید.");
      const image = text(p.image, 700);
      if (!/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(image)) url(image);
      if (!image) throw new ValidationError("تصویر محصول را انتخاب کنید.");
      const colors = Array.isArray(p.colors) ? p.colors.slice(0, 10).map((c: { name: unknown; hex: unknown }) => ({ name: text(c.name, 30), hex: /^#[a-f\d]{6}$/i.test(String(c.hex)) ? String(c.hex) : "#b8b9b5" })) : [];
      const price = integer(p.price, 1000);
      const compareAt = p.compareAt ? integer(p.compareAt, price) : null;
      const slug = text(p.slug, 150) || `kiya-${Date.now()}`;
      if (!/^[a-z0-9-]+$/.test(slug)) throw new ValidationError("شناسه محصول فقط شامل حروف کوچک انگلیسی، عدد و خط تیره باشد.");
      /* فاز ۱۵ — بازنویسی سئوی محصول (خالی = خودکار) */
      const seoTitle = text(p.seo?.title, 70);
      const seoDescription = text(p.seo?.description, 170);
      const seo = seoTitle || seoDescription ? { title: seoTitle, description: seoDescription } : null;
      /* فاز ۱۶ — گالری چندتصویری (حداکثر ۸ تصویر اضافه) + ویدیوی محصول */
      const galleryPattern = /^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/;
      const gallery = Array.isArray(p.gallery)
        ? p.gallery.slice(0, 8).map((g: unknown) => text(g, 700)).filter((g: string) => { if (!g) return false; if (!galleryPattern.test(g)) url(g); return true; })
        : [];
      const video = text(p.video, 700);
      if (video && !galleryPattern.test(video)) url(video);
      const values = { name: text(p.name, 160), slug, category: String(p.category), description: text(p.description, 4000), material: text(p.material, 200), price, compareAt, stock: integer(p.stock, 0, 100000), image, colors, sizes: Array.isArray(p.sizes) ? p.sizes.slice(0, 30).map((s: unknown) => text(s, 30)).filter(Boolean) : [], featured: !!p.featured, active: !!p.active, seo, gallery, video };
      if (p.id) {
        const previous = (await db.select().from(products).where(eq(products.id, integer(p.id, 1))).limit(1))[0];
        if (!previous) throw new ValidationError("محصول پیدا نشد.");
        await db.update(products).set(values).where(eq(products.id, previous.id));
        // فاز ۱۰ — اطلاع‌رسانی کاهش قیمت و موجود شدن به منتظران
        await processProductAlerts({ id: previous.id, name: values.name, slug: values.slug, price: values.price, stock: values.stock }, { price: previous.price, stock: previous.stock });
      } else {
        const [created] = await db.insert(products).values(values).returning();
        // فاز ۱۲ — انتشار خودکار محصول جدید در کانال تلگرام (پس از پاسخ)
        if (created.active) after(async () => { try { await publishProductToChannel(created, "new"); } catch (error) { console.error("Channel publish failed:", error); } });
      }
    } else if (body.action === "product.archive") {
      await db.update(products).set({ active: false }).where(eq(products.id, integer(body.id, 1)));
    } else if (body.action === "order.update") {
      const status = String(body.status);
      if (!Object.hasOwn(orderStatuses, status)) throw new ValidationError("وضعیت سفارش معتبر نیست.");
      if (!["paid", "unpaid"].includes(body.paymentStatus)) throw new ValidationError("وضعیت پرداخت معتبر نیست.");
      await db.transaction(async tx => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, text(body.id, 40))).for("update");
        if (!order) throw new ValidationError("سفارش پیدا نشد.");
        if (order.status === "cancelled" && status !== "cancelled") throw new ValidationError("سفارش لغوشده قابل فعال‌سازی نیست؛ سفارش جدید ایجاد کنید.");
        if (["shipped", "delivered"].includes(order.status) && status === "cancelled") throw new ValidationError("سفارش ارسال‌شده نیاز به بررسی مرجوعی دارد و قابل لغو مستقیم نیست.");
        if (order.status !== "cancelled" && status === "cancelled") {
          for (const item of [...order.items].sort((a, b) => a.productId - b.productId)) await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}` }).where(eq(products.id, item.productId));
          if (order.coupon) await tx.update(coupons).set({ used: sql`greatest(0, ${coupons.used} - 1)` }).where(eq(coupons.code, order.coupon));
        }
        const previous = { status: order.status, paymentStatus: order.paymentStatus };
        const tracking = text(body.trackingNumber, 100);
        await tx.update(orders).set({ status, paymentStatus: body.paymentStatus, trackingNumber: tracking }).where(eq(orders.id, order.id));
        // فاز ۱۰ — اعلان وضعیت/پرداخت/ارسال سفارش
        await notifyOrderChange({ id: order.id, code: order.code, customerName: order.customerName, phone: order.phone, total: order.total, status, paymentStatus: body.paymentStatus, trackingNumber: tracking }, previous);
      });
    } else if (body.action === "return.update") {
      /* فاز ۱۴ — گردش مرجوعی: requested → approved/rejected → refunded */
      const id = integer(body.id, 1);
      const status = String(body.status);
      if (!["approved", "rejected", "refunded"].includes(status)) throw new ValidationError("وضعیت مرجوعی معتبر نیست.");
      const adminNote = text(body.adminNote, 500);
      const [item] = await db.select().from(returns).where(eq(returns.id, id)).limit(1);
      if (!item) throw new ValidationError("درخواست مرجوعی پیدا نشد.");
      if (item.status === "refunded") throw new ValidationError("این مرجوعی قبلاً تسویه شده است.");
      if (status === "refunded" && item.status !== "approved") throw new ValidationError("برای بازگشت وجه، ابتدا مرجوعی باید تأیید شود.");
      let refundAmount = 0, refundMethod = "";
      if (status === "refunded") {
        const [order] = await db.select().from(orders).where(eq(orders.code, item.orderCode)).limit(1);
        if (!order) throw new ValidationError("سفارش مرجوعی پیدا نشد.");
        refundAmount = integer(body.refundAmount ?? order.total, 1, order.total);
        if (body.refundToWallet === true) {
          if (!order.customerId) throw new ValidationError("این سفارش عضو باشگاه ندارد؛ بازگشت وجه به کیف پول ممکن نیست. روش کارت‌به‌کارت را انتخاب کنید.");
          refundMethod = "wallet";
          await db.update(customers).set({ walletBalance: sql`${customers.walletBalance} + ${refundAmount}` }).where(eq(customers.id, order.customerId));
          await db.insert(walletTxns).values({ customerId: order.customerId, amount: refundAmount, kind: "credit", note: `بازگشت وجه مرجوعی سفارش ${order.code}`, orderCode: order.code });
          await pushNotification(order.customerId, "وجه مرجوعی به کیف پولت برگشت", `${refundAmount.toLocaleString("fa-IR")} تومان بابت مرجوعی سفارش ${order.code}`, "/account/panel");
        } else refundMethod = "card";
        await queueMessage({ channel: "sms", recipient: item.phone, body: `کیا اکسسوری: مبلغ ${refundAmount.toLocaleString("fa-IR")} تومان بابت مرجوعی سفارش ${order.code} ${refundMethod === "wallet" ? "به کیف پول شما" : "به حساب شما"} بازگردانده شد.`, ruleKey: "payment" });
      } else {
        const bodyText = status === "approved" ? `کیا اکسسوری: درخواست مرجوعی سفارش ${item.orderCode} تأیید شد. لطفاً کالا را با پلمب سالم ارسال کنید.${adminNote ? ` ${adminNote}` : ""}` : `کیا اکسسوری: درخواست مرجوعی سفارش ${item.orderCode} رد شد.${adminNote ? ` توضیح: ${adminNote}` : ""}`;
        await queueMessage({ channel: "sms", recipient: item.phone, body: bodyText, ruleKey: "order_status" });
      }
      await db.update(returns).set({ status, adminNote, refundAmount, refundMethod, updatedAt: new Date() }).where(eq(returns.id, id));
      await flushOutbox();
    } else if (body.action === "settings.save") {
      const s = body.settings || {};
      if (text(s.storeName).length < 2) throw new ValidationError("نام فروشگاه را وارد کنید.");
      const heroImage = text(s.heroImage, 700) || "/images/hero-belt.webp";
      if (!/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(heroImage)) url(heroImage);
      const heroLink = text(s.heroLink, 300) || "/shop";
      if (!heroLink.startsWith("/") || heroLink.startsWith("//") || heroLink.includes("\\")) throw new ValidationError("لینک بنر باید یک مسیر داخلی مانند /shop باشد.");
      // فاز ۱۳: منوها — لینک داخلی (/...) یا اورلی (#shipping و ...)؛ اگر فرستاده نشود دست نمی‌خورد
      const cleanLinks = (list: unknown) => (Array.isArray(list) ? list : []).slice(0, 12)
        .map((item: { label?: unknown; href?: unknown }) => ({ label: text(item?.label, 40), href: text(item?.href, 300) }))
        .filter(item => item.label.length >= 2 && (item.href.startsWith("#") || (item.href.startsWith("/") && !item.href.startsWith("//") && !item.href.includes("\\"))));
      const menusUpdate = s.menus === undefined ? {} : s.menus === null ? { menus: null } : {
        menus: {
          header: cleanLinks(s.menus.header),
          shopTitle: text(s.menus.shopTitle, 40) || "یک انتخاب خوب",
          shop: cleanLinks(s.menus.shop),
          helpTitle: text(s.menus.helpTitle, 40) || "کنار شماییم",
          help: cleanLinks(s.menus.help),
        },
      };
      if ("menus" in menusUpdate && menusUpdate.menus && !menusUpdate.menus.header.length) throw new ValidationError("منوی هدر حداقل یک لینک لازم دارد.");
      // فاز ۱۴ — تنظیمات پرداخت (undefined یعنی بدون تغییر)
      const paymentUpdate = s.payment === undefined ? {} : s.payment === null ? { payment: null } : (() => {
        const p = s.payment || {};
        const cardNumber = text(p.cardNumber, 30).replace(/[^\d-]/g, "");
        if (p.cardEnabled !== false && cardNumber && !/^\d{16}$|^\d{4}-\d{4}-\d{4}-\d{4}$/.test(cardNumber)) throw new ValidationError("شماره کارت باید ۱۶ رقم باشد (با یا بدون خط تیره).");
        return { payment: {
          zarinpalEnabled: p.zarinpalEnabled !== false,
          merchantId: text(p.merchantId, 60),
          sandbox: p.sandbox === true,
          cardEnabled: p.cardEnabled !== false,
          cardNumber,
          cardName: text(p.cardName, 60),
          courierEnabled: p.courierEnabled === true,
          courierCost: integer(p.courierCost ?? 0),
          courierNote: text(p.courierNote, 200),
        } };
      })();
      /* فاز ۱۵ — سئوی سراسری (undefined = بدون تغییر) */
      const seoUpdate = s.seo === undefined ? {} : s.seo === null ? { seo: null } : { seo: {
        metaTitle: text(s.seo.metaTitle, 70),
        metaDescription: text(s.seo.metaDescription, 170),
        ogImage: (() => { const img = text(s.seo.ogImage, 700); if (img && !/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(img)) url(img); return img; })(),
        googleVerification: text(s.seo.googleVerification, 120).replace(/[^\w-]/g, ""),
      } };
      await db.update(settings).set({ storeName: text(s.storeName, 100), announcement: text(s.announcement, 200), shippingThreshold: integer(s.shippingThreshold), shippingCost: integer(s.shippingCost), instagramUrl: url(s.instagramUrl), telegramUrl: url(s.telegramUrl), botUrl: url(s.botUrl), supportPhone: text(s.supportPhone, 30), address: text(s.address, 500), heroTitle: text(s.heroTitle, 40) || "استایل تو،", heroAccent: text(s.heroAccent, 40) || "امضای تو.", heroDescription: text(s.heroDescription, 250), heroImage, heroButton: text(s.heroButton, 35) || "کالکشن رو ببین", heroLink, ...menusUpdate, ...paymentUpdate, ...seoUpdate }).where(eq(settings.id, 1));
    } else if (body.action === "coupon.save") {
      const c = body.coupon || {};
      const code = text(c.code, 30).toUpperCase();
      if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new ValidationError("کد تخفیف باید ۳ تا ۳۰ حرف انگلیسی یا عدد باشد.");
      const type = c.type === "fixed" ? "fixed" : "percent";
      const percent = integer(c.percent, 1, type === "fixed" ? 1000000000 : 70);
      if (type === "percent" && percent > 70) throw new ValidationError("درصد تخفیف نمی‌تواند بیشتر از ۷۰ باشد.");
      const minOrder = integer(c.minOrder, 0, 1000000000);
      const maxDiscount = integer(c.maxDiscount, 0, 1000000000);
      const perUserLimit = integer(c.perUserLimit, 0, 1000);
      let expiresAt: Date | null = null;
      if (c.expiresAt) {
        expiresAt = new Date(String(c.expiresAt));
        if (Number.isNaN(expiresAt.getTime())) throw new ValidationError("تاریخ انقضا معتبر نیست.");
      }
      const rawCategoryIds: unknown[] = Array.isArray(c.categoryIds) ? c.categoryIds : [];
      const categoryIds = [...new Set(rawCategoryIds.map(id => String(id)).filter(id => categories.some(cat => cat.id === id)))].slice(0, 20);
      const rawProductIds: unknown[] = Array.isArray(c.productIds) ? c.productIds : [];
      const productIds = [...new Set(rawProductIds.map(id => Number(integer(id, 1))))].slice(0, 50);
      const values = {
        code, percent, maxUses: integer(c.maxUses, 1, 100000), active: !!c.active,
        type, minOrder, maxDiscount, firstOrderOnly: !!c.firstOrderOnly,
        categoryIds, productIds, expiresAt, perUserLimit,
      };
      await db.insert(coupons).values(values).onConflictDoUpdate({
        target: coupons.code,
        set: {
          percent: values.percent, maxUses: values.maxUses, active: values.active,
          type: values.type, minOrder: values.minOrder, maxDiscount: values.maxDiscount,
          firstOrderOnly: values.firstOrderOnly, categoryIds: values.categoryIds,
          productIds: values.productIds, expiresAt: values.expiresAt, perUserLimit: values.perUserLimit,
        },
      });
    } else if (body.action === "partner.status") {
      const id = integer(body.id, 1);
      const status = ["pending", "approved", "rejected", "suspended"].includes(String(body.status)) ? String(body.status) : "pending";
      const current = (await db.select().from(partners).where(eq(partners.id, id)).limit(1))[0];
      if (!current) throw new ValidationError("همکار پیدا نشد.");
      const updates: Record<string, unknown> = { status, note: text(body.note, 500) || current.note };
      if (status === "approved" && !current.approvedAt) updates.approvedAt = new Date();
      if (integer(body.tierId, 0) > 0) updates.tierId = integer(body.tierId, 0);
      await db.update(partners).set(updates).where(eq(partners.id, id));
      // فاز ۱۰ — اطلاع‌رسانی وضعیت همکاری به همکار
      await notifyPartnerUpdate(current.phone, status);
      if (status === "approved" && !current.passwordHash) {
        // تأیید بدون رمز: رمز موقت ساخته و در پاسخ برگردانده می‌شود تا مدیر به همکار بدهد
        const temporary = Math.random().toString(36).slice(2, 10).toUpperCase();
        const { partnerPasswordHash } = await import("@/lib/partner-auth");
        await db.update(partners).set({ passwordHash: partnerPasswordHash(temporary) }).where(eq(partners.id, id));
        return Response.json({ ok: true, temporaryPassword: temporary });
      }
    } else if (body.action === "partner.tier") {
      const id = integer(body.id, 1);
      const tierId = integer(body.tierId, 1);
      const tier = (await db.select().from(partnerTiers).where(eq(partnerTiers.id, tierId)).limit(1))[0];
      if (!tier) throw new ValidationError("لایهٔ قیمت پیدا نشد.");
      await db.update(partners).set({ tierId }).where(eq(partners.id, id));
    } else if (body.action === "partner.delete") {
      await db.delete(partnerOrders).where(eq(partnerOrders.partnerId, integer(body.id, 1)));
      await db.delete(partners).where(eq(partners.id, integer(body.id, 1)));
    } else if (body.action === "partner-tier.save") {
      const t = body.tier || {};
      const key = text(t.key, 40).toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (!/^[a-z0-9_-]{3,40}$/.test(key)) throw new ValidationError("کلید لایه باید ۳ تا ۴۰ حرف انگلیسی کوچک باشد.");
      const name = text(t.name, 60);
      if (name.length < 2) throw new ValidationError("نام لایه را وارد کنید.");
      const discountType = t.discountType === "fixed" ? "fixed" : "percent";
      const discountValue = integer(t.discountValue, 0, discountType === "fixed" ? 1000000000 : 90);
      const values = { key, name, discountType, discountValue, minOrder: integer(t.minOrder, 0, 1000000000), description: text(t.description, 300), position: integer(t.position, 0, 100), active: t.active !== false };
      await db.insert(partnerTiers).values(values).onConflictDoUpdate({
        target: partnerTiers.key,
        set: { name: values.name, discountType: values.discountType, discountValue: values.discountValue, minOrder: values.minOrder, description: values.description, position: values.position, active: values.active },
      });
    } else if (body.action === "partner-tier.delete") {
      await db.delete(partnerTiers).where(eq(partnerTiers.key, text(body.key, 40)));
    } else if (body.action === "partner-order.status") {
      const code = text(body.code, 30);
      const status = ["pending", "confirmed", "shipped", "delivered", "cancelled"].includes(String(body.status)) ? String(body.status) : "pending";
      const current = (await db.select().from(partnerOrders).where(eq(partnerOrders.code, code)).limit(1))[0];
      if (!current) throw new ValidationError("سفارش عمده پیدا نشد.");
      const updates: Record<string, unknown> = { status, note: text(body.note, 500) || current.note, trackingNumber: text(body.trackingNumber, 40) || current.trackingNumber };
      if (status === "confirmed" && !current.invoiceNumber) updates.invoiceNumber = invoiceNumberFor(code);
      await db.update(partnerOrders).set(updates).where(eq(partnerOrders.code, code));
      if (status === "cancelled") {
        const items = current.items as { productId: number; quantity: number }[];
        for (const item of items) await db.update(products).set({ stock: sql`${products.stock} + ${item.quantity}` }).where(eq(products.id, item.productId));
      }
    } else if (body.action === "giftcard.save") {
      const g = body.giftCard || {};
      const code = text(g.code, 30).toUpperCase();
      if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new ValidationError("کد گیفت‌کارت باید ۳ تا ۳۰ حرف انگلیسی یا عدد باشد.");
      const balance = integer(g.balance, 1000, 100000000);
      let expiresAt: Date | null = null;
      if (g.expiresAt) {
        expiresAt = new Date(String(g.expiresAt));
        if (Number.isNaN(expiresAt.getTime())) throw new ValidationError("تاریخ انقضا معتبر نیست.");
      }
      const isNew = !(await db.select({ code: giftCards.code }).from(giftCards).where(eq(giftCards.code, code))).length;
      const values = { code, balance, initialBalance: balance, active: g.active !== false, expiresAt, note: text(g.note, 300) };
      if (isNew) await db.insert(giftCards).values(values);
      else await db.update(giftCards).set({ balance, active: values.active, expiresAt, note: values.note }).where(eq(giftCards.code, code));
    } else if (body.action === "giftcard.delete") {
      await db.delete(giftCards).where(eq(giftCards.code, text(body.code, 30).toUpperCase()));
    } else if (body.action === "slide.save") {
      const v = body.slide || {};
      const image = text(v.image, 700) || "/images/hero-belt.webp";
      if (!/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(image)) url(image);
      const link = text(v.link, 300) || "/shop";
      if (!link.startsWith("/") || link.startsWith("//") || link.includes("\\")) throw new ValidationError("لینک بنر باید یک مسیر داخلی مانند /shop باشد.");
      // فاز ۱۳: تصویر موبایل + بازهٔ نمایش کمپین
      const mobileImage = text(v.mobileImage, 700);
      if (mobileImage && !/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(mobileImage)) url(mobileImage);
      const startsAt = v.startsAt ? new Date(String(v.startsAt)) : null;
      const endsAt = v.endsAt ? new Date(String(v.endsAt)) : null;
      if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new ValidationError("زمان شروع/پایان بنر معتبر نیست.");
      if (startsAt && endsAt && endsAt <= startsAt) throw new ValidationError("پایان نمایش بنر باید بعد از شروع آن باشد.");
      const values = { eyebrow: text(v.eyebrow, 60), title: text(v.title, 40) || "استایل تو،", accent: text(v.accent, 40), description: text(v.description, 250), image, button: text(v.button, 35) || "مشاهده", link, label: text(v.label, 60), mobileImage, startsAt, endsAt, position: integer(v.position, 0, 50), active: v.active !== false };
      if (v.id) await db.update(heroSlides).set(values).where(eq(heroSlides.id, integer(v.id, 1)));
      else await db.insert(heroSlides).values(values);
    } else if (body.action === "slide.delete") {
      await db.delete(heroSlides).where(eq(heroSlides.id, integer(body.id, 1)));
    } else if (body.action === "flash.save") {
      const v = body.flash || {};
      if (text(v.title, 80).length < 2) throw new ValidationError("عنوان فروش ویژه را وارد کنید.");
      const endsAt = new Date(String(v.endsAt));
      if (Number.isNaN(endsAt.getTime())) throw new ValidationError("زمان پایان فروش ویژه معتبر نیست.");
      const rawIds: unknown[] = Array.isArray(v.productIds) ? v.productIds : [];
      const productIds: number[] = [...new Set(rawIds.map(id => Number(integer(id, 1))))].slice(0, 12);
      if (!productIds.length) throw new ValidationError("حداقل یک محصول به فروش ویژه اضافه کنید.");
      const values = { title: text(v.title, 80), subtitle: text(v.subtitle, 200), productIds, endsAt, active: v.active !== false };
      if (v.id) await db.update(flashSales).set(values).where(eq(flashSales.id, integer(v.id, 1)));
      else {
        await db.insert(flashSales).values(values);
        // فاز ۱۲ — انتشار فروش ویژهٔ جدید در کانال تلگرام
        if (values.active) after(async () => {
          try {
            const included = await db.select().from(products).where(inArray(products.id, productIds));
            for (const item of included.slice(0, 3)) await publishProductToChannel(item, "flash");
          } catch (error) { console.error("Channel publish failed:", error); }
        });
      }
    } else if (body.action === "flash.delete") {
      await db.delete(flashSales).where(eq(flashSales.id, integer(body.id, 1)));
    } else if (body.action === "trend.save") {
      const v = body.trend || {};
      if (text(v.title, 80).length < 2) throw new ValidationError("عنوان ترند را وارد کنید.");
      const rawIds: unknown[] = Array.isArray(v.productIds) ? v.productIds : [];
      const productIds: number[] = [...new Set(rawIds.map(id => Number(integer(id, 1))))].slice(0, 12);
      const values = { title: text(v.title, 80), subtitle: text(v.subtitle, 200), productIds, position: integer(v.position, 0, 50), active: v.active !== false };
      if (v.id) await db.update(trends).set(values).where(eq(trends.id, integer(v.id, 1)));
      else await db.insert(trends).values(values);
    } else if (body.action === "trend.delete") {
      await db.delete(trends).where(eq(trends.id, integer(body.id, 1)));
    } else if (body.action === "look.save") {
      const v = body.look || {};
      if (text(v.title, 80).length < 2) throw new ValidationError("عنوان ست را وارد کنید.");
      const image = text(v.image, 700) || "/images/hero-belt.webp";
      if (!/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(image)) url(image);
      const rawIds: unknown[] = Array.isArray(v.productIds) ? v.productIds : [];
      const productIds: number[] = [...new Set(rawIds.map(id => Number(integer(id, 1))))].slice(0, 12);
      if (!productIds.length) throw new ValidationError("حداقل یک محصول به ست اضافه کنید.");
      const values = { title: text(v.title, 80), description: text(v.description, 400), image, productIds, position: integer(v.position, 0, 50), active: v.active !== false };
      if (v.id) await db.update(looks).set(values).where(eq(looks.id, integer(v.id, 1)));
      else await db.insert(looks).values(values);
    } else if (body.action === "look.delete") {
      await db.delete(looks).where(eq(looks.id, integer(body.id, 1)));
    } else if (body.action === "customer.wallet") {
      /* فاز ۹ — شارژ یا کسر دستی اعتبار کیف پول عضو باشگاه */
      const customerId = integer(body.customerId, 1);
      const amount = integer(body.amount, -200_000_000, 200_000_000);
      const note = text(body.note, 200) || "تغییر دستی توسط فروشگاه";
      if (!amount) throw new ValidationError("مبلغ اعتبار را وارد کنید.");
      const [member] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!member) throw new ValidationError("عضو باشگاه پیدا نشد.");
      if (amount < 0 && member.walletBalance + amount < 0) throw new ValidationError("اعتبار عضو کمتر از مبلغ درخواستی است.");
      const next = await db.update(customers).set({ walletBalance: sql`${customers.walletBalance} + ${amount}` }).where(eq(customers.id, customerId)).returning({ walletBalance: customers.walletBalance });
      await db.insert(walletTxns).values({ customerId, amount, kind: amount > 0 ? "credit" : "debit", note });
      await pushNotification(customerId, amount > 0 ? "اعتبار به کیف پولت اضافه شد" : "اعتبار از کیف پولت کم شد", `${note} — ${Math.abs(amount).toLocaleString("fa-IR")} تومان`, "/account/panel");
      return Response.json({ ok: true, message: `اعتبار عضو ${next[0]?.walletBalance.toLocaleString("fa-IR")} تومان شد.` });
    } else if (body.action === "customer.points") {
      /* فاز ۹ — اعطای دستی امتیاز به عضو باشگاه */
      const customerId = integer(body.customerId, 1);
      const points = integer(body.points, -10_000_000, 10_000_000);
      const reason = text(body.reason, 200) || "تغییر دستی توسط فروشگاه";
      if (!points) throw new ValidationError("مقدار امتیاز را وارد کنید.");
      const [member] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!member) throw new ValidationError("عضو باشگاه پیدا نشد.");
      if (points < 0 && member.points + points < 0) throw new ValidationError("امتیاز عضو کمتر از مقدار درخواستی است.");
      await addPoints(customerId, points, reason);
      await pushNotification(customerId, points > 0 ? "امتیاز هدیه گرفتید" : "امتیاز کم شد", `${reason} — ${Math.abs(points).toLocaleString("fa-IR")} امتیاز`, "/account/panel");
      return Response.json({ ok: true, message: "امتیاز عضو ثبت شد." });
    } else if (body.action === "review.approve") {
      const id = integer(body.id, 1);
      await db.update(reviews).set({ approved: true }).where(eq(reviews.id, id));
      // فاز ۹ — پاداش امتیاز نظر تأییدشده برای مشتری
      const [review] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
      if (review?.phone) {
        const [owner] = await db.select().from(customers).where(eq(customers.phone, review.phone)).limit(1);
        if (owner) {
          await addPoints(owner.id, pointsRules.review, "ثبت نظر تأییدشده");
          await db.update(customers).set({ reviewCount: owner.reviewCount + 1 }).where(eq(customers.id, owner.id));
          await pushNotification(owner.id, "امتیاز نظرت اضافه شد", `ثبت نظر تأییدشده ${pointsRules.review} امتیاز هدیه داد.`, "/account/panel");
        }
      }
    } else if (body.action === "review.delete") {
      await db.delete(reviews).where(eq(reviews.id, integer(body.id, 1)));
    } else if (body.action === "question.save") {
      const answer = text(body.answer, 2000);
      if (!answer) throw new ValidationError("متن پاسخ را وارد کنید.");
      await db.update(questions).set({ answer, approved: true }).where(eq(questions.id, integer(body.id, 1)));
    } else if (body.action === "question.approve") {
      await db.update(questions).set({ approved: true }).where(eq(questions.id, integer(body.id, 1)));
    } else if (body.action === "question.delete") {
      await db.delete(questions).where(eq(questions.id, integer(body.id, 1)));
    } else if (body.action === "message.read") {
      await db.update(messages).set({ read: true }).where(eq(messages.id, integer(body.id, 1)));
    } else if (body.action === "article.save") {
      const v = body.article || {};
      const title = text(v.title, 140);
      if (title.length < 3) throw new ValidationError("عنوان مطلب را وارد کنید.");
      const allowedSections = ["main-story", "trending-now", "fashion-news", "accessory-trend", "color-of-day", "style-inspiration", "product-spotlight", "editors-pick"];
      const section = text(v.section, 40);
      if (!allowedSections.includes(section)) throw new ValidationError("سکشن مطلب معتبر نیست.");
      const colorHex = text(v.colorHex, 9) || "#D19B44";
      if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) throw new ValidationError("کد رنگ باید مثل #D19B44 باشد.");
      const image = text(v.image, 700) || "/images/hero-belt.webp";
      if (!/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(image)) url(image);
      const rawIds: unknown[] = Array.isArray(v.productIds) ? v.productIds : [];
      const productIds: number[] = [...new Set(rawIds.map(id => Number(integer(id, 1))))].slice(0, 8);
      const editionDate = new Date(String(v.editionDate || ""));
      const publishAt = new Date(String(v.publishAt || ""));
      if (Number.isNaN(editionDate.getTime())) throw new ValidationError("تاریخ نسخهٔ روزنامه معتبر نیست.");
      if (Number.isNaN(publishAt.getTime())) throw new ValidationError("زمان انتشار معتبر نیست.");
      const currentId = v.id ? integer(v.id, 1) : 0;
      const baseSlug = slugify(text(v.slug, 80) || title) || "mabal";
      const existing = await db.select({ id: articles.id, slug: articles.slug }).from(articles);
      const takenSlugs = new Set(existing.map(row => row.slug));
      let slug = baseSlug;
      if (takenSlugs.has(slug)) {
        const owner = existing.find(row => row.slug === slug);
        if (!currentId || owner?.id !== currentId) {
          let suffix = 2;
          while (takenSlugs.has(`${baseSlug}-${suffix}`)) suffix++;
          slug = `${baseSlug}-${suffix}`;
        }
      }
      const values = {
        slug, section, title, kicker: text(v.kicker, 60), excerpt: text(v.excerpt, 400), body: text(v.body, 20000),
        image, colorHex, author: text(v.author, 60) || "تیم کیا", readMinutes: integer(v.readMinutes, 1, 60),
        editionDate, publishAt, productIds, shopLabel: text(v.shopLabel, 40) || "SHOP THE TREND",
        position: integer(v.position, 0, 50), active: v.active !== false,
      };
      if (v.id) await db.update(articles).set(values).where(eq(articles.id, integer(v.id, 1)));
      else await db.insert(articles).values(values);
    } else if (body.action === "article.delete") {
      await db.delete(articles).where(eq(articles.id, integer(body.id, 1)));
    } else if (body.action === "guide.save") {
      const v = body.guide || {};
      const title = text(v.title, 140);
      if (title.length < 3) throw new ValidationError("عنوان راهنما را وارد کنید.");
      const allowedTopics = ["sizing", "knotting", "pairing", "metal", "layering", "care"];
      const topic = text(v.topic, 40);
      if (!allowedTopics.includes(topic)) throw new ValidationError("موضوع راهنما معتبر نیست.");
      const image = text(v.image, 700) || "/images/hero-belt.webp";
      if (!/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(image)) url(image);
      const rawIds: unknown[] = Array.isArray(v.productIds) ? v.productIds : [];
      const productIds: number[] = [...new Set(rawIds.map(id => Number(integer(id, 1))))].slice(0, 8);
      const publishAt = new Date(String(v.publishAt || ""));
      if (Number.isNaN(publishAt.getTime())) throw new ValidationError("زمان انتشار معتبر نیست.");
      const currentId = v.id ? integer(v.id, 1) : 0;
      const baseSlug = slugify(text(v.slug, 80) || title) || "guide";
      const existing = await db.select({ id: guides.id, slug: guides.slug }).from(guides);
      const takenSlugs = new Set(existing.map(row => row.slug));
      let slug = baseSlug;
      if (takenSlugs.has(slug)) {
        const owner = existing.find(row => row.slug === slug);
        if (!currentId || owner?.id !== currentId) {
          let suffix = 2;
          while (takenSlugs.has(`${baseSlug}-${suffix}`)) suffix++;
          slug = `${baseSlug}-${suffix}`;
        }
      }
      const values = {
        slug, topic, title, kicker: text(v.kicker, 60), excerpt: text(v.excerpt, 400), body: text(v.body, 20000),
        image, author: text(v.author, 60) || "تیم کیا", readMinutes: integer(v.readMinutes, 1, 60),
        publishAt, productIds, position: integer(v.position, 0, 50), active: v.active !== false,
      };
      if (currentId) await db.update(guides).set(values).where(eq(guides.id, currentId));
      else await db.insert(guides).values(values);
    } else if (body.action === "guide.delete") {
      await db.delete(guides).where(eq(guides.id, integer(body.id, 1)));
    } else if (body.action === "collection.save") {
      const v = body.collection || {};
      const name = text(v.name, 80);
      if (name.length < 2) throw new ValidationError("نام کالکشن را وارد کنید.");
      const colorHex = text(v.colorHex, 9) || "#D19B44";
      if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) throw new ValidationError("کد رنگ باید مثل #D19B44 باشد.");
      const image = text(v.image, 700) || "/images/hero-belt.webp";
      if (!/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(image)) url(image);
      const rawIds: unknown[] = Array.isArray(v.productIds) ? v.productIds : [];
      const productIds: number[] = [...new Set(rawIds.map(id => Number(integer(id, 1))))].slice(0, 12);
      const currentId = v.id ? integer(v.id, 1) : 0;
      const baseSlug = slugify(text(v.slug, 80) || name) || "collection";
      const existing = await db.select({ id: collections.id, slug: collections.slug }).from(collections);
      const takenSlugs = new Set(existing.map(row => row.slug));
      let slug = baseSlug;
      if (takenSlugs.has(slug)) {
        const owner = existing.find(row => row.slug === slug);
        if (!currentId || owner?.id !== currentId) {
          let suffix = 2;
          while (takenSlugs.has(`${baseSlug}-${suffix}`)) suffix++;
          slug = `${baseSlug}-${suffix}`;
        }
      }
      const values = {
        slug, name, label: text(v.label, 40), subtitle: text(v.subtitle, 120), description: text(v.description, 500),
        image, colorHex, badge: text(v.badge, 20), productIds, featured: v.featured === true,
        position: integer(v.position, 0, 50), active: v.active !== false,
      };
      if (currentId) await db.update(collections).set(values).where(eq(collections.id, currentId));
      else await db.insert(collections).values(values);
      // فاز ۱۰ — اعلام کالکشن جدید به مشتریان و خبرنامه
      await notifyNewCollection(name, slug);
    } else if (body.action === "collection.delete") {
      await db.delete(collections).where(eq(collections.id, integer(body.id, 1)));
    } else if (body.action === "rule.save") {
      const key = text(body.key, 40).replace(/[^a-z0-9_]/g, "_");
      const trigger = String(body.trigger || "");
      if (!key || !Object.hasOwn(triggerLabels, trigger)) throw new ValidationError("رویداد معتبر نیست.");
      const title = text(body.title, 120) || triggerLabels[trigger as Trigger];
      const channels = (Array.isArray(body.channels) ? body.channels : []).filter((channel: unknown): channel is Channel => Object.hasOwn(channelLabels, channel as string));
      if (!channels.length) throw new ValidationError("حداقل یک کانال را انتخاب کنید.");
      const values = {
        key, trigger, title, channels,
        smsBody: text(body.smsBody, 700), emailSubject: text(body.emailSubject, 200), emailBody: text(body.emailBody, 3000),
        pushBody: text(body.pushBody, 300), delayMinutes: integer(body.delayMinutes, 0, 10080), active: body.active !== false,
        position: integer(body.position, 0, 99),
      };
      const existing = (await db.select().from(alertRules).where(eq(alertRules.key, key)).limit(1))[0];
      if (existing) await db.update(alertRules).set(values).where(eq(alertRules.id, existing.id));
      else await db.insert(alertRules).values(values);
    } else if (body.action === "rule.delete") {
      const key = text(body.key, 40);
      const existing = (await db.select().from(alertRules).where(eq(alertRules.key, key)).limit(1))[0];
      if (!existing) throw new ValidationError("قانون پیدا نشد.");
      await db.delete(alertRules).where(eq(alertRules.id, existing.id));
    } else if (body.action === "rule.reset") {
      await db.delete(alertRules);
      await ensureAlertRules();
    } else if (body.action === "rule.test") {
      const key = text(body.key, 40);
      const rule = (await db.select().from(alertRules).where(eq(alertRules.key, key)).limit(1))[0];
      if (!rule) throw new ValidationError("قانون پیدا نشد.");
      const channel: Channel = ["sms", "email", "push", "telegram"].includes(String(body.channel)) ? (String(body.channel) as Channel) : "sms";
      const recipient = channel === "email" ? text(body.recipient, 200) : text(body.recipient, 20);
      if (!recipient) throw new ValidationError("شماره یا ایمیل مقصد را وارد کنید.");
      if (channel === "sms" && !/^09\d{9}$/.test(recipient)) throw new ValidationError("شماره موبایل باید مثل 09121234567 باشد.");
      if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(recipient)) throw new ValidationError("ایمیل معتبر نیست.");
      const sample = { name: "مشتری کیا", order: "KIYA-1001", status: "در حال ارسال", amount: "۱٬۲۵۰٬۰۰۰", tracking: "IR123456789", product: "کمربند چرم طبیعی", points: "۲۵۰", code: "WELCOME10", link: "https://kiya.example/shop" };
      await queueMessage({
        channel, recipient,
        subject: channel === "email" ? renderTemplate(rule.emailSubject || `پیام آزمایشی از کیا: ${rule.title}`, sample) : "",
        body: channel === "email" ? renderTemplate(rule.emailBody || rule.smsBody, sample) : channel === "push" ? renderTemplate(rule.pushBody || rule.smsBody, sample) : renderTemplate(rule.smsBody || rule.pushBody, sample),
        link: sample.link, ruleKey: `${rule.key}:test`,
      });
      const sent = await flushOutbox(5);
      return Response.json({ ok: true, message: `پیام آزمایشی از کانال ${channelLabels[channel as Channel]} ارسال شد.`, delivered: sent });
    } else if (body.action === "outbox.retry") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map((id: unknown) => Number(id)).filter((id: number) => Number.isSafeInteger(id) && id > 0).slice(0, 100);
      if (!ids.length) {
        await db.update(outbox).set({ status: "pending", error: "", attempts: 0 }).where(eq(outbox.status, "failed"));
      } else {
        await db.update(outbox).set({ status: "pending", error: "", attempts: 0 }).where(inArray(outbox.id, ids));
      }
      const delivered = await flushOutbox(100);
      return Response.json({ ok: true, message: "ارسال مجدد انجام شد.", delivered });
    } else if (body.action === "outbox.clear") {
      const days = integer(body.days, 0, 365);
      if (days > 0) await db.delete(outbox).where(sql`${outbox.createdAt} < now() - interval '${sql.raw(String(days))} days'`);
      else await db.delete(outbox).where(sql`${outbox.status} <> 'pending'`);
      return Response.json({ ok: true, message: "صف پیام‌ها پاک‌سازی شد." });
    } else if (body.action === "cart.remind") {
      const result = await remindAbandonedCart(integer(body.id, 1));
      if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ ok: true, message: "یادآوری برای مشتری ارسال شد." });
    } else if (body.action === "broadcast") {
      const title = text(body.title, 120);
      const message = text(body.message, 900);
      if (title.length < 3 || message.length < 5) throw new ValidationError("عنوان و متن پیام همگانی را کامل وارد کنید.");
      const audience = ["push", "customers", "all"].includes(String(body.audience)) ? String(body.audience) : "all";
      const link = text(body.link, 200).startsWith("/") ? text(body.link, 200) : "/shop";
      if (audience === "push") {
        const count = await broadcastPush(title, message, link);
        return Response.json({ ok: true, message: `پیام به ${count} مرورگر مشترک‌شده ارسال شد.` });
      }
      const targets = (await db.select({ id: customers.id, phone: customers.phone, email: customers.email }).from(customers).limit(5000));
      const channels = audience === "customers" ? ["web"] : ["sms", "email", "web"];
      let queued = 0;
      for (const target of targets) {
        if (channels.includes("web")) await db.insert(notifications).values({ customerId: target.id, title, body: message, link });
        if (channels.includes("sms") && target.phone) { await queueMessage({ channel: "sms", recipient: target.phone, body: message, subject: title, link, ruleKey: "broadcast", customerId: target.id }); queued++; }
        if (channels.includes("email") && target.email) { await queueMessage({ channel: "email", recipient: target.email, body: message, subject: title, link, ruleKey: "broadcast", customerId: target.id }); queued++; }
      }
      const delivered = await flushOutbox(200);
      return Response.json({ ok: true, message: `پیام همگانی برای ${targets.length} مشتری ثبت و ${delivered} پیام ارسال شد.`, delivered });
    } else if (body.action === "ai.settings") {
      /* فاز ۱۱: ذخیرهٔ تنظیمات سرویس AI از پنل — بدون نیاز به کد */
      const incoming = body.settings || {};
      const featureIds = ["stylist", "search", "size", "recommend", "captions", "trends"];
      const features: Record<string, boolean> = {};
      for (const id of featureIds) features[id] = incoming.features?.[id] !== false;
      const baseUrl = text(incoming.baseUrl, 300);
      if (baseUrl && !/^https:\/\//.test(baseUrl)) throw new ValidationError("آدرس سرویس AI باید با https شروع شود.");
      const values = {
        enabled: !!incoming.enabled,
        baseUrl: baseUrl.replace(/\/+$/, ""),
        model: text(incoming.model, 100),
        temperature: integer(incoming.temperature ?? 70, 0, 200),
        maxTokens: integer(incoming.maxTokens ?? 700, 100, 4000),
        monthlyTokenBudget: integer(incoming.monthlyTokenBudget ?? 0, 0, 1000000000),
        features,
        assistantName: text(incoming.assistantName, 50) || "مشاور کیا",
        ...(typeof incoming.apiKey === "string" && incoming.apiKey !== "__keep__" ? { apiKey: incoming.apiKey.trim().slice(0, 300) } : {}),
      };
      await db.insert(aiSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: aiSettings.id, set: values });
      return Response.json({ ok: true, message: "تنظیمات هوش مصنوعی ذخیره شد." });
    } else if (body.action === "ai.test") {
      const result = await testAiConnection();
      return Response.json({ ok: result.ok, message: result.message, latency: result.latency });
    } else if (body.action === "ai.caption") {
      const captions = await generateCaptions(integer(body.productId, 1));
      if (!captions) return Response.json({ error: "محصول پیدا نشد." }, { status: 404 });
      return Response.json({ ok: true, captions });
    } else if (body.action === "ai.trend") {
      const result = await analyzeTrends();
      return Response.json({ ok: true, report: result.report, stats: result.stats, source: result.source });
    } else if (body.action === "ai.logs.clear") {
      await db.delete(aiLogs);
      return Response.json({ ok: true, message: "گزارش مصرف پاک شد." });
    } else if (body.action === "ai.cache.clear") {
      await db.delete(aiCache);
      return Response.json({ ok: true, message: "کش پاسخ‌ها خالی شد." });
    } else if (body.action === "home.section.save") {
      /* فاز ۱۳: Homepage Builder — ذخیرهٔ سکشن (داخلی: فقط فعال/عنوان؛ دلخواه: همهٔ تنظیمات) */
      const v = body.section || {};
      const builtinKeys = ["hero", "trust", "categories", "trending", "featured", "flash", "editorial", "newdrop", "looks", "stylenote", "newsletter"];
      const isCustom = !builtinKeys.includes(String(v.key));
      const config = v.config || {};
      const image = text(config.image, 700);
      if (image && !/^\/(?:images\/[\w.-]+|api\/media\/[a-f\d-]{36})$/.test(image)) url(image);
      const sectionLink = text(config.link, 300) || "/shop";
      if (!sectionLink.startsWith("/") || sectionLink.startsWith("//") || sectionLink.includes("\\")) throw new ValidationError("لینک سکشن باید یک مسیر داخلی مانند /shop باشد.");
      const background = text(config.background, 30);
      if (background && !/^#[a-f\d]{6}$/i.test(background)) throw new ValidationError("رنگ پس‌زمینه باید کد hex مانند #1a1a17 باشد.");
      const rawIds: unknown[] = Array.isArray(config.productIds) ? config.productIds : [];
      const sectionProductIds = [...new Set(rawIds.map(id => Number(integer(id, 1))))].slice(0, 8);
      if (isCustom && text(v.title, 80).length < 2) throw new ValidationError("عنوان سکشن را وارد کنید.");
      const values = {
        title: text(v.title, 80), subtitle: text(v.subtitle, 120),
        layout: ["banner", "products", "split"].includes(v.layout) ? String(v.layout) : "banner",
        config: isCustom ? { image, text: text(config.text, 400), cta: text(config.cta, 40), link: sectionLink, productIds: sectionProductIds, background } : {},
        active: v.active !== false,
      };
      if (v.id) {
        const [existing] = await db.select().from(homeSections).where(eq(homeSections.id, integer(v.id, 1)));
        if (!existing) throw new ValidationError("سکشن پیدا نشد.");
        // key سکشن بعد از ساخت تغییر نمی‌کند
        await db.update(homeSections).set(builtinKeys.includes(existing.key) ? { active: values.active } : values).where(eq(homeSections.id, existing.id));
      } else {
        const [{ maxPosition }] = await db.select({ maxPosition: sql<number>`coalesce(max(position), -1)` }).from(homeSections);
        await db.insert(homeSections).values({ ...values, key: "custom", position: Number(maxPosition) + 1 });
      }
      return Response.json({ ok: true, message: "سکشن صفحهٔ اصلی ذخیره شد." });
    } else if (body.action === "home.section.delete") {
      const [existing] = await db.select().from(homeSections).where(eq(homeSections.id, integer(body.id, 1)));
      if (!existing) throw new ValidationError("سکشن پیدا نشد.");
      if (existing.key !== "custom") throw new ValidationError("سکشن‌های داخلی حذف نمی‌شوند؛ می‌توانید غیرفعالشان کنید.");
      await db.delete(homeSections).where(eq(homeSections.id, existing.id));
      return Response.json({ ok: true, message: "سکشن حذف شد." });
    } else if (body.action === "home.reorder") {
      const ids: unknown[] = Array.isArray(body.ids) ? body.ids : [];
      if (!ids.length || ids.length > 40) throw new ValidationError("ترتیب سکشن‌ها معتبر نیست.");
      await db.transaction(async tx => {
        for (let index = 0; index < ids.length; index++)
          await tx.update(homeSections).set({ position: index }).where(eq(homeSections.id, integer(ids[index], 1)));
      });
      return Response.json({ ok: true, message: "ترتیب صفحهٔ اصلی ذخیره شد." });
    } else if (body.action === "tg.settings") {
      /* فاز ۱۲: تنظیمات ربات تلگرام از پنل */
      const incoming = body.settings || {};
      const siteUrl = text(incoming.siteUrl, 200);
      if (siteUrl && !/^https:\/\//.test(siteUrl)) throw new ValidationError("آدرس سایت باید با https شروع شود.");
      const values = {
        enabled: !!incoming.enabled,
        botUsername: text(incoming.botUsername, 100).replace(/^@/, ""),
        channelId: text(incoming.channelId, 100),
        adminChatIds: text(incoming.adminChatIds, 300).replace(/[^\d,\s-]/g, ""),
        siteUrl: siteUrl.replace(/\/+$/, ""),
        autoPublish: !!incoming.autoPublish,
        ...(typeof incoming.botToken === "string" && incoming.botToken !== "__keep__" ? { botToken: incoming.botToken.trim().slice(0, 200) } : {}),
      };
      await db.insert(tgSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: tgSettings.id, set: values });
      return Response.json({ ok: true, message: "تنظیمات ربات تلگرام ذخیره شد." });
    } else if (body.action === "tg.webhook.set") {
      const config = await getTgConfig();
      if (!config.botToken) return Response.json({ error: "اول توکن ربات را ذخیره کنید." }, { status: 400 });
      const url = text(body.url, 300);
      if (!/^https:\/\//.test(url)) throw new ValidationError("آدرس وبهوک باید با https شروع شود.");
      const webhookUrl = `${url.replace(/\/+$/, "")}/api/telegram/webhook`;
      const result = await tgCall(config, "setWebhook", { url: webhookUrl, secret_token: config.webhookSecret, drop_pending_updates: true });
      if (!result.ok) return Response.json({ error: `ثبت وبهوک ناموفق: ${result.error}` }, { status: 400 });
      await db.update(tgSettings).set({ webhookUrl }).where(eq(tgSettings.id, 1));
      return Response.json({ ok: true, message: result.dev ? "حالت آزمایشی (بدون توکن): وبهوک ثبت نشد ولی مسیر آماده است." : `وبهوک روی ${webhookUrl} ثبت شد.` });
    } else if (body.action === "tg.test") {
      const config = await getTgConfig();
      const target = text(body.chatId, 50) || config.adminChatIds[0] || config.channelId;
      if (!target) return Response.json({ error: "شناسهٔ چت مدیر یا کانال را تنظیم کنید." }, { status: 400 });
      const result = await tgCall(config, "sendMessage", { chat_id: target, text: "پیام آزمایشی پنل کیا ✅ اتصال ربات برقرار است." });
      return Response.json({ ok: result.ok, message: result.dev ? "حالت آزمایشی: پیام در گزارش سرور ثبت شد (توکن تنظیم نشده)." : result.ok ? "پیام آزمایشی ارسال شد." : `ارسال نشد: ${result.error}` });
    } else if (body.action === "tg.publish") {
      const [product] = await db.select().from(products).where(eq(products.id, integer(body.productId, 1)));
      if (!product) return Response.json({ error: "محصول پیدا نشد." }, { status: 404 });
      const result = await publishProductToChannel(product, body.kind === "flash" ? "flash" : "new");
      return Response.json({ ok: true, message: "skipped" in result && result.skipped ? "انتشار خودکار یا شناسهٔ کانال غیرفعال است." : "dev" in result && result.dev ? "حالت آزمایشی: پست در گزارش سرور ثبت شد." : result.ok ? "در کانال منتشر شد." : `منتشر نشد: ${"error" in result ? result.error : ""}` });
    } else if (body.action === "tg.channel.post") {
      const message = text(body.message, 2000);
      if (message.length < 5) throw new ValidationError("متن پست را کامل بنویسید.");
      const result = await publishTextToChannel(message);
      return Response.json({ ok: result.ok, message: result.dev ? "حالت آزمایشی: پست در گزارش سرور ثبت شد." : result.ok ? "پست در کانال منتشر شد." : `منتشر نشد: ${result.error}` });
    } else if (body.action === "tg.chat.delete") {
      await db.delete(tgChats).where(eq(tgChats.id, integer(body.id, 1)));
      return Response.json({ ok: true, message: "چت حذف شد." });
    } else throw new ValidationError("عملیات معتبر نیست.");
    revalidatePath("/"); revalidatePath("/shop"); revalidatePath("/daily"); revalidatePath("/trending"); revalidatePath("/guide"); revalidatePath("/collections"); revalidatePath("/sitemap.xml");
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    if (error && typeof error === "object" && "cause" in error && (error.cause as { code?: string })?.code === "23505") return Response.json({ error: "این شناسه قبلاً استفاده شده است." }, { status: 409 });
    return apiError(error);
  }
}
