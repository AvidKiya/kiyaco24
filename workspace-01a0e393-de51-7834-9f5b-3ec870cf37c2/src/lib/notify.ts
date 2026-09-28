/* ============================================================
 *  فاز ۱۰ — اعلان‌ها و مارکتینگ اتوماسیون
 *  لایهٔ سرور: صف خروجی، ارائه‌دهندهٔ کانال، قوانین و تریگرها
 *  کانال‌ها: پیامک (کاوه‌نگار/SMS.ir) · ایمیل · Push مرورگر · تلگرام · اعلان درون‌برنامه‌ای
 *  بدون کلید API، پیام‌ها در لاگ سرور ثبت و با وضعیت «ارسال شد» ذخیره می‌شوند
 *  تا وقتی پنل پیامکی/سرویس ایمیل وصل شود (فاز ۱۴) چیزی از دست نرود.
 * ============================================================ */
import { db } from "@/db";
import { alertRules, outbox, stockAlerts, abandonedCarts, notifications, customers, products, orders, pushSubscriptions } from "@/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { orderStatuses } from "@/lib/catalog";

export type Channel = "sms" | "email" | "push" | "telegram" | "web";
export type Trigger =
  | "order_status" | "payment" | "shipping" | "welcome" | "first_purchase" | "returning"
  | "birthday" | "price_drop" | "back_in_stock" | "new_collection" | "partner_update" | "abandoned_cart" | "manual";

/* ---------- برچسب فارسی برای پنل ---------- */
export const triggerLabels: Record<Trigger, string> = {
  order_status: "تغییر وضعیت سفارش",
  payment: "پرداخت سفارش",
  shipping: "ارسال سفارش",
  welcome: "خوش‌آمدگویی عضو جدید",
  first_purchase: "اولین خرید مشتری",
  returning: "بازگشت مشتری",
  birthday: "تبریک تولد",
  price_drop: "کاهش قیمت محصول",
  back_in_stock: "موجود شدن محصول",
  new_collection: "کالکشن جدید",
  partner_update: "به‌روزرسانی همکاری عمده",
  abandoned_cart: "سبد رهاشده",
  manual: "ارسال دستی",
};

export const channelLabels: Record<Channel, string> = {
  sms: "پیامک",
  email: "ایمیل",
  push: "Push مرورگر",
  telegram: "تلگرام",
  web: "اعلان درون‌برنامه",
};

export const channelStatus = () => [
  { id: "sms" as Channel, title: "پیامک (کاوه‌نگار / SMS.ir)", connected: !!(process.env.SMS_API_KEY && process.env.SMS_SENDER), hint: "SMS_API_KEY + SMS_SENDER" },
  { id: "email" as Channel, title: "ایمیل (SMTP)", connected: !!(process.env.SMTP_HOST && process.env.SMTP_USER), hint: "SMTP_HOST + SMTP_USER + SMTP_PASS" },
  { id: "push" as Channel, title: "Push مرورگر (PWA)", connected: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), hint: "VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY" },
  { id: "telegram" as Channel, title: "تلگرام", connected: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID), hint: "TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID" },
];

/* ============================================================
 *  قوانین پیش‌فرض — اولین بار ساخته می‌شوند
 * ============================================================ */
export const defaultRules: {
  key: string; title: string; trigger: Trigger; channels: Channel[];
  smsBody: string; emailSubject: string; emailBody: string; pushBody: string; delayMinutes: number;
}[] = [
  {
    key: "welcome", title: "خوش‌آمدگویی عضو جدید باشگاه", trigger: "welcome", channels: ["sms", "web"],
    smsBody: "{name} عزیز، خوش آمدی به باشگاه مشتریان کیا 🌟 با هر خرید امتیاز بگیر و به سطح‌های بالاتر برس: {link}",
    emailSubject: "به باشگاه مشتریان کیا خوش آمدی", emailBody: "سلام {name}، با هر خرید و هر نظر امتیاز جمع کن و به سطح‌های برنزی تا ویژه برس.", pushBody: "به باشگاه مشتریان کیا خوش آمدی!", delayMinutes: 0,
  },
  {
    key: "order_status", title: "تغییر وضعیت سفارش", trigger: "order_status", channels: ["sms", "web"],
    smsBody: "سفارش {order} شما به وضعیت «{status}» تغییر کرد. پیگیری: {link}",
    emailSubject: "وضعیت سفارش {order}", emailBody: "سلام {name}، سفارش {order} شما اکنون «{status}» است.", pushBody: "سفارش {order}: {status}", delayMinutes: 0,
  },
  {
    key: "payment", title: "تأیید پرداخت سفارش", trigger: "payment", channels: ["sms", "web"],
    smsBody: "پرداخت سفارش {order} تأیید شد ✅ مبلغ: {amount} تومان. ممنون که کیا را انتخاب کردی.",
    emailSubject: "پرداخت سفارش {order} تأیید شد", emailBody: "پرداخت سفارش {order} به مبلغ {amount} تومان تأیید شد.", pushBody: "پرداخت سفارش {order} تأیید شد", delayMinutes: 0,
  },
  {
    key: "shipping", title: "ارسال سفارش", trigger: "shipping", channels: ["sms", "web"],
    smsBody: "سفارش {order} ارسال شد 📦 کد رهگیری: {tracking}. پیگیری: {link}",
    emailSubject: "سفارش {order} در راه است", emailBody: "سفارش {order} با کد رهگیری {tracking} ارسال شد.", pushBody: "سفارش {order} ارسال شد", delayMinutes: 0,
  },
  {
    key: "first_purchase", title: "اولین خرید مشتری", trigger: "first_purchase", channels: ["sms", "web"],
    smsBody: "{name} عزیز، اولین خریدت از کیا ثبت شد 🎁 {points} امتیاز به حسابت اضافه شد.",
    emailSubject: "اولین خریدت مبارک", emailBody: "اولین خریدت ثبت شد و {points} امتیاز هدیه گرفتی.", pushBody: "اولین خریدت مبارک!", delayMinutes: 0,
  },
  {
    key: "back_in_stock", title: "موجود شدن محصول", trigger: "back_in_stock", channels: ["sms", "web"],
    smsBody: "محصول «{product}» که منتظرش بودی دوباره موجود شد 🛒 {link}",
    emailSubject: "«{product}» دوباره موجود شد", emailBody: "محصول {product} دوباره موجود است.", pushBody: "{product} دوباره موجود شد", delayMinutes: 0,
  },
  {
    key: "price_drop", title: "کاهش قیمت محصول", trigger: "price_drop", channels: ["sms", "web"],
    smsBody: "قیمت «{product}» کاهش یافت 🔻 قیمت جدید: {amount} تومان. {link}",
    emailSubject: "کاهش قیمت {product}", emailBody: "قیمت {product} به {amount} تومان رسید.", pushBody: "قاهش قیمت {product}", delayMinutes: 0,
  },
  {
    key: "new_collection", title: "انتشار کالکشن جدید", trigger: "new_collection", channels: ["web"],
    smsBody: "کالکشن جدید کیا منتشر شد: {product}. ببینش: {link}",
    emailSubject: "کالکشن جدید: {product}", emailBody: "کالکشن جدید {product} منتشر شد.", pushBody: "کالکشن جدید: {product}", delayMinutes: 0,
  },
  {
    key: "birthday", title: "تبریک تولد مشتری", trigger: "birthday", channels: ["sms", "web"],
    smsBody: "{name} عزیز، تولدت مبارک 🎂 کد تخفیف ویژهٔ تولدت: {code}",
    emailSubject: "تولدت مبارک", emailBody: "تولدت مبارک {name}! کد تخفیف ویژه: {code}", pushBody: "تولدت مبارک!", delayMinutes: 0,
  },
  {
    key: "abandoned_cart", title: "یادآوری سبد رهاشده", trigger: "abandoned_cart", channels: ["sms"],
    smsBody: "{name} عزیز، سبد خریدت روی {amount} تومان منتظرته 🛒 تکمیلش کن: {link}",
    emailSubject: "سبد خریدت را فراموش نکردی؟", emailBody: "سبد خریدت با {amount} تومان کالا منتظر تکمیل است.", pushBody: "سبد خریدت منتظرته", delayMinutes: 60,
  },
  {
    key: "partner_update", title: "به‌روزرسانی همکاری عمده", trigger: "partner_update", channels: ["sms", "web"],
    smsBody: "وضعیت همکاری عمدهٔ شما در کیا به «{status}» تغییر کرد. ورود به پنل: {link}",
    emailSubject: "به‌روزرسانی همکاری عمده", emailBody: "وضعیت همکاری شما: {status}", pushBody: "به‌روزرسانی همکاری", delayMinutes: 0,
  },
];

export async function ensureAlertRules() {
  const existing = await db.select({ key: alertRules.key }).from(alertRules);
  const have = new Set(existing.map(r => r.key));
  const missing = defaultRules.filter(rule => !have.has(rule.key));
  if (missing.length) {
    await db.insert(alertRules).values(missing.map((rule, index) => ({
      key: rule.key, title: rule.title, trigger: rule.trigger, channels: rule.channels,
      smsBody: rule.smsBody, emailSubject: rule.emailSubject, emailBody: rule.emailBody,
      pushBody: rule.pushBody, delayMinutes: rule.delayMinutes, position: existing.length + index,
    })));
  }
}

/* ============================================================
 *  جایگزینی متغیرهای قالب
 * ============================================================ */
export function renderTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/* ============================================================
 *  صف خروجی
 * ============================================================ */
export async function queueMessage(input: {
  channel: Channel; recipient: string; body: string; subject?: string; link?: string;
  ruleKey?: string; customerId?: number | null;
}) {
  if (!input.recipient || !input.body) return null;
  const [row] = await db.insert(outbox).values({
    channel: input.channel, recipient: input.recipient, body: input.body, subject: input.subject ?? "",
    link: input.link ?? "", ruleKey: input.ruleKey ?? "", customerId: input.customerId ?? null,
  }).returning();
  return row;
}

/* ---------- ارائه‌دهندهٔ کانال‌ها ---------- */
async function deliverSms(recipient: string, body: string) {
  const key = process.env.SMS_API_KEY, sender = process.env.SMS_SENDER, provider = process.env.SMS_PROVIDER || "kavenegar";
  if (!key || !sender) { console.log(`[NOTIFY:SMS] ${recipient} → ${body}`); return { ok: true, provider: "dev-log" }; }
  // کاوه‌نگار و SMS.ir هر دو الگوی verify/lookup مشابه دارند؛ با کلید واقعی جایگزین می‌شود.
  const endpoint = provider === "smsir"
    ? `https://api.sms.ir/v1/send/verify?linenumber=${sender}`
    : `https://api.kavenegar.com/v1/${key}/sms/send.json?sender=${sender}`;
  const payload = provider === "smsir" ? { mobile: recipient, templateId: 0, parameters: [{ name: "code", value: body }] } : { receptor: recipient, message: body };
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(provider === "smsir" ? { "X-API-KEY": key } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`SMS provider answered ${response.status}`);
  return { ok: true, provider };
}

async function deliverEmail(recipient: string, subject: string, body: string) {
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER;
  if (!host || !user) { console.log(`[NOTIFY:EMAIL] ${recipient} → ${subject} | ${body}`); return { ok: true, provider: "dev-log" }; }
  // در هاست اشتراکی ایرانی معمولاً سرویس SMTP داخلی یا API ایمیل استفاده می‌شود.
  const response = await fetch(`${host.replace(/\/$/, "")}/send`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SMTP_PASS || ""}` },
    body: JSON.stringify({ from: user, to: recipient, subject, text: body }), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Email provider answered ${response.status}`);
  return { ok: true, provider: host };
}

async function deliverPush(recipient: string, body: string, link: string, subject = "کیا اکسسوری") {
  const publicKey = process.env.VAPID_PUBLIC_KEY, privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) { console.log(`[NOTIFY:PUSH] ${recipient.slice(0, 42)} → ${subject} | ${body}`); return { ok: true, provider: "dev-log" }; }
  try {
    const webPush = (await import("web-push")).default;
    webPush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@kiya-accessories.ir", publicKey, privateKey);
    // دریافت‌کننده، اشتراک مرورگر به‌صورت JSON ذخیره شده است
    let subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } };
    try { subscription = JSON.parse(recipient); } catch { throw new Error("اشتراک Push معتبر نیست."); }
    if (!subscription?.endpoint) throw new Error("اشتراک Push معتبر نیست.");
    await webPush.sendNotification(subscription, JSON.stringify({ title: subject, body, link, icon: "/images/icon-192.png", badge: "/images/icon-192.png" }));
    return { ok: true, provider: "web-push" };
  } catch (error) {
    // اشتراک منقضی/لغوشده خطای دائمی است؛ دیگر تلاش نمی‌کنیم
    const code = (error as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) { await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, String(recipient).slice(0, 700))); return { ok: true, provider: "web-push:expired" }; }
    throw error instanceof Error ? error : new Error("ارسال Push ناموفق بود.");
  }
}

async function deliverTelegram(recipient: string, body: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.log(`[NOTIFY:TELEGRAM] ${recipient} → ${body}`); return { ok: true, provider: "dev-log" }; }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: recipient, text: body }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Telegram notification could not be delivered");
  return { ok: true, provider: "telegram" };
}

/** ارسال یک ردیف صف — خروجی: موفق/ناموفق + نام ارائه‌دهنده */
export async function deliverMessage(row: { id: number; channel: string; recipient: string; subject: string; body: string; link: string }) {
  try {
    const result = row.channel === "sms" ? await deliverSms(row.recipient, row.body)
      : row.channel === "email" ? await deliverEmail(row.recipient, row.subject, row.body)
      : row.channel === "push" ? await deliverPush(row.recipient, row.body, row.link, row.subject)
      : row.channel === "telegram" ? await deliverTelegram(row.recipient, row.body)
      : { ok: true, provider: "web" };
    if (!result.ok) throw new Error("delivery failed");
    await db.update(outbox).set({ status: "sent", provider: result.provider, error: "", attempts: sql`${outbox.attempts} + 1`, sentAt: new Date() }).where(eq(outbox.id, row.id));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const [current] = await db.select({ attempts: outbox.attempts }).from(outbox).where(eq(outbox.id, row.id)).limit(1);
    const attempts = (current?.attempts ?? 0) + 1;
    await db.update(outbox).set({ status: attempts >= 3 ? "failed" : "pending", error: message.slice(0, 300), attempts }).where(eq(outbox.id, row.id));
    return false;
  }
}

/** تخلیهٔ صف — در کرون یا بعد از تریگرها صدا زده می‌شود */
export async function flushOutbox(limit = 40) {
  const pending = await db.select().from(outbox).where(eq(outbox.status, "pending")).orderBy(asc(outbox.id)).limit(limit);
  let sent = 0;
  for (const row of pending) if (await deliverMessage(row)) sent++;
  return { processed: pending.length, sent };
}

/* ============================================================
 *  اطلاع‌رسانی مشتری بر اساس قوانین
 * ============================================================ */
export async function notifyCustomer(customerId: number, trigger: Trigger, values: Record<string, string | number>, options: { title?: string; body?: string; link?: string } = {}) {
  await ensureAlertRules();
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return { queued: 0, channels: [] as Channel[] };

  const rules = await db.select().from(alertRules).where(and(eq(alertRules.trigger, trigger), eq(alertRules.active, true)));
  const link = options.link ?? "/account/panel";
  const used: Channel[] = [];

  for (const rule of rules) {
    const sms = renderTemplate(rule.smsBody, values);
    const emailBody = renderTemplate(rule.emailBody, values);
    const emailSubject = renderTemplate(rule.emailSubject, values);
    const push = renderTemplate(rule.pushBody, values);
    for (const channel of rule.channels as Channel[]) {
      if (channel === "web") continue;
      const recipient = channel === "sms" ? customer.phone : channel === "email" ? customer.email : "";
      if (!recipient) continue;
      await queueMessage({ channel, recipient, body: channel === "email" ? emailBody : channel === "push" ? push : sms, subject: emailSubject, link, ruleKey: rule.key, customerId });
      used.push(channel);
    }
  }

  // اعلان درون‌برنامه همیشه ثبت می‌شود
  await db.insert(notifications).values({
    customerId, title: options.title ?? triggerLabels[trigger], body: options.body ?? renderTemplate(rules[0]?.smsBody ?? "{status}", values), link,
  });
  await flushOutbox();
  return { queued: used.length, channels: used };
}

/* ============================================================
 *  تریگرها
 * ============================================================ */

/** تغییر وضعیت/پرداخت/ارسال سفارش */
export async function notifyOrderChange(order: { id: string; code: string; customerName: string; phone: string; total: number; status: string; paymentStatus: string; trackingNumber: string }, previous: { status: string; paymentStatus: string }) {
  const [customer] = await db.select().from(customers).where(eq(customers.phone, order.phone)).limit(1);
  const values = { name: order.customerName, order: order.code, status: orderStatuses[order.status] ?? order.status, amount: order.total.toLocaleString("fa-IR"), tracking: order.trackingNumber || "—", link: `/track?code=${order.code}` };

  if (previous.paymentStatus !== "paid" && order.paymentStatus === "paid") {
    if (customer) await notifyCustomer(customer.id, "payment", values, { title: "پرداخت سفارش تأیید شد", body: `پرداخت سفارش ${order.code} تأیید شد.`, link: "/account/panel?section=orders" });
    else await queueMessage({ channel: "sms", recipient: order.phone, body: renderTemplate(defaultRules[2].smsBody, values), ruleKey: "payment" });
  }
  if (previous.status !== order.status && order.status !== "pending") {
    if (customer) await notifyCustomer(customer.id, "order_status", values, { title: `وضعیت سفارش: ${values.status}`, body: `سفارش ${order.code} به وضعیت ${values.status} تغییر کرد.`, link: "/account/panel?section=orders" });
    else await queueMessage({ channel: "sms", recipient: order.phone, body: renderTemplate(defaultRules[1].smsBody, values), ruleKey: "order_status" });
  }
  if (order.status === "shipped" && order.trackingNumber) {
    if (customer) await notifyCustomer(customer.id, "shipping", values, { title: "سفارش ارسال شد", body: `سفارش ${order.code} با کد رهگیری ${order.trackingNumber} ارسال شد.`, link: "/account/panel?section=orders" });
    else await queueMessage({ channel: "sms", recipient: order.phone, body: renderTemplate(defaultRules[3].smsBody, values), ruleKey: "shipping" });
  }
  await flushOutbox();
}

/** اولین خرید مشتری */
export async function notifyFirstPurchase(customerId: number, orderCode: string, points: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer || customer.orderCount !== 1) return;
  await notifyCustomer(customerId, "first_purchase", { name: customer.name || "دوست خوب کیا", order: orderCode, points: points.toLocaleString("fa-IR"), link: "/account/panel" }, { title: "اولین خریدت مبارک!", body: `اولین خریدت ثبت شد و ${points} امتیاز هدیه گرفتی.` });
}

/** خوش‌آمدگویی عضو جدید */
export async function notifyWelcome(customerId: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return;
  await notifyCustomer(customerId, "welcome", { name: customer.name || "دوست خوب کیا", link: "/account/panel" }, { title: "به باشگاه مشتریان کیا خوش آمدید", body: "با هر خرید و هر نظر امتیاز جمع کنید." });
}

/** کالکشن جدید — اطلاع به مشتریان و اعضای خبرنامه */
export async function notifyNewCollection(title: string, slug: string) {
  const link = `/collections/${slug}`;
  const members = await db.select({ id: customers.id }).from(customers).limit(500);
  for (const member of members) await db.insert(notifications).values({ customerId: member.id, title: `کالکشن جدید: ${title}`, body: "کالکشن جدید کیا منتشر شد؛ ببینش.", link });
  await queueMessage({ channel: "sms", recipient: process.env.SMS_SENDER || "subscribers", body: renderTemplate(defaultRules[7].smsBody, { product: title, link }), ruleKey: "new_collection" });
  await flushOutbox();
}

/** به‌روزرسانی وضعیت همکار عمده */
export async function notifyPartnerUpdate(phone: string, status: string) {
  await queueMessage({ channel: "sms", recipient: phone, body: renderTemplate(defaultRules[10].smsBody, { status, link: "/partner/login" }), ruleKey: "partner_update" });
  await flushOutbox();
}

/** کاهش قیمت / موجود شدن — اطلاع‌رسانی به منتظران */
export async function processProductAlerts(product: { id: number; name: string; slug: string; price: number; stock: number }, previous: { price: number; stock: number }) {
  const link = `/product/${product.slug}`;
  const values = { product: product.name, amount: product.price.toLocaleString("fa-IR"), link };

  if (previous.stock <= 0 && product.stock > 0) {
    const waiting = await db.select().from(stockAlerts).where(and(eq(stockAlerts.productId, product.id), eq(stockAlerts.type, "back_in_stock")));
    for (const alert of waiting) {
      if (alert.phone) await queueMessage({ channel: "sms", recipient: alert.phone, body: renderTemplate(defaultRules[5].smsBody, values), link, ruleKey: "back_in_stock" });
      if (alert.email) await queueMessage({ channel: "email", recipient: alert.email, subject: `«${product.name}» دوباره موجود شد`, body: renderTemplate(defaultRules[5].emailBody, values), link, ruleKey: "back_in_stock" });
      await db.update(stockAlerts).set({ notifiedAt: new Date() }).where(eq(stockAlerts.id, alert.id));
    }
  }
  if (previous.price > 0 && product.price < previous.price) {
    const waiting = await db.select().from(stockAlerts).where(and(eq(stockAlerts.productId, product.id), eq(stockAlerts.type, "price_drop")));
    for (const alert of waiting) {
      if (alert.phone) await queueMessage({ channel: "sms", recipient: alert.phone, body: renderTemplate(defaultRules[6].smsBody, values), link, ruleKey: "price_drop" });
      if (alert.email) await queueMessage({ channel: "email", recipient: alert.email, subject: `کاهش قیمت ${product.name}`, body: renderTemplate(defaultRules[6].emailBody, values), link, ruleKey: "price_drop" });
      await db.update(stockAlerts).set({ notifiedAt: new Date() }).where(eq(stockAlerts.id, alert.id));
    }
  }
  await flushOutbox();
}

/** تولد مشتریان امروز — تاریخ تولد به‌صورت متن جلالی YYYY-MM-DD ذخیره می‌شود */
export async function processBirthdays() {
  const parts = new Intl.DateTimeFormat("fa-IR-u-nu-latn", { month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const month = parts.find(part => part.type === "month")?.value ?? "01";
  const day = parts.find(part => part.type === "day")?.value ?? "01";
  const rows = await db.select().from(customers).where(sql`length(${customers.birthDate}) = 10 and substring(${customers.birthDate} from 6 for 5) = ${`${month}-${day}`}`);
  let notified = 0;
  for (const customer of rows) {
    if (customer.birthdayRewarded) continue;
    await notifyCustomer(customer.id, "birthday", { name: customer.name || "دوست خوب کیا", code: "BIRTHDAY10", link: "/shop" }, { title: "تولدت مبارک 🎂", body: "کد تخفیف ویژهٔ تولد شما: BIRTHDAY10" });
    await db.update(customers).set({ birthdayRewarded: "1" }).where(eq(customers.id, customer.id));
    notified++;
  }
  // ریست پرچم برای مشتریانی که تولدشان امروز نیست تا سال بعد دوباره تبریک بگیرند
  await db.update(customers).set({ birthdayRewarded: "" }).where(sql`${customers.birthdayRewarded} = '1' and (length(${customers.birthDate}) <> 10 or substring(${customers.birthDate} from 6 for 5) <> ${`${month}-${day}`})`);
  return notified;
}

/** سبدهای رهاشده — یادآوری */
export async function processAbandonedCarts(delayMinutes = 60) {
  const threshold = new Date(Date.now() - delayMinutes * 60_000);
  const rows = await db.select().from(abandonedCarts)
    .where(and(sql`${abandonedCarts.reminders} < 1`, sql`${abandonedCarts.recoveredAt} is null`, sql`${abandonedCarts.updatedAt} < ${threshold}`))
    .limit(50);
  let reminded = 0;
  for (const cart of rows) {
    if (!cart.phone) continue;
    await queueMessage({
      channel: "sms", recipient: cart.phone, ruleKey: "abandoned_cart",
      body: renderTemplate(defaultRules[9].smsBody, { name: "دوست خوب کیا", amount: cart.total.toLocaleString("fa-IR"), link: "/checkout" }),
    });
    await db.update(abandonedCarts).set({ reminders: 1, lastReminderAt: new Date() }).where(eq(abandonedCarts.id, cart.id));
    reminded++;
  }
  await flushOutbox();
  return reminded;
}

/** ثبت/به‌روزرسانی سبد رهاشده */
export async function trackAbandonedCart(input: { phone?: string; customerId?: number; items: { productId: number; name: string; image: string; price: number; quantity: number; size: string; color: string }[]; total: number; step?: string }) {
  if (!input.items.length) return null;
  const phone = input.phone || "";
  const existing = phone ? await db.select().from(abandonedCarts).where(and(eq(abandonedCarts.phone, phone), sql`${abandonedCarts.recoveredAt} is null`)).limit(1) : [];
  if (existing[0]) {
    await db.update(abandonedCarts).set({ items: input.items, total: input.total, step: input.step ?? "cart", customerId: input.customerId ?? existing[0].customerId, updatedAt: new Date() }).where(eq(abandonedCarts.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(abandonedCarts).values({ phone, customerId: input.customerId ?? null, items: input.items, total: input.total, step: input.step ?? "cart" }).returning();
  return row.id;
}

/** یادآوری دستی یک سبد رهاشده (از پنل مدیریت) */
export async function remindAbandonedCart(id: number) {
  const [cart] = await db.select().from(abandonedCarts).where(eq(abandonedCarts.id, id)).limit(1);
  if (!cart) return { ok: false as const, error: "سبد پیدا نشد." };
  if (cart.recoveredAt) return { ok: false as const, error: "این سبد قبلاً خریداری شده است." };
  const recipient = cart.phone || (await db.select({ phone: customers.phone }).from(customers).where(eq(customers.id, cart.customerId ?? 0)).limit(1))[0]?.phone || "";
  if (!recipient) return { ok: false as const, error: "شمارهٔ موبایل برای این سبد ثبت نشده است." };
  await queueMessage({
    channel: "sms", recipient, ruleKey: "abandoned_cart",
    body: renderTemplate(defaultRules[9].smsBody, { name: "دوست خوب کیا", amount: cart.total.toLocaleString("fa-IR"), link: "/checkout" }),
  });
  await db.update(abandonedCarts).set({ reminders: cart.reminders + 1, lastReminderAt: new Date() }).where(eq(abandonedCarts.id, cart.id));
  await flushOutbox();
  return { ok: true as const };
}

/** ثبت سفارش → سبد رهاشدهٔ همان مشتری بازیابی شده است */
export async function recoverAbandonedCarts(phone: string) {
  await db.update(abandonedCarts).set({ recoveredAt: new Date() }).where(and(eq(abandonedCarts.phone, phone), sql`${abandonedCarts.recoveredAt} is null`));
}

/* ============================================================
 *  مشترکین Push
 * ============================================================ */
export async function savePushSubscription(input: { endpoint: string; p256dh: string; auth: string; phone?: string; customerId?: number | null }) {
  if (!/^https?:\/\//.test(input.endpoint)) throw new Error("نشانی اشتراک Push معتبر نیست.");
  const values = { endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, phone: input.phone ?? "", customerId: input.customerId ?? null };
  await db.insert(pushSubscriptions).values(values).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: values.p256dh, auth: values.auth } });
  return true;
}

export async function removePushSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return true;
}

/** ارسال Push به همهٔ مشترکین (اعلان درون‌برنامه + صف) */
export async function broadcastPush(title: string, body: string, link: string) {
  const subscribers = await db.select().from(pushSubscriptions).limit(500);
  for (const subscriber of subscribers) await queueMessage({ channel: "push", recipient: subscriber.endpoint, body, subject: title, link, customerId: subscriber.customerId ?? null });
  await flushOutbox();
  return subscribers.length;
}

/* ============================================================
 *  دادهٔ پنل مدیریت
 * ============================================================ */
export async function getNotificationDashboard() {
  await ensureAlertRules();
  const [rules, messages, carts, alerts] = await Promise.all([
    db.select().from(alertRules).orderBy(asc(alertRules.position), asc(alertRules.id)),
    db.select().from(outbox).orderBy(desc(outbox.id)).limit(200),
    db.select().from(abandonedCarts).orderBy(desc(abandonedCarts.updatedAt)).limit(100),
    db.select().from(stockAlerts).orderBy(desc(stockAlerts.id)).limit(100),
  ]);
  return { rules, messages, carts, alerts, products: await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.active, true)).orderBy(asc(products.id)) };
}
