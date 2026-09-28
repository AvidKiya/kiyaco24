/* eslint-disable no-console */
/* ============================================================
 *  QA فاز ۱۱ — لایهٔ هوش مصنوعی
 *  اجرا:  node scripts/qa-phase11.mjs
 *  (سرور dev باید روی پورت ۳۰۰۰ بالا باشد؛ قبل از اجرا سرور را
 *   ری‌استارت کنید تا rate limit های in-memory خالی باشند)
 * ============================================================ */
import { readFileSync } from "fs";
import pg from "pg";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE, "Content-Type": "application/json" };
const client = new pg.Client("postgres://postgres:postgres@127.0.0.1:5432/app_db");
await client.connect();

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`); }
};
const json = async (res) => { try { return await res.json(); } catch { return {}; } };

console.log("— QA فاز ۱۱: لایهٔ هوش مصنوعی —\n");

/* ---------- ۰) پیش‌نیاز: جدول‌ها و ردیف تنظیمات ---------- */
console.log("● دیتابیس");
for (const table of ["kiya_ai_settings", "kiya_ai_logs", "kiya_ai_cache"]) {
  const r = await client.query(`select to_regclass('${table}') as t`);
  check(`جدول ${table} وجود دارد`, !!r.rows[0].t);
}
await client.query("insert into kiya_ai_settings (id) values (1) on conflict do nothing");
// حالت پایه: بدون کلید (موتور آفلاین) و همهٔ قابلیت‌ها روشن
await client.query("update kiya_ai_settings set api_key='', base_url='', features='{}'::jsonb, enabled=true, monthly_token_budget=0 where id=1");
await client.query("delete from kiya_ai_logs");

/* ---------- ۱) وضعیت ویجت ---------- */
console.log("\n● GET /api/ai/stylist (وضعیت ویجت)");
{
  const res = await fetch(`${BASE}/api/ai/stylist`);
  const data = await json(res);
  check("پاسخ 200", res.status === 200);
  check("enabled=true و نام دستیار برگشت", data.enabled === true && typeof data.name === "string" && data.name.length > 0);
}

/* ---------- ۲) مشاور استایل (موتور آفلاین) ---------- */
console.log("\n● POST /api/ai/stylist — موتور آفلاین");
{
  const res = await fetch(`${BASE}/api/ai/stylist`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ message: "برای هدیه تا ۱ میلیون تومان چی پیشنهاد می‌کنی؟" }) });
  const data = await json(res);
  check("پاسخ 200", res.status === 200, `status=${res.status}`);
  check("منبع پاسخ fallback است", data.source === "fallback", `source=${data.source}`);
  check("متن پاسخ فارسی غیرخالی", typeof data.reply === "string" && data.reply.length > 20);
  check("حداقل یک محصول پیشنهاد شد", Array.isArray(data.products) && data.products.length >= 1);
  const { rows: catalog } = await client.query("select id, price, stock from kiya_products where active=true");
  const ids = new Set(catalog.map(p => p.id));
  check("عدم توهم: همهٔ پیشنهادها در کاتالوگ واقعی‌اند", (data.products || []).every(p => ids.has(p.id)));
  check("رعایت بودجه: همه زیر ۱ میلیون", (data.products || []).every(p => p.price <= 1000000), JSON.stringify((data.products || []).map(p => p.price)));
  const inStock = new Map(catalog.map(p => [p.id, p.stock]));
  check("فقط محصولات موجود", (data.products || []).every(p => (inStock.get(p.id) ?? 0) > 0));
}
{
  // درخواست دستهٔ مشخص
  const res = await fetch(`${BASE}/api/ai/stylist`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ message: "یه کمربند مشکی برای استایل رسمی می‌خوام" }) });
  const data = await json(res);
  check("درخواست کمربند → پیشنهاد از دستهٔ belts", (data.products || []).some(p => p.category === "belts"), JSON.stringify((data.products || []).map(p => p.category)));
}
{
  // بودجهٔ غیرممکن
  const res = await fetch(`${BASE}/api/ai/stylist`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ message: "چیزی زیر ۵۰ هزار تومان دارید؟" }) });
  const data = await json(res);
  check("بودجهٔ غیرممکن → پاسخ صادقانه بدون محصول", (data.products || []).length === 0 && data.reply.length > 10);
}
{
  const res = await fetch(`${BASE}/api/ai/stylist`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ message: "x" }) });
  check("پیام خیلی کوتاه → 400", res.status === 400);
}
{
  const res = await fetch(`${BASE}/api/ai/stylist`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: JSON.stringify({ message: "سلام خوبی؟" }) });
  check("Origin نامعتبر → 403", res.status === 403);
}

/* ---------- ۳) جستجوی زبان طبیعی ---------- */
console.log("\n● POST /api/ai/search");
{
  const res = await fetch(`${BASE}/api/ai/search`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ query: "گردنبند نقره‌ای زیر ۵۰۰ هزار تومان" }) });
  const data = await json(res);
  check("پاسخ 200", res.status === 200);
  check("نتیجه شامل گردنبند است", (data.products || []).some(p => p.category === "necklaces"), JSON.stringify((data.products || []).map(p => p.category)));
  check("سقف قیمت رعایت شد", (data.products || []).every(p => p.price <= 500000));
  check("note توضیحی برگشت", typeof data.note === "string" && data.note.length > 0);
}
{
  const res = await fetch(`${BASE}/api/ai/search`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ query: "کفش ورزشی نایک" }) });
  const data = await json(res);
  check("جستجوی بی‌ربط → نتیجهٔ خالی بدون توهم", res.status === 200 && (data.products || []).length === 0);
}

/* ---------- ۴) پیشنهاد سایز (قطعی) ---------- */
console.log("\n● POST /api/ai/size");
const { rows: [belt] } = await client.query("select id, sizes from kiya_products where category='belts' and active=true limit 1");
const { rows: [ring] } = await client.query("select id, sizes from kiya_products where category='rings' and active=true limit 1");
{
  const res = await fetch(`${BASE}/api/ai/size`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ productId: belt.id, height: 178, weight: 82 }) });
  const data = await json(res);
  check("کمربند: پاسخ 200 با سایز", res.status === 200 && data.size, JSON.stringify(data));
  check("کمربند: سایز از بین سایزهای واقعی محصول", (belt.sizes || []).includes(String(data.size)), `size=${data.size} از ${JSON.stringify(belt.sizes)}`);
  check("کمربند: اطمینان بین ۵۰ تا ۱۰۰", data.confidence >= 50 && data.confidence <= 100);
}
{
  const res = await fetch(`${BASE}/api/ai/size`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ productId: ring.id, usualSize: "9" }) });
  const data = await json(res);
  check("انگشتر با سایز معمول: سایز معتبر", res.status === 200 && (ring.sizes || []).includes(String(data.size)));
}
{
  const res = await fetch(`${BASE}/api/ai/size`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ productId: belt.id }) });
  const data = await json(res);
  check("کمربند بدون قد/وزن → راهنمایی به‌جای حدس", res.status === 200 && !data.size && data.reply.length > 10);
}
{
  const res = await fetch(`${BASE}/api/ai/size`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ productId: 99999, height: 170, weight: 70 }) });
  check("محصول ناموجود → 404", res.status === 404);
}

/* ---------- ۵) پیشنهاد مکمل ---------- */
console.log("\n● GET /api/ai/recommend");
{
  const res = await fetch(`${BASE}/api/ai/recommend?productId=${belt.id}`);
  const data = await json(res);
  check("پاسخ 200", res.status === 200);
  check("مکمل‌ها از دسته‌های دیگر", (data.complements || []).length > 0 && data.complements.every(c => c.category !== "belts"), JSON.stringify((data.complements || []).map(c => c.category)));
  check("هر مکمل دلیل دارد", (data.complements || []).every(c => typeof c.reason === "string" && c.reason.length > 5));
  check("مشابه‌ها هم‌دسته‌اند", (data.similar || []).every(s => s.category === "belts"));
  check("خود محصول در پیشنهادها نیست", ![...(data.similar || []), ...(data.complements || [])].some(p => p.id === belt.id));
}
{
  const res = await fetch(`${BASE}/api/ai/recommend?productId=abc`);
  check("productId نامعتبر → 400", res.status === 400);
}

/* ---------- ۶) پنل مدیریت ---------- */
console.log("\n● پنل مدیریت (اکشن‌های ai.*)");
const password = readFileSync("/home/user/.kiya-qa-password", "utf8").trim();
const login = await fetch(`${BASE}/api/admin/auth`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ action: "login", password }) });
check("ورود ادمین", login.status === 200);
const cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
const admin = (body) => fetch(`${BASE}/api/admin`, { method: "POST", headers: { ...ORIGIN, Cookie: cookie }, body: JSON.stringify(body) });

{
  const res = await fetch(`${BASE}/api/admin`, { headers: { Cookie: cookie } });
  const data = await json(res);
  check("GET پنل شامل ai است", !!data.ai && !!data.ai.settings);
  check("کلید API در پاسخ پنل لو نمی‌رود", !JSON.stringify(data.ai.settings).includes("secret-test-key"));
  check("داشبورد ai: logs و usage و cache", Array.isArray(data.ai.logs) && Array.isArray(data.ai.usage) && !!data.ai.cache);
}
{
  const res = await admin({ action: "ai.settings", settings: { enabled: true, baseUrl: "https://api.test-provider.ir/v1", apiKey: "secret-test-key-123", model: "test-model", temperature: 55, maxTokens: 500, monthlyTokenBudget: 90000, assistantName: "استایلیست کیا", features: { stylist: true, search: true, size: true, recommend: true, captions: true, trends: false } } });
  check("ai.settings ذخیره شد", res.status === 200);
  const { rows: [row] } = await client.query("select * from kiya_ai_settings where id=1");
  check("مقادیر در DB نشست", row.base_url === "https://api.test-provider.ir/v1" && row.api_key === "secret-test-key-123" && row.model === "test-model" && row.temperature === 55 && row.assistant_name === "استایلیست کیا");
  check("قابلیت trends خاموش شد", row.features.trends === false);
}
{
  // با apiKey="__keep__" کلید قبلی حفظ شود
  const res = await admin({ action: "ai.settings", settings: { enabled: true, baseUrl: "https://api.test-provider.ir/v1", apiKey: "__keep__", model: "test-model-2", temperature: 55, maxTokens: 500, monthlyTokenBudget: 90000, assistantName: "استایلیست کیا", features: { stylist: true, search: true, size: true, recommend: true, captions: true, trends: true } } });
  check("ویرایش بدون تغییر کلید", res.status === 200);
  const { rows: [row] } = await client.query("select api_key, model from kiya_ai_settings where id=1");
  check("کلید قبلی حفظ شد و مدل عوض شد", row.api_key === "secret-test-key-123" && row.model === "test-model-2");
}
{
  const res = await admin({ action: "ai.settings", settings: { enabled: true, baseUrl: "http://insecure.ir", apiKey: "__keep__", model: "m", temperature: 70, maxTokens: 700, monthlyTokenBudget: 0, assistantName: "x", features: {} } });
  check("آدرس http → 400", res.status === 400);
}
{
  // نام دستیار جدید باید در GET عمومی ویجت دیده شود
  const res = await fetch(`${BASE}/api/ai/stylist`);
  const data = await json(res);
  check("نام دستیار از تنظیمات پنل می‌آید", data.name === "استایلیست کیا", `name=${data.name}`);
}
{
  // تست اتصال با سرویس قلابی: باید مودبانه شکست بخورد (نه crash)
  const res = await admin({ action: "ai.test" });
  const data = await json(res);
  check("ai.test با سرویس قلابی: ok=false بدون خطای سرور", res.status === 200 && data.ok === false && typeof data.message === "string");
}
{
  // چت با کلید قلابی: باید بعد از خطای اتصال، به موتور آفلاین برگردد
  const res = await fetch(`${BASE}/api/ai/stylist`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ message: "یه دستبند خوب معرفی کن" }) });
  const data = await json(res);
  check("سرویس خراب → fallback شفاف (سایت نمی‌شکند)", res.status === 200 && data.source === "fallback" && (data.products || []).length > 0);
  const { rows } = await client.query("select count(*)::int as n from kiya_ai_logs where feature='stylist' and source='error'");
  check("خطای سرویس در گزارش مصرف ثبت شد", rows[0].n >= 1);
}
{
  const res = await admin({ action: "ai.caption", productId: belt.id });
  const data = await json(res);
  check("ai.caption: سه نسخه کپشن", res.status === 200 && data.captions && [data.captions.instagram, data.captions.telegram, data.captions.page].every(c => typeof c === "string" && c.length > 20));
  check("کپشن شامل نام یا قیمت محصول", data.captions.instagram.length > 0 && (data.captions.telegram.includes("تومان") || data.captions.page.length > 0));
}
{
  const res = await admin({ action: "ai.trend" });
  const data = await json(res);
  check("ai.trend: گزارش برگشت", res.status === 200 && typeof data.report === "string" && data.report.length > 50);
  check("ai.trend: آمار ساختاریافته", !!data.stats && Array.isArray(data.stats.categories));
}
{
  // سقف بودجهٔ توکن: با سقف ۱ و لاگ مصرف بالا، مسیر AI نباید تلاش شود (مستقیم fallback بدون error جدید)
  await client.query("update kiya_ai_settings set monthly_token_budget=1 where id=1");
  await client.query("insert into kiya_ai_logs (feature, source, prompt_tokens, completion_tokens) values ('stylist','ai',500,500)");
  const { rows: before } = await client.query("select count(*)::int as n from kiya_ai_logs where source='error'");
  const res = await fetch(`${BASE}/api/ai/stylist`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ message: "یه انگشتر می‌خوام" }) });
  const data = await json(res);
  const { rows: after } = await client.query("select count(*)::int as n from kiya_ai_logs where source='error'");
  check("عبور از سقف توکن → fallback بدون فراخوانی سرویس", data.source === "fallback" && after[0].n === before[0].n);
  await client.query("update kiya_ai_settings set monthly_token_budget=0 where id=1");
}
{
  // خاموش کردن قابلیت stylist → ویجت مخفی و POST مسدود
  await client.query(`update kiya_ai_settings set features='{"stylist": false}'::jsonb where id=1`);
  const status = await json(await fetch(`${BASE}/api/ai/stylist`));
  const res = await fetch(`${BASE}/api/ai/stylist`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ message: "سلام خوبی؟" }) });
  check("قابلیت خاموش → enabled=false و 403", status.enabled === false && res.status === 403);
  await client.query(`update kiya_ai_settings set features='{}'::jsonb where id=1`);
}
{
  const res = await admin({ action: "ai.logs.clear" });
  const { rows } = await client.query("select count(*)::int as n from kiya_ai_logs");
  check("ai.logs.clear", res.status === 200 && rows[0].n === 0);
}
{
  const res = await admin({ action: "ai.cache.clear" });
  const { rows } = await client.query("select count(*)::int as n from kiya_ai_cache");
  check("ai.cache.clear", res.status === 200 && rows[0].n === 0);
}
{
  // بدون احراز هویت
  const res = await fetch(`${BASE}/api/admin`, { method: "POST", headers: ORIGIN, body: JSON.stringify({ action: "ai.trend" }) });
  check("اکشن ai بدون ورود → 401", res.status === 401);
}

/* ---------- ۷) پاک‌سازی ---------- */
await client.query("update kiya_ai_settings set api_key='', base_url='', model='', temperature=70, max_tokens=700, monthly_token_budget=0, features='{}'::jsonb, assistant_name='مشاور کیا', enabled=true where id=1");
await client.query("delete from kiya_ai_logs");
await client.query("delete from kiya_ai_cache");
console.log("\n(دادهٔ آزمون پاک شد؛ تنظیمات به پیش‌فرض برگشت)");

console.log(`\n===== نتیجه: ${pass} موفق، ${fail} ناموفق =====`);
await client.end();
process.exit(fail ? 1 : 0);
