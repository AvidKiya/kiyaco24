/* eslint-disable no-console */
/* ============================================================
 *  QA فاز ۱۵ — سئو (متادیتا/JSON-LD/سایت‌مپ)، آنالیتیکس و BI
 *  اجرا:  node scripts/qa-phase15.mjs   (سرور روی پورت ۳۰۰۰)
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
  let data = null; try { data = await response.json(); } catch { /* html */ }
  return { status: response.status, data, headers: response.headers };
}
const html = async path => await (await fetch(BASE + path, { cache: "no-store" })).text();
const jsonLdOf = page => [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap(m => { try { const d = JSON.parse(m[1]); return Array.isArray(d) ? d : [d]; } catch { return []; } });

console.log("— QA فاز ۱۵: سئو / آنالیتیکس / BI —");

/* ---------- ۱) ورود مدیر ---------- */
console.log("\n۱) ورود مدیر و سئوی سراسری");
const password = process.env.KIYA_QA_PASSWORD || readFileSync("/home/user/.kiya-qa-password", "utf8").trim();
const login = await api("/api/admin/auth", { method: "POST", body: JSON.stringify({ action: "login", password }) });
const AC = (login.headers.getSetCookie?.() || []).map(c => c.split(";")[0]).join("; ");
check("ورود مدیر", login.status === 200);
const act = (action, payload = {}) => api("/api/admin", { method: "POST", body: JSON.stringify({ action, ...payload }) }, AC);
const dash = () => api("/api/admin", {}, AC).then(r => r.data);
let d = await dash();

{
  const save = await act("settings.save", { settings: { ...d.settings, seo: { metaTitle: "کیا اکسسوری | تست سئو", metaDescription: "توضیح آزمایشی سئو برای QA فاز پانزده.", ogImage: "/images/hero-belt.webp", googleVerification: "QA15-token-123" } } });
  check("ذخیرهٔ سئوی سراسری", save.status === 200);
  const home = await html("/");
  check("عنوان سفارشی در تگ title", home.includes("<title>کیا اکسسوری | تست سئو</title>"));
  check("توضیح متا اعمال شد", home.includes("توضیح آزمایشی سئو برای QA فاز پانزده."));
  check("کد تأیید گوگل در متا", home.includes('name="google-site-verification" content="QA15-token-123"'));
  const graphs = jsonLdOf(home);
  const org = graphs.find(g => g["@type"] === "Organization");
  const site = graphs.find(g => g["@type"] === "WebSite");
  check("اسکیمای Organization", !!org && org.name?.length > 0, JSON.stringify(org || {}));
  check("اسکیمای WebSite با SearchAction", site?.potentialAction?.["@type"] === "SearchAction" && site.potentialAction.target.urlTemplate.includes("/shop?q="));
}

/* ---------- ۲) سئوی محصول + JSON-LD ---------- */
console.log("\n۲) سئوی محصول و اسکیمای Product");
const product = d.products.find(p => p.active && p.stock > 2);
{
  const page = await html(`/product/${product.slug}`);
  check("عنوان پیش‌فرض «خرید ... | کیا اکسسوری»", page.includes(`<title>خرید ${product.name} | کیا اکسسوری</title>`));
  check("لینک canonical", page.includes(`<link rel="canonical" href="http://localhost:3000/product/${product.slug}"`));
  check("og:image آدرس کامل", /property="og:image" content="http:\/\/localhost:3000\//.test(page));
  const graphs = jsonLdOf(page);
  const schema = graphs.find(g => g["@type"] === "Product");
  check("اسکیمای Product موجود", !!schema);
  check("قیمت به ریال (تومان×۱۰) و IRR", schema?.offers?.price === product.price * 10 && schema?.offers?.priceCurrency === "IRR", `price=${schema?.offers?.price}`);
  check("موجودی InStock", schema?.offers?.availability === "https://schema.org/InStock");
  const crumbs = graphs.find(g => g["@type"] === "BreadcrumbList");
  check("اسکیمای Breadcrumb با ۴ سطح", crumbs?.itemListElement?.length === 4 && crumbs.itemListElement[3].name === product.name);

  const save = await act("product.save", { product: { ...product, seo: { title: "عنوان سئوی آزمایشی کمربند", description: "توضیح متای آزمایشی محصول برای QA." } } });
  check("ذخیرهٔ بازنویسی سئو محصول", save.status === 200);
  const page2 = await html(`/product/${product.slug}`);
  check("عنوان سفارشی محصول اعمال شد", page2.includes("<title>عنوان سئوی آزمایشی کمربند</title>"));
  check("توضیح متای سفارشی اعمال شد", page2.includes("توضیح متای آزمایشی محصول برای QA."));
  await act("product.save", { product: { ...product, seo: null } });
  check("حذف بازنویسی → عنوان خودکار برگشت", (await html(`/product/${product.slug}`)).includes(`<title>خرید ${product.name} |`));
}

/* ---------- ۳) اسکیمای مقاله ---------- */
console.log("\n۳) اسکیمای Article در Fashion Daily");
let articleId = 0;
{
  const save = await act("article.save", { article: { title: "مقالهٔ آزمایشی سئو کیو‌ای", section: "fashion-news", excerpt: "خلاصهٔ آزمایشی مقاله برای QA فاز پانزده.", body: "متن آزمایشی مقاله.", editionDate: new Date().toISOString(), publishAt: new Date(Date.now() - 3600000).toISOString(), image: "/images/hero-belt.webp", productIds: [], colorHex: "#D19B44", readMinutes: 3, position: 0, active: true } });
  check("ساخت مقالهٔ آزمایشی", save.status === 200, JSON.stringify(save.data));
  const d2 = await dash();
  const article = d2.articles.find(a => a.title === "مقالهٔ آزمایشی سئو کیو‌ای");
  articleId = article?.id || 0;
  const page = await html(`/daily/${article.slug}`);
  const schema = jsonLdOf(page).find(g => g["@type"] === "Article");
  check("اسکیمای Article موجود", !!schema && schema.headline.includes("مقالهٔ آزمایشی"), JSON.stringify(schema || {}).slice(0, 120));
  check("ناشر KIYA و تاریخ انتشار", schema?.publisher?.name === "KIYA" && !!schema?.datePublished);
  check("canonical مقاله", page.includes(`<link rel="canonical" href="http://localhost:3000/daily/${article.slug}"`));
}

/* ---------- ۴) سایت‌مپ و robots ---------- */
console.log("\n۴) سایت‌مپ و robots");
{
  const sitemap = await html("/sitemap.xml");
  check("سایت‌مپ شامل صفحهٔ محصول", sitemap.includes(`/product/${product.slug}`));
  check("سایت‌مپ شامل فروشگاه و مجله", sitemap.includes("/shop") && sitemap.includes("/daily"));
  const robots = await html("/robots.txt");
  check("robots مسیرهای خصوصی را می‌بندد", robots.includes("/admin") && robots.includes("/api/"));
}

/* ---------- ۵) آنالیتیکس ---------- */
console.log("\n۵) رویدادهای آنالیتیکس");
const phone = "0912" + String(Math.floor(1000000 + Math.random() * 8999999));
let orderCode = "";
{
  const before = (await client.query("select count(*)::int c from kiya_events")).rows[0].c;
  for (const [type, ref] of [["view_product", product.slug], ["view_product", product.slug], ["add_to_cart", product.slug], ["begin_checkout", ""], ["search", "کمربند چرم"], ["search", "کمربند چرم"], ["wishlist", "1"]]) {
    await api("/api/analytics", { method: "POST", body: JSON.stringify({ type, ref }) });
  }
  const after = (await client.query("select count(*)::int c from kiya_events")).rows[0].c;
  check("۷ رویداد ثبت شد", after - before === 7, `diff=${after - before}`);
  check("نوع نامعتبر رد می‌شود", (await api("/api/analytics", { method: "POST", body: JSON.stringify({ type: "hack" }) })).status === 400);
  check("purchase از مرورگر قابل ثبت نیست", (await api("/api/analytics", { method: "POST", body: JSON.stringify({ type: "purchase", ref: "K-FAKE", value: 999 }) })).status === 400);

  const order = await api("/api/orders", { method: "POST", body: JSON.stringify({ name: "کیو ای فاز پانزده", phone, city: "تهران", postalCode: "1234567890", address: "خیابان آزمایش، پلاک ۱۵", delivery: "shipping", requestKey: crypto.randomUUID(), items: [{ productId: product.id, quantity: 1, size: product.sizes[0] || "استاندارد", color: product.colors[0]?.name || "پیش‌فرض" }] }) });
  orderCode = order.data?.code || "";
  check("ثبت سفارش", !!orderCode);
  const { rows: [pe] } = await client.query("select value from kiya_events where type='purchase' and ref=$1", [orderCode]);
  check("رویداد purchase سمت سرور با مبلغ سفارش", Number(pe?.value) === order.data.total, `value=${pe?.value}`);
}

/* ---------- ۶) داشبورد BI ---------- */
console.log("\n۶) داشبورد BI در پنل");
{
  const row = (await dash()).orders.find(o => o.code === orderCode);
  await act("order.update", { id: row.id, status: "confirmed", paymentStatus: "paid", trackingNumber: "" });
  d = await dash();
  const bi = d.bi;
  check("GET پنل شامل bi", !!bi && !!bi.totals);
  check("درآمد شامل سفارش پرداخت‌شده", bi.totals.revenue >= row.total, `revenue=${bi.totals.revenue}`);
  check("AOV محاسبه شد", bi.totals.aov > 0);
  check("نمودار درآمد روزانه داده دارد", bi.revenueByDay.length >= 1 && bi.revenueByDay.some(x => x.revenue >= row.total));
  const funnelMap = Object.fromEntries(bi.funnel.map(f => [f.key, f.count]));
  check("قیف: بازدید/سبد/پرداخت/خرید شمارش شد", funnelMap.view_product >= 2 && funnelMap.add_to_cart >= 1 && funnelMap.begin_checkout >= 1 && funnelMap.purchase >= 1, JSON.stringify(funnelMap));
  check("نرخ تبدیل عددی است", typeof bi.totals.conversion === "number" && bi.totals.conversion > 0);
  check("پرفروش‌ها شامل محصول سفارش", bi.topSold.some(p => p.name === product.name));
  check("کم‌فروش‌ها لیست شد", Array.isArray(bi.lowSold) && bi.lowSold.length > 0);
  check("پربازدیدها شامل محصول", bi.topViewed.some(v => v.ref === product.slug && v.views >= 2));
  check("جستجوی پرتکرار با شمارش", bi.topSearches.some(s => s.term === "کمربند چرم" && s.count >= 2));
  check("فروش عمده گزارش می‌شود", typeof bi.totals.wholesaleRevenue === "number");
}

/* ---------- پاک‌سازی ---------- */
console.log("\n— پاک‌سازی داده‌های QA —");
{
  if (articleId) await act("article.delete", { id: articleId });
  const { rows: [o] } = await client.query("select items, status from kiya_orders where code=$1", [orderCode]);
  if (o && o.status !== "cancelled") for (const line of o.items) await client.query("update kiya_products set stock = stock + $1 where id = $2", [line.quantity, line.productId]);
  await client.query("delete from kiya_orders where code=$1", [orderCode]);
  await client.query("delete from kiya_outbox where recipient=$1", [phone]);
  await client.query("delete from kiya_events");
  await client.query("update kiya_settings set seo=null where id=1");
  console.log("  🧹 رویدادها، سفارش، مقاله و تنظیمات سئوی آزمایشی پاک شدند.");
}

console.log(`\n═════ نتیجه: ${passed} موفق / ${failed} ناموفق ═════`);
if (failures.length) console.log("موارد ناموفق: " + failures.join(" | "));
await client.end();
process.exit(failed ? 1 : 0);
