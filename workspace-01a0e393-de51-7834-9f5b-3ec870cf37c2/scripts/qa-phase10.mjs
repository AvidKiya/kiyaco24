/* QA فاز ۱۰ — اعلان‌ها و مارکتینگ اتوماسیون
 * اجرا: node scripts/qa-phase10.mjs  (سرور dev باید روی 3000 بالا باشد)
 */
const BASE = "http://127.0.0.1:3000";
const ADMIN_PASSWORD = process.env.KIYA_QA_PASSWORD || "";
let adminCookie = "";
let passed = 0, failed = 0;
const failures = [];

function check(name, condition, details = "") {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; failures.push(name); console.log(`  ❌ ${name}${details ? " — " + details : ""}`); }
}

async function api(path, options = {}, cookie = "") {
  const response = await fetch(BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json", Origin: BASE, ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) },
  });
  let data = null;
  try { data = await response.json(); } catch { /* html */ }
  return { status: response.status, data, headers: response.headers };
}

const setCookie = headers => (headers.getSetCookie?.() || []).map(c => c.split(";")[0]).join("; ");

/* ---------- ۱. ورود ادمین ---------- */
console.log("\n۱) ورود ادمین");
{
  const login = await api("/api/admin/auth", { method: "POST", body: JSON.stringify({ action: "login", password: ADMIN_PASSWORD }) });
  adminCookie = setCookie(login.headers);
  check("ورود ادمین", login.status === 200 && adminCookie.includes("kiya"), `status=${login.status}`);
}

/* ---------- ۲. داشبورد اعلان در GET ادمین ---------- */
console.log("\n۲) دادهٔ پنل اعلان");
let dashboard;
{
  const result = await api("/api/admin", {}, adminCookie);
  dashboard = result.data;
  check("قوانین پیش‌فرض ساخته شدند (۱۱ قانون)", Array.isArray(dashboard?.rules) && dashboard.rules.length >= 11, `rules=${dashboard?.rules?.length}`);
  check("کانال‌ها گزارش می‌شوند", Array.isArray(dashboard?.notificationChannels) && dashboard.notificationChannels.length === 4);
  check("Push فعال است (VAPID تنظیم شده)", dashboard?.notificationChannels?.find(c => c.id === "push")?.connected === true);
  check("فیلدهای outbox/abandonedCarts/stockAlerts حاضرند", Array.isArray(dashboard?.outbox) && Array.isArray(dashboard?.abandonedCarts) && Array.isArray(dashboard?.stockAlerts));
}

/* ---------- ۳. ثبت‌نام مشتری با OTP → خوش‌آمد ---------- */
console.log("\n۳) خوش‌آمدگویی عضو جدید");
const phone = "0912" + String(Math.floor(1000000 + Math.random() * 8999999));
let customerCookie = "";
{
  const request = await api("/api/customer/auth", { method: "POST", body: JSON.stringify({ action: "request-otp", phone }) });
  check("درخواست OTP", request.status === 200 && request.data?.devCode, `status=${request.status}`);
  const verify = await api("/api/customer/auth", { method: "POST", body: JSON.stringify({ action: "verify-otp", phone, code: request.data.devCode }) });
  customerCookie = setCookie(verify.headers);
  check("ثبت‌نام مشتری جدید", verify.status === 200 && verify.data?.isNew === true);
  const admin = await api("/api/admin", {}, adminCookie);
  const welcomeSms = admin.data.outbox.find(m => m.ruleKey === "welcome" && m.recipient === phone);
  check("پیامک خوش‌آمد در صف/ارسال ثبت شد", !!welcomeSms, "پیامک welcome پیدا نشد");
  check("پیامک خوش‌آمد ارسال شد (dev-log)", welcomeSms?.status === "sent" && welcomeSms?.provider === "dev-log", `status=${welcomeSms?.status}`);
  check("متغیرهای قالب جایگزین شدند", welcomeSms ? !welcomeSms.body.includes("{name}") && !welcomeSms.body.includes("{link}") : false, welcomeSms?.body);
  const member = admin.data.clubMembers.find(m => m.phone === phone);
  check("اعلان درون‌برنامهٔ خوش‌آمد ثبت شد", admin.data.notifications.some(n => n.customerId === member?.id && n.title.includes("خوش آمدید")));
}

/* ---------- ۴. سفارش و تغییر وضعیت → اعلان ---------- */
console.log("\n۴) اعلان وضعیت سفارش");
let orderCode = "";
{
  const shop = await api("/api/shop");
  const product = shop.data.products.find(p => p.stock > 2);
  const order = await api("/api/orders", { method: "POST", body: JSON.stringify({
    name: "کیو ای فاز ده", phone, city: "تهران", postalCode: "1234567890", address: "خیابان آزمایش، پلاک ۱۰",
    delivery: "shipping", requestKey: crypto.randomUUID(), items: [{ productId: product.id, quantity: 1, size: product.sizes[0] || "استاندارد", color: product.colors[0]?.name || "پیش‌فرض" }],
  }), }, customerCookie);
  orderCode = order.data?.code;
  check("ثبت سفارش", order.status === 200 && !!orderCode, JSON.stringify(order.data));

  const adminBefore = await api("/api/admin", {}, adminCookie);
  const row = adminBefore.data.orders.find(o => o.code === orderCode);
  const update = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "order.update", id: row.id, status: "shipped", paymentStatus: "paid", trackingNumber: "IR-QA-12345" }) }, adminCookie);
  check("تغییر وضعیت به ارسال‌شده + پرداخت‌شده", update.status === 200);

  const admin = await api("/api/admin", {}, adminCookie);
  const paymentSms = admin.data.outbox.find(m => m.ruleKey === "payment" && m.recipient === phone);
  const statusSms = admin.data.outbox.find(m => m.ruleKey === "order_status" && m.recipient === phone);
  const shippingSms = admin.data.outbox.find(m => m.ruleKey === "shipping" && m.recipient === phone);
  check("پیامک تأیید پرداخت", !!paymentSms && paymentSms.status === "sent");
  check("پیامک تغییر وضعیت", !!statusSms && statusSms.status === "sent");
  check("پیامک ارسال با کد رهگیری", !!shippingSms && shippingSms.body.includes("IR-QA-12345"), shippingSms?.body);
  const member = admin.data.clubMembers.find(m => m.phone === phone);
  check("اعلان اولین خرید ثبت شد", admin.data.notifications.some(n => n.customerId === member?.id && n.title.includes("اولین خرید")));
}

/* ---------- ۵. اطلاع‌رسانی موجودی و کاهش قیمت ---------- */
console.log("\n۵) هشدار موجودی/قیمت محصول");
{
  const shop = await api("/api/shop");
  const product = shop.data.products[0];
  const subscribe = await api("/api/notifications/alerts", { method: "POST", body: JSON.stringify({ action: "subscribe", productId: product.id, type: "price_drop", phone: "09121112233", priceAtRequest: product.price }) });
  check("ثبت درخواست کاهش قیمت", subscribe.status === 200, JSON.stringify(subscribe.data));
  const duplicate = await api("/api/notifications/alerts", { method: "POST", body: JSON.stringify({ action: "subscribe", productId: product.id, type: "price_drop", phone: "09121112233" }) });
  check("درخواست تکراری بدون خطا", duplicate.status === 200 && duplicate.data.message.includes("قبلاً"));
  const invalid = await api("/api/notifications/alerts", { method: "POST", body: JSON.stringify({ action: "subscribe", productId: product.id, type: "price_drop", phone: "1234" }) });
  check("رد شماره نامعتبر", invalid.status === 400);

  // کاهش قیمت از پنل → پیامک به منتظر
  const adminData = await api("/api/admin", {}, adminCookie);
  const full = adminData.data.products.find(p => p.id === product.id);
  const save = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "product.save", product: { ...full, price: full.price - 10000 } }) }, adminCookie);
  check("ذخیرهٔ محصول با قیمت کمتر", save.status === 200, JSON.stringify(save.data));
  const after = await api("/api/admin", {}, adminCookie);
  const dropSms = after.data.outbox.find(m => m.ruleKey === "price_drop" && m.recipient === "09121112233");
  check("پیامک کاهش قیمت ارسال شد", !!dropSms && dropSms.status === "sent", dropSms?.body);
  check("درخواست به «اعلام شد» تغییر کرد", after.data.stockAlerts.find(a => a.phone === "09121112233")?.notifiedAt !== null);
  // بازگرداندن قیمت
  await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "product.save", product: { ...full } }) }, adminCookie);
}

/* ---------- ۶. سبد رهاشده ---------- */
console.log("\n۶) سبد رهاشده");
{
  const shop = await api("/api/shop");
  const product = shop.data.products[0];
  const cartPhone = "0913" + String(Math.floor(1000000 + Math.random() * 8999999));
  const track = await api("/api/notifications/alerts", { method: "POST", body: JSON.stringify({ action: "track-cart", phone: cartPhone, step: "checkout", total: product.price, items: [{ productId: product.id, name: product.name, image: product.image, price: product.price, quantity: 1, size: "استاندارد", color: "پیش‌فرض" }] }) });
  check("ثبت سبد رهاشده", track.status === 200, JSON.stringify(track.data));
  const admin = await api("/api/admin", {}, adminCookie);
  const cart = admin.data.abandonedCarts.find(c => c.phone === cartPhone);
  check("سبد در پنل دیده می‌شود", !!cart && cart.total === product.price);
  const remind = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "cart.remind", id: cart.id }) }, adminCookie);
  check("یادآوری دستی سبد", remind.status === 200);
  const after = await api("/api/admin", {}, adminCookie);
  const sms = after.data.outbox.find(m => m.ruleKey === "abandoned_cart" && m.recipient === cartPhone);
  check("پیامک یادآوری ارسال شد", !!sms && sms.status === "sent", sms?.body);
}

/* ---------- ۷. قوانین: ذخیره/آزمایش/بازگردانی ---------- */
console.log("\n۷) مدیریت قوانین");
{
  const save = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "rule.save", key: "qa_rule", title: "قانون آزمایشی QA", trigger: "manual", channels: ["sms"], smsBody: "پیام آزمایشی {name} برای {product}", delayMinutes: 0, active: true, position: 50 }) }, adminCookie);
  check("ساخت قانون جدید", save.status === 200);
  const test = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "rule.test", key: "qa_rule", channel: "sms", recipient: "09125556677" }) }, adminCookie);
  check("ارسال آزمایشی قانون", test.status === 200 && test.data?.delivered?.sent >= 1, JSON.stringify(test.data));
  const badTest = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "rule.test", key: "qa_rule", channel: "sms", recipient: "abc" }) }, adminCookie);
  check("رد مقصد نامعتبر آزمایش", badTest.status === 400);
  const remove = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "rule.delete", key: "qa_rule" }) }, adminCookie);
  check("حذف قانون", remove.status === 200);
  const reset = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "rule.reset" }) }, adminCookie);
  check("بازگردانی قوانین پیش‌فرض", reset.status === 200);
}

/* ---------- ۸. پیام همگانی ---------- */
console.log("\n۸) پیام همگانی");
{
  const broadcast = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "broadcast", title: "کالکشن پاییزی", message: "کالکشن جدید کیا از امروز در فروشگاه", audience: "all", link: "/collections" }) }, adminCookie);
  check("ارسال پیام همگانی", broadcast.status === 200, JSON.stringify(broadcast.data));
  const admin = await api("/api/admin", {}, adminCookie);
  check("پیامک همگانی برای مشتری صف شد", admin.data.outbox.some(m => m.ruleKey === "broadcast" && m.recipient === phone));
  const member = admin.data.clubMembers.find(m => m.phone === phone);
  check("اعلان درون‌برنامهٔ همگانی ثبت شد", admin.data.notifications.some(n => n.customerId === member?.id && n.title === "کالکشن پاییزی"));
}

/* ---------- ۹. Push: عضویت و لغو ---------- */
console.log("\n۹) اشتراک Push");
{
  const endpoint = "https://fcm.googleapis.com/fcm/send/qa-" + Date.now();
  const subscribe = await api("/api/push/subscribe", { method: "POST", body: JSON.stringify({ endpoint, keys: { p256dh: "BPtestkey", auth: "authtest" } }) }, customerCookie);
  check("عضویت Push", subscribe.status === 200, JSON.stringify(subscribe.data));
  const admin = await api("/api/admin", {}, adminCookie);
  check("مشترک Push با شمارهٔ مشتری ثبت شد", admin.data.pushSubscriptions.some(s => s.phone === phone));
  const invalid = await api("/api/push/subscribe", { method: "POST", body: JSON.stringify({ endpoint: "notaurl", keys: {} }) });
  check("رد اشتراک نامعتبر", invalid.status === 400);
  const unsubscribe = await api("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) });
  check("لغو اشتراک Push", unsubscribe.status === 200);
}

/* ---------- ۱۰. کرون ---------- */
console.log("\n۱۰) کرون");
{
  const cron = await api("/api/cron/notify");
  check("اجرای کرون بدون کلید (CRON_SECRET تنظیم نشده)", cron.status === 200 && cron.data?.ok === true, JSON.stringify(cron.data));
}

/* ---------- ۱۱. امنیت ---------- */
console.log("\n۱۱) امنیت");
{
  const noAuth = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "broadcast", title: "hack", message: "hack hack", audience: "all" }) });
  check("رد broadcast بدون ورود", noAuth.status === 401);
  const noAuthRule = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "rule.reset" }) });
  check("رد rule.reset بدون ورود", noAuthRule.status === 401);
}

/* ---------- پاک‌سازی دادهٔ QA ---------- */
console.log("\n🧹 پاک‌سازی دادهٔ آزمون");
{
  const admin = await api("/api/admin", {}, adminCookie);
  const clear = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "outbox.clear", days: 0 }) }, adminCookie);
  check("پاک‌سازی صف پیام", clear.status === 200);
  console.log(`  (باقی‌مانده: سفارش ${orderCode} و مشتری ${phone} برای بازرسی دستی)`);
}

console.log(`\n========================================`);
console.log(`نتیجه: ${passed} موفق / ${failed} ناموفق`);
if (failures.length) { console.log("ناموفق‌ها:", failures.join(" | ")); process.exit(1); }
