/* eslint-disable no-console */
/* ============================================================
 *  QA فاز ۱۲ — ربات تلگرام
 *  اجرا:  node scripts/qa-phase12.mjs
 *  (سرور dev/prod روی پورت ۳۰۰۰؛ بدون توکن واقعی — همهٔ پاسخ‌های
 *   ربات از «webhook reply» رسمی تلگرام assert می‌شوند)
 * ============================================================ */
import pg from "pg";

const BASE = "http://localhost:3000";
const client = new pg.Client("postgres://postgres:postgres@127.0.0.1:5432/app_db");
await client.connect();

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`); }
};
const json = async (res) => { try { return await res.json(); } catch { return {}; } };

const USER_CHAT = "111222333";   // مشتری آزمایشی
const ADMIN_CHAT = "999888777";  // مدیر آزمایشی
const QA_PHONE = "09120000012";

console.log("— QA فاز ۱۲: ربات تلگرام —\n");

/* ---------- ۰) دیتابیس و تنظیمات پایه ---------- */
console.log("● دیتابیس");
for (const table of ["kiya_tg_settings", "kiya_tg_chats"]) {
  const r = await client.query(`select to_regclass('${table}') as t`);
  check(`جدول ${table} وجود دارد`, !!r.rows[0].t);
}
await client.query("insert into kiya_tg_settings (id) values (1) on conflict do nothing");
await client.query("update kiya_tg_settings set enabled=true, bot_token='', channel_id='@KiyaTestChannel', admin_chat_ids=$1, auto_publish=true, site_url='https://kiya-test.ir' where id=1", [ADMIN_CHAT]);
await client.query("delete from kiya_tg_chats where chat_id = any($1)", [[USER_CHAT, ADMIN_CHAT]]);
await client.query("delete from kiya_orders where phone=$1", [QA_PHONE]);
await client.query("update kiya_tg_settings set webhook_secret = md5(random()::text) where id=1 and webhook_secret=''");
const { rows: [{ webhook_secret: SECRET }] } = await client.query("select webhook_secret from kiya_tg_settings where id=1");

/* کمکی‌ها: شبیه‌سازی آپدیت تلگرام */
const HOOK = `${BASE}/api/telegram/webhook`;
const HEADERS = { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": SECRET || "" };
let updateId = 1000;
async function sendText(chatId, text, name = "کاربر آزمایشی") {
  const res = await fetch(HOOK, { method: "POST", headers: HEADERS, body: JSON.stringify({ update_id: updateId++, message: { message_id: updateId, chat: { id: Number(chatId), first_name: name }, from: { id: Number(chatId) }, text } }) });
  return { status: res.status, data: await json(res) };
}
async function tap(chatId, data, name = "کاربر آزمایشی") {
  const res = await fetch(HOOK, { method: "POST", headers: HEADERS, body: JSON.stringify({ update_id: updateId++, callback_query: { id: `cb${updateId}`, data, from: { id: Number(chatId), first_name: name }, message: { chat: { id: Number(chatId) } } } }) });
  return { status: res.status, data: await json(res) };
}
const buttons = (reply) => (reply?.reply_markup?.inline_keyboard || []).flat();

/* ---------- ۱) امنیت وبهوک ---------- */
console.log("\n● امنیت وبهوک");
{
  // اگر رمز هنوز ساخته نشده، اولین فراخوانی معتبر آن را می‌سازد
  const bad = await fetch(HOOK, { method: "POST", headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "wrong-secret" }, body: JSON.stringify({ update_id: 1 }) });
  check("رمز اشتباه → 401", bad.status === 401, `status=${bad.status}`);
  const empty = await fetch(HOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ update_id: 2 }) });
  check("بدون هدر رمز → 401", empty.status === 401 || !SECRET, `status=${empty.status}`);
  const weird = await fetch(HOOK, { method: "POST", headers: HEADERS, body: "نامعتبر{{{" });
  check("بدنهٔ خراب → 200 بدون خطا (تا تلگرام تکرار نکند)", weird.status === 200);
}

/* ---------- ۲) /start و منوی اصلی ---------- */
console.log("\n● /start و منو");
{
  const { status, data } = await sendText(USER_CHAT, "/start");
  check("پاسخ 200 با webhook reply", status === 200 && data.method === "sendMessage");
  check("خوش‌آمد فارسی", String(data.text || "").includes("کیا"));
  check("دکمه‌های منو (دسته‌بندی/سبد/سفارش)", buttons(data).some(b => b.callback_data === "cats") && buttons(data).some(b => b.callback_data === "cart") && buttons(data).some(b => b.callback_data === "orders"));
  check("دکمهٔ کانال با آدرس درست", buttons(data).some(b => (b.url || "").includes("t.me/KiyaTestChannel")));
  const { rows } = await client.query("select * from kiya_tg_chats where chat_id=$1", [USER_CHAT]);
  check("چت در دیتابیس ثبت شد", rows.length === 1 && rows[0].name.includes("آزمایشی"));
}

/* ---------- ۳) مرور دسته‌ها و محصول ---------- */
console.log("\n● مرور فروشگاه");
const { rows: [belt] } = await client.query("select * from kiya_products where slug='classic-leather-belt'");
{
  const cats = await tap(USER_CHAT, "cats");
  check("فهرست دسته‌ها", buttons(cats.data).some(b => (b.callback_data || "").startsWith("cat:")));
  const list = await tap(USER_CHAT, "cat:belts");
  check("محصولات دستهٔ کمربند", buttons(list.data).some(b => b.callback_data === `p:${belt.id}`));
  const detail = await tap(USER_CHAT, `p:${belt.id}`);
  check("جزئیات محصول: نام و قیمت", String(detail.data.text || "").includes(belt.name) && String(detail.data.text || "").includes("تومان"));
  check("لینک سایت داخل پیام", String(detail.data.text || "").includes("kiya-test.ir/product/classic-leather-belt"));
  check("دکمهٔ افزودن به سبد", buttons(detail.data).some(b => b.callback_data === `add:${belt.id}`));
  const sale = await tap(USER_CHAT, "sale");
  check("تخفیف‌دارها پاسخ می‌دهد", sale.status === 200 && typeof sale.data.text === "string");
}

/* ---------- ۴) سبد: انتخاب سایز/رنگ ---------- */
console.log("\n● سبد خرید");
{
  const add = await tap(USER_CHAT, `add:${belt.id}`);
  check("چند سایز → پرسش سایز", String(add.data.text || "").includes("سایز") && buttons(add.data).some(b => (b.callback_data || "").startsWith(`sz:${belt.id}:`)));
  const size = await tap(USER_CHAT, `sz:${belt.id}:1`);
  const addedDirect = String(size.data.text || "").includes("اضافه شد");
  const colorAsk = buttons(size.data).some(b => (b.callback_data || "").startsWith(`cl:${belt.id}:`));
  check("انتخاب سایز → افزودن یا پرسش رنگ", addedDirect || colorAsk);
  if (colorAsk) {
    const color = await tap(USER_CHAT, `cl:${belt.id}:1:0`);
    check("انتخاب رنگ → اضافه شد", String(color.data.text || "").includes("اضافه شد"));
  }
  const cart = await tap(USER_CHAT, "cart");
  check("سبد: نام محصول و جمع", String(cart.data.text || "").includes(belt.name) && String(cart.data.text || "").includes("جمع"));
  check("دکمهٔ ثبت سفارش", buttons(cart.data).some(b => b.callback_data === "checkout"));
  const { rows } = await client.query("select state from kiya_tg_chats where chat_id=$1", [USER_CHAT]);
  const cartState = rows[0].state.cart || [];
  check("سبد در state ذخیره شد (سایز درست)", cartState.length === 1 && cartState[0].productId === belt.id && cartState[0].size === belt.sizes[1]);
}

/* ---------- ۵) چرخهٔ کامل ثبت سفارش ---------- */
console.log("\n● ثبت سفارش از تلگرام");
{
  const stockBefore = belt.stock;
  await tap(USER_CHAT, "checkout");
  const badName = await sendText(USER_CHAT, "ال");
  check("نام کوتاه رد می‌شود", String(badName.data.text || "").includes("۳ حرف") || String(badName.data.text || "").includes("نام"));
  await sendText(USER_CHAT, "الناز آزمایش تلگرام");
  const badPhone = await sendText(USER_CHAT, "0912");
  check("موبایل نامعتبر رد می‌شود", String(badPhone.data.text || "").includes("معتبر نیست") || String(badPhone.data.text || "").includes("0912"));
  await sendText(USER_CHAT, QA_PHONE);
  await sendText(USER_CHAT, "تهران");
  await sendText(USER_CHAT, "خیابان ولیعصر، کوچه آزمایش، پلاک ۱۲");
  const badPostal = await sendText(USER_CHAT, "12345");
  check("کد پستی ناقص رد می‌شود", String(badPostal.data.text || "").includes("۱۰ رقم"));
  const summary = await sendText(USER_CHAT, "1234567890");
  check("خلاصهٔ سفارش با نام/شهر/دکمهٔ تأیید", String(summary.data.text || "").includes("الناز") && String(summary.data.text || "").includes("تهران") && buttons(summary.data).some(b => b.callback_data === "confirm"));
  const confirm = await tap(USER_CHAT, "confirm");
  const codeMatch = String(confirm.data.text || "").match(/K-[0-9A-F]{10}/);
  check("سفارش ثبت شد و کد پیگیری برگشت", !!codeMatch, confirm.data.text);
  const { rows: [order] } = await client.query("select * from kiya_orders where phone=$1", [QA_PHONE]);
  check("سفارش در دیتابیس (همان جدول سایت)", !!order && order.code === codeMatch?.[0]);
  check("مبلغ درست (قیمت + ارسال طبق تنظیمات)", !!order && order.subtotal === belt.price);
  check("یادداشت «ثبت از ربات تلگرام»", !!order && order.note.includes("ربات تلگرام"));
  const { rows: [afterBelt] } = await client.query("select stock from kiya_products where id=$1", [belt.id]);
  check("موجودی کم شد", afterBelt.stock === stockBefore - 1, `${stockBefore}→${afterBelt.stock}`);
  const again = await tap(USER_CHAT, "confirm");
  check("تأیید دوباره → سفارش تکراری ساخته نمی‌شود", String(again.data.text || "").includes("کامل نیست"));
  const { rows: count } = await client.query("select count(*)::int as c from kiya_orders where phone=$1", [QA_PHONE]);
  check("فقط یک سفارش ثبت شده", count[0].c === 1);
  const { rows: [chat] } = await client.query("select phone, state from kiya_tg_chats where chat_id=$1", [USER_CHAT]);
  check("موبایل روی چت ذخیره و سبد خالی شد", chat.phone === QA_PHONE && (chat.state.cart || []).length === 0);
}

/* ---------- ۶) پیگیری سفارش ---------- */
console.log("\n● /orders");
{
  const { data } = await sendText(USER_CHAT, "/orders");
  check("سفارش با وضعیت فارسی نمایش داده شد", String(data.text || "").includes("K-") && String(data.text || "").includes("در انتظار تأیید"));
}

/* ---------- ۷) جستجو و مشاور استایل ---------- */
console.log("\n● جستجو و مشاور");
{
  await tap(USER_CHAT, "search");
  const search = await sendText(USER_CHAT, "کمربند چرم زیر ۲ میلیون");
  check("نتیجهٔ جستجو شامل محصول واقعی", buttons(search.data).some(b => (b.callback_data || "").startsWith("p:")));
  await tap(USER_CHAT, "stylist");
  const stylist = await sendText(USER_CHAT, "برای هدیهٔ سالگرد چی خوبه؟");
  check("مشاور استایل پاسخ فارسی داد", typeof stylist.data.text === "string" && stylist.data.text.length > 20);
  const { rows: catalog } = await client.query("select id from kiya_products where active=true");
  const ids = new Set(catalog.map(p => p.id));
  const suggested = buttons(stylist.data).map(b => b.callback_data || "").filter(d => d.startsWith("p:")).map(d => Number(d.slice(2)));
  check("عدم توهم: پیشنهادها از کاتالوگ واقعی", suggested.every(id => ids.has(id)));
  await sendText(USER_CHAT, "/cancel");
}

/* ---------- ۸) مشاورهٔ سایز ---------- */
console.log("\n● مشاورهٔ سایز");
{
  const menu = await tap(USER_CHAT, "size");
  check("فهرست محصولات سایزدار", buttons(menu.data).some(b => (b.callback_data || "").startsWith("szp:")));
  await tap(USER_CHAT, `szp:${belt.id}`);
  const badHeight = await sendText(USER_CHAT, "کوتاه");
  check("قد نامعتبر رد می‌شود", String(badHeight.data.text || "").includes("سانتی‌متر"));
  await sendText(USER_CHAT, "180");
  const result = await sendText(USER_CHAT, "85");
  const latinText = String(result.data.text || "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  check("پیشنهاد سایز قطعی برگشت", latinText.includes("سایز پیشنهادی") && belt.sizes.some(s => latinText.includes(s)), result.data.text);
}

/* ---------- ۹) پشتیبانی و پاسخ مدیر ---------- */
console.log("\n● پشتیبانی");
{
  await tap(USER_CHAT, "support");
  const support = await sendText(USER_CHAT, "سلام، دربارهٔ زمان ارسال به شیراز سؤال داشتم [QA12]");
  check("تأیید ثبت پیام", String(support.data.text || "").includes("پشتیبانی"));
  const { rows: [msg] } = await client.query("select * from kiya_messages where message like '%[QA12]%'");
  check("پیام در جدول پیام‌های سایت ثبت شد", !!msg && msg.phone === QA_PHONE);
  // پاسخ مدیر — چون phone واقعی است باید در صف پیامک برود
  const reply = await sendText(ADMIN_CHAT, `/reply_${msg.id} ارسال به شیراز ۲ تا ۴ روز کاری است.`, "مدیر");
  check("پاسخ مدیر پردازش شد", String(reply.data.text || "").includes("✅"), reply.data.text);
  const { rows: [msgAfter] } = await client.query("select read from kiya_messages where id=$1", [msg.id]);
  check("پیام خوانده‌شده علامت خورد", msgAfter.read === true);
  // پیام کاربر بدون شماره → phone = tg:chatId و پاسخ داخل تلگرام
  await client.query("update kiya_tg_chats set phone='' where chat_id=$1", [USER_CHAT]);
  await tap(USER_CHAT, "support");
  await sendText(USER_CHAT, "پیام دوم بدون شماره [QA12B]");
  const { rows: [msg2] } = await client.query("select * from kiya_messages where message like '%[QA12B]%'");
  check("گیرندهٔ تلگرامی با پیشوند tg:", !!msg2 && msg2.phone === `tg:${USER_CHAT}`);
  const reply2 = await sendText(ADMIN_CHAT, `/reply_${msg2.id} پاسخ تستی داخل تلگرام`, "مدیر");
  check("پاسخ تلگرامی ارسال شد (dev-log)", String(reply2.data.text || "").includes("تلگرام"));
  await client.query("update kiya_tg_chats set phone=$1 where chat_id=$2", [QA_PHONE, USER_CHAT]);
}

/* ---------- ۱۰) دستورهای مدیر ---------- */
console.log("\n● دستورهای مدیر");
{
  const stats = await sendText(ADMIN_CHAT, "/stats", "مدیر");
  check("آمار: سفارش/فروش/کاربران ربات", ["آمار", "سفارش", "کاربران ربات"].every(w => String(stats.data.text || "").includes(w)), stats.data.text);
  const userStats = await sendText(USER_CHAT, "/stats");
  check("کاربر عادی به /stats دسترسی ندارد", !String(userStats.data.text || "").includes("آمار فروشگاه"));
  const empty = await sendText(ADMIN_CHAT, "/broadcast", "مدیر");
  check("broadcast خالی → راهنما", String(empty.data.text || "").includes("متن"));
  const broadcast = await sendText(ADMIN_CHAT, "/broadcast حراج پاییزهٔ کیا شروع شد!", "مدیر");
  check("پیام همگانی ارسال شد", String(broadcast.data.text || "").includes("ارسال شد"));
}

/* ---------- ۱۱) ربات غیرفعال ---------- */
console.log("\n● خاموش‌کردن ربات");
{
  await client.query("update kiya_tg_settings set enabled=false where id=1");
  const off = await sendText(USER_CHAT, "/start");
  check("ربات خاموش → پاسخ خالی ok", off.status === 200 && off.data.ok === true && !off.data.method);
  await client.query("update kiya_tg_settings set enabled=true where id=1");
}

/* ---------- ۱۲) اکشن‌های پنل ---------- */
console.log("\n● پنل مدیریت");
{
  const { readFileSync } = await import("fs");
  const password = readFileSync("/home/user/.kiya-qa-password", "utf8").trim();
  const login = await fetch(`${BASE}/api/admin/auth`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ action: "login", password }) });
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  check("ورود مدیر", login.status === 200, `status=${login.status}`);
  const HEAD = { "Content-Type": "application/json", Origin: BASE, Cookie: cookie };

  const dash = await fetch(`${BASE}/api/admin`, { headers: HEAD });
  const data = await json(dash);
  check("GET پنل شامل telegramBot", !!data.telegramBot && !!data.telegramBot.settings);
  check("داشبورد: چت‌ها و وضعیت", data.telegramBot.chatCount >= 2 && data.telegramBot.online === false);
  check("توکن هرگز به مرورگر نمی‌رود", !JSON.stringify(data.telegramBot).includes("bot_token") && data.telegramBot.settings.hasToken === false);

  const save = await fetch(`${BASE}/api/admin`, { method: "POST", headers: HEAD, body: JSON.stringify({ action: "tg.settings", settings: { enabled: true, botToken: "__keep__", botUsername: "@KiyaShopBot", channelId: "@KiyaTestChannel", adminChatIds: ADMIN_CHAT, siteUrl: "https://kiya-test.ir/", autoPublish: true } }) });
  check("ذخیرهٔ تنظیمات", save.status === 200);
  const { rows: [tgRow] } = await client.query("select * from kiya_tg_settings where id=1");
  check("پاک‌سازی ورودی: @ از username و / از انتهای آدرس حذف شد", tgRow.bot_username === "KiyaShopBot" && tgRow.site_url === "https://kiya-test.ir");

  const badUrl = await fetch(`${BASE}/api/admin`, { method: "POST", headers: HEAD, body: JSON.stringify({ action: "tg.webhook.set", url: "http://insecure.ir" }) });
  check("وبهوک بدون https رد می‌شود", badUrl.status === 400);
  const noToken = await fetch(`${BASE}/api/admin`, { method: "POST", headers: HEAD, body: JSON.stringify({ action: "tg.webhook.set", url: "https://kiya-test.ir" }) });
  check("وبهوک بدون توکن → پیام راهنما", noToken.status === 400 && (await json(noToken)).error.includes("توکن"));

  const test = await fetch(`${BASE}/api/admin`, { method: "POST", headers: HEAD, body: JSON.stringify({ action: "tg.test", chatId: "" }) });
  const testData = await json(test);
  check("پیام آزمایشی (حالت dev)", test.status === 200 && testData.message.includes("آزمایشی"));

  const publish = await fetch(`${BASE}/api/admin`, { method: "POST", headers: HEAD, body: JSON.stringify({ action: "tg.publish", productId: belt.id }) });
  check("انتشار پست محصول (حالت dev)", publish.status === 200);

  const post = await fetch(`${BASE}/api/admin`, { method: "POST", headers: HEAD, body: JSON.stringify({ action: "tg.channel.post", message: "پست آزمایشی کانال کیا [QA12]" }) });
  check("پست متنی کانال", post.status === 200);

  // انتشار خودکار: ساخت محصول جدید فعال نباید خطا بدهد
  const newProduct = await fetch(`${BASE}/api/admin`, { method: "POST", headers: HEAD, body: JSON.stringify({ action: "product.save", product: { name: "محصول تست انتشار QA12", slug: "qa12-publish-test", category: "belts", description: "محصول آزمایشی فاز ۱۲ برای تست انتشار خودکار در کانال", material: "چرم", price: 500000, stock: 3, image: "/images/product-belt-1.jpg", colors: [], sizes: [], featured: false, active: true } }) });
  check("محصول جدید + انتشار خودکار بدون خطا", newProduct.status === 200, JSON.stringify(await json(newProduct)));
}

/* ---------- پاک‌سازی ---------- */
console.log("\n● پاک‌سازی");
{
  await client.query("delete from kiya_orders where phone=$1", [QA_PHONE]);
  await client.query("update kiya_products set stock=$1 where id=$2", [belt.stock, belt.id]);
  await client.query("delete from kiya_products where slug='qa12-publish-test'");
  await client.query("delete from kiya_messages where message like '%[QA12%'");
  await client.query("delete from kiya_tg_chats where chat_id = any($1)", [[USER_CHAT, ADMIN_CHAT]]);
  await client.query("delete from kiya_outbox where body like '%[QA12%' or body like '%شیراز%'");
  await client.query("update kiya_tg_settings set enabled=true, bot_token='', bot_username='', channel_id='', admin_chat_ids='', site_url='', webhook_url='', auto_publish=true where id=1");
  const { rows: [c1] } = await client.query("select count(*)::int c from kiya_orders where phone=$1", [QA_PHONE]);
  check("داده‌های آزمایشی پاک شد", c1.c === 0);
}

console.log(`\n========== نتیجه: ${pass} موفق / ${fail} ناموفق ==========`);
await client.end();
process.exit(fail ? 1 : 0);
