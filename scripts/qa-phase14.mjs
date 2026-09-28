/* eslint-disable no-console */
/* ============================================================
 *  QA فاز ۱۴ — پرداخت (درگاه/کارت‌به‌کارت)، پیامک، مرجوعی، پیک
 *  اجرا:  KIYA_QA_PASSWORD=... node scripts/qa-phase14.mjs
 * ============================================================ */
import { readFileSync } from "fs";
import pg from "pg";

const BASE = "http://127.0.0.1:3000";
const client = new pg.Client("postgres://postgres:postgres@127.0.0.1:5432/app_db");
await client.connect();

let passed = 0, failed = 0; const failures = [];
const check = (name, ok, extra = "") => {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; failures.push(name); console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
};
async function api(path, options = {}, cookie = "") {
  const response = await fetch(BASE + path, { redirect: "manual", ...options, headers: { "Content-Type": "application/json", Origin: BASE, ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } });
  let data = null; try { data = await response.json(); } catch { /* html/redirect */ }
  return { status: response.status, data, headers: response.headers };
}
const setCookie = headers => (headers.getSetCookie?.() || []).map(c => c.split(";")[0]).join("; ");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

console.log("— QA فاز ۱۴: پرداخت / پیامک / مرجوعی / پیک —");

/* ---------- ۱) ورود مدیر ---------- */
console.log("\n۱) ورود مدیر و تنظیمات پرداخت");
const password = process.env.KIYA_QA_PASSWORD || readFileSync("/home/user/.kiya-qa-password", "utf8").trim();
const login = await api("/api/admin/auth", { method: "POST", body: JSON.stringify({ action: "login", password }) });
const AC = setCookie(login.headers);
check("ورود مدیر", login.status === 200);
const act = (action, payload = {}) => api("/api/admin", { method: "POST", body: JSON.stringify({ action, ...payload }) }, AC);
const dash = () => api("/api/admin", {}, AC).then(r => r.data);

/* تنظیمات پرداخت: کارت + پیک، بدون مرچنت (درگاه آزمایشی) */
{
  const d = await dash();
  check("GET پنل شامل payment و returns", !!d.payment && Array.isArray(d.returns));
  const s = d.settings;
  const bad = await act("settings.save", { settings: { ...s, payment: { cardEnabled: true, cardNumber: "603799", cardName: "کیا" } } });
  check("شماره کارت ناقص رد می‌شود", bad.status !== 200);
  const good = await act("settings.save", { settings: { ...s, payment: { zarinpalEnabled: true, merchantId: "", sandbox: false, cardEnabled: true, cardNumber: "6037-9911-2233-4455", cardName: "فروشگاه کیا", courierEnabled: true, courierCost: 40000, courierNote: "فقط تهران" } } });
  check("ذخیرهٔ تنظیمات پرداخت", good.status === 200);
  const d2 = await dash();
  check("حالت درگاه = آزمایشی (بدون مرچنت)", d2.payment.mode.includes("آزمایشی"), d2.payment.mode);
  check("کارت در تنظیمات ذخیره شد", d2.settings.payment?.cardNumber === "6037-9911-2233-4455");
  const noTouch = await act("settings.save", { settings: { ...d2.settings, payment: undefined } });
  const d3 = await dash();
  check("payment=undefined یعنی بدون تغییر", noTouch.status === 200 && d3.settings.payment?.cardNumber === "6037-9911-2233-4455");
}

/* ---------- ۲) سفارش مهمان + پرداخت درگاه آزمایشی ---------- */
console.log("\n۲) پرداخت آنلاین (درگاه آزمایشی)");
const phone = "0912" + String(Math.floor(1000000 + Math.random() * 8999999));
const shopData = (await api("/api/shop")).data;
const product = shopData.products.find(p => p.stock > 3);
const placeOrder = (extra = {}, cookie = "") => api("/api/orders", { method: "POST", body: JSON.stringify({ name: "کیو ای فاز چهارده", phone, city: "تهران", postalCode: "1234567890", address: "خیابان آزمایش، پلاک ۱۴", delivery: "shipping", requestKey: crypto.randomUUID(), items: [{ productId: product.id, quantity: 1, size: product.sizes[0] || "استاندارد", color: product.colors[0]?.name || "پیش‌فرض" }], ...extra }) }, cookie);
let orderCode = "";
{
  const order = await placeOrder();
  orderCode = order.data?.code || "";
  check("ثبت سفارش مهمان", order.status === 200 && !!orderCode, JSON.stringify(order.data));

  const track = await api("/api/orders/track", { method: "POST", body: JSON.stringify({ code: orderCode, phone }) });
  check("track شامل payment است", !!track.data?.payment);
  check("canPay=true و کارت اعلام می‌شود", track.data.payment.canPay === true && track.data.payment.cardNumber === "6037-9911-2233-4455");

  const request1 = await api("/api/payment/request", { method: "POST", body: JSON.stringify({ code: orderCode, phone }) });
  check("payment/request آدرس mock می‌دهد", request1.status === 200 && request1.data?.url?.startsWith("/payment/mock"), JSON.stringify(request1.data));
  const authority1 = new URL(BASE + request1.data.url).searchParams.get("authority");
  const { rows: [txn1] } = await client.query("select * from kiya_transactions where authority=$1", [authority1]);
  check("تراکنش pending با مبلغ سفارش ثبت شد", txn1?.status === "pending" && Number(txn1?.amount) > 0);
  const mockPage = await fetch(`${BASE}${request1.data.url}`);
  check("صفحهٔ درگاه آزمایشی باز می‌شود", mockPage.status === 200 && (await mockPage.text()).includes("درگاه پرداخت آزمایشی"));

  /* انصراف */
  const cancel = await api(`/api/payment/callback?order=${orderCode}&Authority=${authority1}&Status=NOK`);
  check("انصراف → ریدایرکت payment=failed", cancel.status === 302 && cancel.headers.get("location")?.includes("payment=failed"));
  const { rows: [txn1b] } = await client.query("select status from kiya_transactions where authority=$1", [authority1]);
  const { rows: [o1] } = await client.query("select payment_status from kiya_orders where code=$1", [orderCode]);
  check("تراکنش failed و سفارش unpaid ماند", txn1b.status === "failed" && o1.payment_status === "unpaid");

  /* پرداخت موفق */
  const request2 = await api("/api/payment/request", { method: "POST", body: JSON.stringify({ code: orderCode, phone }) });
  const authority2 = new URL(BASE + request2.data.url).searchParams.get("authority");
  const ok = await api(`/api/payment/callback?order=${orderCode}&Authority=${authority2}&Status=OK`);
  check("پرداخت موفق → ریدایرکت payment=success", ok.status === 302 && ok.headers.get("location")?.includes("payment=success"));
  const { rows: [o2] } = await client.query("select payment_status, payment_method, payment_ref from kiya_orders where code=$1", [orderCode]);
  check("سفارش paid + روش gateway-dev + مرجع ثبت شد", o2.payment_status === "paid" && o2.payment_method === "gateway-dev" && o2.payment_ref.startsWith("DEV-"));

  /* idempotency و دستکاری */
  const again = await api(`/api/payment/callback?order=${orderCode}&Authority=${authority2}&Status=OK`);
  check("callback تکراری → همچنان success و بدون تراکنش دوباره", again.status === 302 && again.headers.get("location")?.includes("payment=success"));
  const { rows: [cnt] } = await client.query("select count(*)::int c from kiya_transactions where order_code=$1 and status='success'", [orderCode]);
  check("فقط یک تراکنش موفق برای سفارش", cnt.c === 1);
  const forged = await api(`/api/payment/callback?order=${orderCode}&Authority=FAKE-123&Status=OK`);
  check("authority جعلی → failed", forged.status === 302 && forged.headers.get("location")?.includes("payment=failed"));
  const repay = await api("/api/payment/request", { method: "POST", body: JSON.stringify({ code: orderCode, phone }) });
  check("پرداخت دوباره روی سفارش paid رد می‌شود", repay.status === 400);

  /* پیامک تأیید پرداخت */
  const d = await dash();
  const sms = d.outbox.find(m => m.recipient === phone && m.ruleKey === "payment");
  check("پیامک تأیید پرداخت در outbox", !!sms, "پیدا نشد");
  check("پیامک با dev-log ارسال شد", sms?.status === "sent" && sms?.provider === "dev-log", `status=${sms?.status}`);
  check("تراکنش‌ها در پنل دیده می‌شوند", d.payment.transactions.some(t => t.orderCode === orderCode && t.status === "success"));
}

/* ---------- ۳) کارت‌به‌کارت با رسید ---------- */
console.log("\n۳) کارت‌به‌کارت و رسید");
let cardOrder = "";
{
  const order = await placeOrder({ requestKey: crypto.randomUUID() });
  cardOrder = order.data?.code || "";
  check("سفارش دوم ثبت شد", !!cardOrder);
  const short = await api("/api/payment/receipt", { method: "POST", body: JSON.stringify({ code: cardOrder, phone, reference: "12" }) });
  check("شماره پیگیری کوتاه رد می‌شود", short.status === 400);
  const badImg = await api("/api/payment/receipt", { method: "POST", body: JSON.stringify({ code: cardOrder, phone, reference: "998877", image: "data:text/html;base64,PGI+" }) });
  check("فایل غیرتصویری رد می‌شود", badImg.status === 400);
  const good = await api("/api/payment/receipt", { method: "POST", body: JSON.stringify({ code: cardOrder, phone, reference: "998877", image: PNG }) });
  check("ثبت رسید موفق", good.status === 200, JSON.stringify(good.data));
  const { rows: [o] } = await client.query("select payment_status, payment_method, payment_ref, receipt_image from kiya_orders where code=$1", [cardOrder]);
  check("روش card و مرجع ثبت شد؛ paid نشد (تا تأیید پنل)", o.payment_method === "card" && o.payment_ref === "998877" && o.payment_status === "unpaid");
  check("تصویر رسید در media ذخیره شد", /^\/api\/media\/[a-f\d-]{36}$/.test(o.receipt_image));
  const img = await fetch(BASE + o.receipt_image);
  check("تصویر رسید قابل نمایش برای مدیر", img.status === 200 && (img.headers.get("content-type") || "").startsWith("image/"));
  const track = await api("/api/orders/track", { method: "POST", body: JSON.stringify({ code: cardOrder, phone }) });
  check("رهگیری: در انتظار تأیید فروشگاه", track.data.order.paymentMethod === "card" && track.data.order.paymentStatus === "unpaid");
}

/* ---------- ۴) مرجوعی مهمان (بدون کیف پول) ---------- */
console.log("\n۴) مرجوعی مهمان");
{
  const early = await api("/api/returns", { method: "POST", body: JSON.stringify({ code: cardOrder, phone, reason: "سایز کمربند مناسب نیست و تعویض می‌خواهم" }) });
  check("مرجوعی قبل از ارسال رد می‌شود", early.status === 400);
  const d = await dash();
  const row = d.orders.find(o => o.code === cardOrder);
  await act("order.update", { id: row.id, status: "shipped", paymentStatus: "paid", trackingNumber: "TRK14" });
  const short = await api("/api/returns", { method: "POST", body: JSON.stringify({ code: cardOrder, phone, reason: "بد بود" }) });
  check("دلیل کوتاه رد می‌شود", short.status === 400);
  const good = await api("/api/returns", { method: "POST", body: JSON.stringify({ code: cardOrder, phone, reason: "سایز کمربند مناسب نیست و تعویض می‌خواهم" }) });
  check("ثبت مرجوعی موفق", good.status === 200, JSON.stringify(good.data));
  const dup = await api("/api/returns", { method: "POST", body: JSON.stringify({ code: cardOrder, phone, reason: "درخواست تکراری برای همان سفارش است" }) });
  check("مرجوعی بازِ تکراری رد می‌شود", dup.status === 400);
  const d2 = await dash();
  const item = d2.returns.find(r => r.orderCode === cardOrder);
  check("مرجوعی در پنل دیده می‌شود", item?.status === "requested");
  const refundEarly = await act("return.update", { id: item.id, status: "refunded", refundAmount: 1000 });
  check("بازگشت وجه قبل از تأیید رد می‌شود", refundEarly.status !== 200);
  const approve = await act("return.update", { id: item.id, status: "approved", adminNote: "با پلمب سالم ارسال کنید" });
  check("تأیید مرجوعی", approve.status === 200);
  const walletFail = await act("return.update", { id: item.id, status: "refunded", refundToWallet: true, refundAmount: 50000 });
  check("بازگشت به کیف پول برای مهمان رد می‌شود", walletFail.status !== 200);
  const refund = await act("return.update", { id: item.id, status: "refunded", refundToWallet: false, refundAmount: 50000, adminNote: "کارت‌به‌کارت شد" });
  check("ثبت بازگشت وجه کارتی", refund.status === 200);
  const track = await api("/api/orders/track", { method: "POST", body: JSON.stringify({ code: cardOrder, phone }) });
  const tr = track.data.returns?.[0];
  check("رهگیری مرجوعی: refunded با مبلغ", tr?.status === "refunded" && tr?.refundAmount === 50000 && tr?.refundMethod === "card");
  const d3 = await dash();
  check("پیامک مرجوعی ارسال شد", d3.outbox.some(m => m.recipient === phone && m.body.includes("مرجوعی") && m.status === "sent"));
}

/* ---------- ۵) مرجوعی عضو باشگاه → کیف پول ---------- */
console.log("\n۵) بازگشت وجه به کیف پول عضو");
const memberPhone = "0912" + String(Math.floor(1000000 + Math.random() * 8999999));
let memberOrder = "";
{
  const otp = await api("/api/customer/auth", { method: "POST", body: JSON.stringify({ action: "request-otp", phone: memberPhone }) });
  check("درخواست OTP", otp.status === 200);
  /* روی build نهایی devCode برنمی‌گردد (درست!) — کد را مثل پیامک واقعی از سمت سرور می‌خوانیم */
  const { rows: [otpRow] } = await client.query("select code from kiya_otp_codes where phone=$1 and used=false order by id desc limit 1", [memberPhone]);
  const verify = await api("/api/customer/auth", { method: "POST", body: JSON.stringify({ action: "verify-otp", phone: memberPhone, code: otpRow.code }) });
  const cc = setCookie(verify.headers);
  check("عضویت مشتری", verify.status === 200);
  const order = await api("/api/orders", { method: "POST", body: JSON.stringify({ name: "عضو کیو ای چهارده", phone: memberPhone, city: "تهران", postalCode: "1234567890", address: "خیابان آزمایش، پلاک ۱۵", delivery: "shipping", requestKey: crypto.randomUUID(), items: [{ productId: product.id, quantity: 1, size: product.sizes[0] || "استاندارد", color: product.colors[0]?.name || "پیش‌فرض" }] }) }, cc);
  memberOrder = order.data?.code || "";
  check("سفارش عضو ثبت شد", !!memberOrder);
  const d = await dash();
  const row = d.orders.find(o => o.code === memberOrder);
  check("سفارش عضو customerId دارد", !!row?.customerId);
  await act("order.update", { id: row.id, status: "delivered", paymentStatus: "paid", trackingNumber: "TRK15" });
  await api("/api/returns", { method: "POST", body: JSON.stringify({ code: memberOrder, phone: memberPhone, reason: "رنگ محصول با عکس سایت تفاوت دارد" }) });
  const d2 = await dash();
  const item = d2.returns.find(r => r.orderCode === memberOrder);
  await act("return.update", { id: item.id, status: "approved" });
  const refund = await act("return.update", { id: item.id, status: "refunded", refundToWallet: true, refundAmount: row.total });
  check("بازگشت وجه به کیف پول", refund.status === 200, JSON.stringify(refund.data));
  const { rows: [member] } = await client.query("select id, wallet_balance from kiya_customers where phone=$1", [memberPhone]);
  check("موجودی کیف پول شارژ شد", Number(member.wallet_balance) === Number(row.total), `balance=${member?.wallet_balance}`);
  const { rows: [wt] } = await client.query("select kind, amount, order_code from kiya_wallet_txns where customer_id=$1 order by id desc limit 1", [member.id]);
  check("تراکنش credit کیف پول با کد سفارش", wt?.kind === "credit" && Number(wt?.amount) === Number(row.total) && wt?.order_code === memberOrder);
}

/* ---------- ۶) پیک شهری ---------- */
console.log("\n۶) پیک شهری");
let courierOrder = "";
{
  const order = await placeOrder({ delivery: "courier", requestKey: crypto.randomUUID(), phone });
  courierOrder = order.data?.code || "";
  check("سفارش با پیک ثبت شد", order.status === 200 && !!courierOrder, JSON.stringify(order.data));
  const { rows: [o] } = await client.query("select shipping, delivery from kiya_orders where code=$1", [courierOrder]);
  check("هزینهٔ پیک ۴۰هزار اعمال شد", o?.delivery === "courier" && Number(o?.shipping) === 40000, `shipping=${o?.shipping}`);
  const d = await dash();
  await act("settings.save", { settings: { ...d.settings, payment: { ...d.settings.payment, courierEnabled: false } } });
  const off = await placeOrder({ delivery: "courier", requestKey: crypto.randomUUID() });
  check("پیک غیرفعال → سفارش پیک رد می‌شود", off.status !== 200);
}

/* ---------- ۷) نشت‌نکردن مرچنت + حالت زرین‌پال ---------- */
console.log("\n۷) امنیت تنظیمات");
{
  const d = await dash();
  await act("settings.save", { settings: { ...d.settings, payment: { ...d.settings.payment, merchantId: "aaaabbbb-cccc-dddd-eeee-ffff11112222" } } });
  const d2 = await dash();
  check("حالت درگاه = زرین‌پال با مرچنت", d2.payment.mode.includes("زرین‌پال"), d2.payment.mode);
  check("پنل فقط hint مرچنت را نشان می‌دهد", d2.payment.settings.merchantHint.includes("2222"));
  const html = await (await fetch(`${BASE}/track`, { cache: "no-store" })).text();
  check("مرچنت‌کد به HTML فروشگاه نشت نمی‌کند", !html.includes("aaaabbbb-cccc-dddd-eeee-ffff11112222"));
  await act("settings.save", { settings: { ...d.settings, payment: { ...d.settings.payment, merchantId: "" } } });
}

/* ---------- پاک‌سازی ---------- */
console.log("\n— پاک‌سازی داده‌های QA —");
{
  const codes = [orderCode, cardOrder, memberOrder, courierOrder].filter(Boolean);
  const { rows: media } = await client.query("select receipt_image from kiya_orders where code = any($1::text[]) and receipt_image <> ''", [codes]);
  for (const m of media) await client.query("delete from kiya_media where id = $1", [m.receipt_image.replace("/api/media/", "")]);
  await client.query("delete from kiya_transactions where order_code = any($1::text[])", [codes]);
  await client.query("delete from kiya_returns where order_code = any($1::text[])", [codes]);
  for (const item of (await client.query("select id, items, status, coupon from kiya_orders where code = any($1::text[])", [codes])).rows) {
    if (item.status !== "cancelled") for (const line of item.items) await client.query("update kiya_products set stock = stock + $1 where id = $2", [line.quantity, line.productId]);
  }
  await client.query("delete from kiya_orders where code = any($1::text[])", [codes]);
  await client.query("delete from kiya_outbox where recipient = any($1::text[])", [[phone, memberPhone]]);
  await client.query("delete from kiya_wallet_txns where customer_id in (select id from kiya_customers where phone = any($1::text[]))", [[phone, memberPhone]]);
  await client.query("delete from kiya_points_logs where customer_id in (select id from kiya_customers where phone = any($1::text[]))", [[phone, memberPhone]]).catch(() => {});
  await client.query("delete from kiya_notifications where customer_id in (select id from kiya_customers where phone = any($1::text[]))", [[phone, memberPhone]]).catch(() => {});
  await client.query("delete from kiya_customers where phone = any($1::text[])", [[phone, memberPhone]]);
  await client.query("update kiya_settings set payment = $1 where id = 1", [JSON.stringify({ zarinpalEnabled: true, merchantId: "", sandbox: false, cardEnabled: true, cardNumber: "", cardName: "", courierEnabled: false, courierCost: 0, courierNote: "" })]);
  console.log("  🧹 سفارش‌ها، تراکنش‌ها، مرجوعی‌ها، پیامک‌ها و اعضای QA پاک شدند.");
}

console.log(`\n═════ نتیجه: ${passed} موفق / ${failed} ناموفق ═════`);
if (failures.length) console.log("موارد ناموفق: " + failures.join(" | "));
await client.end();
process.exit(failed ? 1 : 0);
