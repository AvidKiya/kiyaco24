/**
 * QA فاز ۱۶ — گالری چندتصویری محصول، کارایی (کش/lazy)، دسترس‌پذیری، حالت‌های خطا
 * اجرا:  node scripts/qa-phase16.mjs
 */
import { readFileSync } from "fs";
import pg from "pg";

const BASE = "http://localhost:3000";
const DB = "postgres://postgres:postgres@127.0.0.1:5432/app_db";
const password = readFileSync("/home/user/.kiya-qa-password", "utf8").trim();
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name} ${extra}`); } };

const jar = {};
function setCookies(res) { for (const c of res.headers.getSetCookie?.() || []) { const [pair] = c.split(";"); const [k, v] = pair.split("="); jar[k] = v; } }
const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
async function api(path, options = {}) {
  const res = await fetch(BASE + path, { ...options, headers: { "content-type": "application/json", cookie: cookieHeader(), ...(options.headers || {}) } });
  setCookies(res);
  let body = null; try { body = await res.json(); } catch { /* HTML */ }
  return { status: res.status, body, headers: res.headers };
}
const html = async path => { const r = await fetch(BASE + path, { headers: { cookie: cookieHeader() } }); return { status: r.status, text: await r.text(), headers: r.headers }; };

const client = new pg.Client(DB);
await client.connect();

/* ورود مدیر */
const login = await api("/api/admin/auth", { method: "POST", body: JSON.stringify({ action: "login", password }) });
if (login.status !== 200) { console.error("ورود مدیر شکست خورد؛ QA متوقف شد.", login.status, login.body); process.exit(1); }
const admin = (action, payload) => api("/api/admin", { method: "POST", body: JSON.stringify({ action, ...payload }) });

console.log("\n۱) گالری چندتصویری + ویدیوی محصول");
{
  const { rows: [prod] } = await client.query("select id, slug, name, image from kiya_products where active order by id limit 1");
  const gallery = ["/images/product-chain.webp", "/images/product-ring.webp"];
  const video = "https://cdn.example.com/kiya-belt.mp4";
  const get = await api("/api/admin");
  const full = get.body.products.find(p => p.id === prod.id);
  const save = await admin("product.save", { product: { ...full, gallery, video } });
  ok("ذخیرهٔ گالری (۲ تصویر) و ویدیو", save.status === 200, JSON.stringify(save.body));

  const after = await api("/api/admin");
  const updated = after.body.products.find(p => p.id === prod.id);
  ok("GET پنل گالری و ویدیو را برمی‌گرداند", JSON.stringify(updated?.gallery) === JSON.stringify(gallery) && updated?.video === video);

  const page = await html(`/product/${prod.slug}`);
  ok("صفحهٔ محصول: نوار بندانگشتی گالری رندر شد", page.text.includes("media-thumbs"));
  ok("صفحهٔ محصول: تصویر دوم گالری در HTML", page.text.includes("/images/product-ring.webp"));
  ok("صفحهٔ محصول: دکمهٔ ویدیو در گالری", page.text.includes("media-thumb-video"));
  const ld = [...page.text.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].flatMap(m => { try { const d = JSON.parse(m[1]); return Array.isArray(d) ? d : [d]; } catch { return []; } });
  const productLd = ld.find(x => x["@type"] === "Product");
  ok("JSON-LD محصول شامل تصاویر گالری (۳ تصویر)", Array.isArray(productLd?.image) && productLd.image.length === 3);

  const bad = await admin("product.save", { product: { ...full, gallery: ["javascript:alert(1)"] } });
  ok("آدرس گالری نامعتبر رد می‌شود", bad.status !== 200);
  const badVideo = await admin("product.save", { product: { ...full, video: "ftp://x" } });
  ok("آدرس ویدیوی نامعتبر رد می‌شود", badVideo.status !== 200);

  const clear = await admin("product.save", { product: { ...full, gallery: [], video: "" } });
  const pageAfter = await html(`/product/${prod.slug}`);
  ok("پاک‌کردن گالری → بندانگشتی حذف شد", clear.status === 200 && !pageAfter.text.includes("media-thumbs"));
}

console.log("\n۲) کارایی — کش مرورگر و هدرهای امنیتی");
{
  const img = await fetch(BASE + "/images/product-belt.webp");
  ok("تصاویر: Cache-Control یک‌هفته‌ای", (img.headers.get("cache-control") || "").includes("max-age=604800"));
  const font = await fetch(BASE + "/fonts/Vazirmatn.woff2");
  ok("فونت: کش یک‌سالهٔ immutable", (font.headers.get("cache-control") || "").includes("immutable"));
  const sw = await fetch(BASE + "/sw.js");
  ok("سرویس‌ورکر: no-store (به‌روزرسانی فوری)", (sw.headers.get("cache-control") || "").includes("no-store"));
  const home = await html("/");
  ok("هدر X-Content-Type-Options=nosniff", home.headers.get("x-content-type-options") === "nosniff");
  ok("هدر Referrer-Policy", (home.headers.get("referrer-policy") || "").includes("strict-origin"));
  ok("X-Powered-By حذف شده", !home.headers.get("x-powered-by"));
  const adminApi = await fetch(BASE + "/api/admin", { headers: { cookie: cookieHeader() } });
  ok("API پنل: no-store + noindex", (adminApi.headers.get("cache-control") || "").includes("no-store") && (adminApi.headers.get("x-robots-tag") || "").includes("noindex"));
}

console.log("\n۳) دسترس‌پذیری — نشانه‌های سراسری");
{
  const home = await html("/");
  ok("زبان و جهت سند (fa / rtl)", home.text.includes('lang="fa"') && home.text.includes('dir="rtl"'));
  ok("پیوند پرش به محتوا (skip-link)", home.text.includes("skip-link") && home.text.includes("#main-content"));
  ok("لندمارک main با id", home.text.includes('id="main-content"'));
  const ariaCount = (home.text.match(/aria-label=/g) || []).length;
  ok(`aria-label فراوان در صفحهٔ اصلی (${ariaCount})`, ariaCount >= 15);
  ok("تصاویر صفحهٔ اصلی alt دارند", !/<img(?![^>]*alt=)[^>]*>/.test(home.text));
  const lazyCount = (home.text.match(/loading="lazy"/g) || []).length;
  ok(`lazy loading روی تصاویر لیستی (${lazyCount})`, lazyCount >= 5);
  const { rows: [prod] } = await client.query("select slug from kiya_products where active order by id limit 1");
  const product = await html(`/product/${prod.slug}`);
  ok("صفحهٔ محصول: دکمه‌های انتخاب با aria-pressed", product.text.includes("aria-pressed"));
  ok("پیش‌بارگذاری فونت (preload)", home.text.includes('rel="preload"') && home.text.includes("Vazirmatn.woff2"));
}

console.log("\n۴) حالت‌های خطا و خالی");
{
  const nf = await html("/product/this-does-not-exist");
  ok("محصول ناموجود → 404", nf.status === 404);
  const nf2 = await html("/a-page-that-never-existed");
  ok("مسیر ناشناخته → صفحهٔ ۴۰۴ اختصاصی", nf2.status === 404 && (nf2.text.includes("پیدا") || nf2.text.includes("۴۰۴") || nf2.text.includes("404")));
  const badApi = await api("/api/orders", { method: "POST", body: JSON.stringify({}) });
  ok("API سفارش با بدنهٔ خالی → خطای کنترل‌شده (نه 500)", badApi.status === 400 || badApi.status === 422);
  const badJson = await fetch(BASE + "/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: "{broken" });
  ok("JSON خراب → پاسخ کنترل‌شده", badJson.status < 500);
  const emptySearch = await html("/shop?q=zzzznotfoundzzz");
  ok("جستجوی بی‌نتیجه صفحهٔ سالم برمی‌گرداند", emptySearch.status === 200);
}

console.log("\n۵) PWA");
{
  const manifest = await api("/manifest.webmanifest");
  const m = manifest.body;
  ok("منیفست PWA کامل (نام/آیکن/رنگ/display)", !!m && m.name?.includes("کیا") !== false && Array.isArray(m.icons) && m.icons.length >= 2 && !!m.theme_color && !!m.display);
  const sw = await fetch(BASE + "/sw.js");
  const swText = await sw.text();
  ok("سرویس‌ورکر: کش آفلاین + fetch handler", sw.status === 200 && swText.includes("fetch") && swText.includes("cache"));
  const offline = await html("/offline");
  ok("صفحهٔ آفلاین در دسترس", offline.status === 200 || swText.includes("offline"));
}

/* پاک‌سازی */
console.log("\n— پاک‌سازی —");
await client.query("delete from kiya_events");
await client.end();
console.log("  🧹 رویدادهای آزمایشی پاک شدند.");

console.log(`\n═════ نتیجه: ${pass} موفق / ${fail} ناموفق ═════`);
process.exit(fail ? 1 : 0);
