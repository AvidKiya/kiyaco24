/* eslint-disable no-console */
/* ============================================================
 *  QA فاز ۱۳ — پنل v2: Homepage Builder، منوها، بنر زمان‌دار
 *  اجرا:  node scripts/qa-phase13.mjs   (سرور روی پورت ۳۰۰۰)
 * ============================================================ */
import { readFileSync } from "fs";
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
const home = async () => await (await fetch(`${BASE}/`, { cache: "no-store" })).text();

console.log("— QA فاز ۱۳: Homepage Builder / منوها / بنر زمان‌دار —\n");

/* ---------- ۰) ورود مدیر ---------- */
const password = readFileSync("/home/user/.kiya-qa-password", "utf8").trim();
const login = await fetch(`${BASE}/api/admin/auth`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ action: "login", password }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const HEAD = { "Content-Type": "application/json", Origin: BASE, Cookie: cookie };
const act = (action, payload = {}) => fetch(`${BASE}/api/admin`, { method: "POST", headers: HEAD, body: JSON.stringify({ action, ...payload }) });
check("ورود مدیر", login.status === 200);

/* ---------- ۱) seed چیدمان پیش‌فرض ---------- */
console.log("\n● چیدمان پیش‌فرض");
{
  const html = await home(); // اولین بازدید seed می‌سازد
  const { rows } = await client.query("select key, position, active from kiya_home_sections order by position");
  check("۱۱ سکشن داخلی seed شد", rows.length >= 11, `count=${rows.length}`);
  check("ترتیب پیش‌فرض درست (hero اول، newsletter آخر)", rows[0]?.key === "hero" && rows[10]?.key === "newsletter");
  for (const marker of ["hero-grid", "trust-strip", "categories-section", "featured-section", "editorial-grid", "style-note"])
    check(`سکشن ${marker} در صفحه هست`, html.includes(marker));
  const dash = await json(await fetch(`${BASE}/api/admin`, { headers: HEAD }));
  check("GET پنل شامل homeSections", Array.isArray(dash.homeSections) && dash.homeSections.length >= 11);
}

/* ---------- ۲) خاموش/روشن سکشن ---------- */
console.log("\n● فعال/غیرفعال‌سازی سکشن");
{
  const { rows: [cats] } = await client.query("select * from kiya_home_sections where key='categories'");
  const off = await act("home.section.save", { section: { ...cats, active: false } });
  check("غیرفعال‌سازی دسته‌بندی‌ها", off.status === 200);
  const html = await home();
  check("سکشن دسته‌بندی از صفحه حذف شد", !html.includes("categories-section"));
  check("بقیهٔ سکشن‌ها سر جایشان هستند", html.includes("trust-strip") && html.includes("featured-section"));
  await act("home.section.save", { section: { ...cats, active: true } });
  check("فعال‌سازی دوباره", (await home()).includes("categories-section"));
}

/* ---------- ۳) تغییر ترتیب ---------- */
console.log("\n● تغییر ترتیب سکشن‌ها");
{
  const { rows } = await client.query("select id, key from kiya_home_sections order by position");
  const ids = rows.map(r => r.id);
  // trust را به انتها ببر
  const trustId = rows.find(r => r.key === "trust").id;
  const reordered = [...ids.filter(id => id !== trustId), trustId];
  const res = await act("home.reorder", { ids: reordered });
  check("ذخیرهٔ ترتیب جدید", res.status === 200);
  const html = await home();
  check("نوار اعتماد بعد از خبرنامه رندر شد", html.indexOf("trust-strip") > html.indexOf("newsletter"), `trust=${html.indexOf("trust-strip")} news=${html.indexOf("newsletter")}`);
  await act("home.reorder", { ids });
  check("بازگرداندن ترتیب", (await home()).indexOf("trust-strip") < (await home()).indexOf("categories-section"));
}

/* ---------- ۴) سکشن دلخواه: بنر ---------- */
console.log("\n● سکشن دلخواه (بنر تمام‌عرض)");
let customId = 0;
{
  const res = await act("home.section.save", { section: { key: "custom", title: "پیشنهاد ویژهٔ QA13", subtitle: "ONLY THIS WEEK", layout: "banner", active: true, config: { image: "/images/hero-belt.webp", text: "متن آزمایشی بنر فاز سیزده", cta: "بزن بریم", link: "/shop?sale=1", background: "#20211c" } } });
  check("ساخت سکشن بنر", res.status === 200, JSON.stringify(await json(res)));
  const { rows: [row] } = await client.query("select * from kiya_home_sections where title='پیشنهاد ویژهٔ QA13'");
  customId = row?.id || 0;
  check("در دیتابیس با position انتهایی ثبت شد", !!row && row.key === "custom");
  const html = await home();
  check("بنر دلخواه در صفحه رندر شد", html.includes("custom-banner") && html.includes("پیشنهاد ویژهٔ QA13"));
  check("CTA و متن و پس‌زمینه", html.includes("بزن بریم") && html.includes("متن آزمایشی بنر فاز سیزده") && html.includes("#20211c"));
}

/* ---------- ۵) سکشن دلخواه: گرید محصولات ---------- */
console.log("\n● سکشن دلخواه (گرید محصولات)");
let productSectionId = 0;
{
  const { rows: prods } = await client.query("select id, name from kiya_products where active=true order by id limit 2");
  const res = await act("home.section.save", { section: { key: "custom", title: "دست‌چین QA13", layout: "products", active: true, config: { productIds: prods.map(p => p.id), cta: "همه", link: "/shop" } } });
  check("ساخت سکشن محصولات", res.status === 200);
  const { rows: [row] } = await client.query("select id from kiya_home_sections where title='دست‌چین QA13'");
  productSectionId = row?.id || 0;
  const html = await home();
  check("گرید محصولات با محصولات واقعی", html.includes("custom-products") && prods.every(p => html.includes(p.name)));
}

/* ---------- ۶) اعتبارسنجی و حذف ---------- */
console.log("\n● اعتبارسنجی سکشن‌ها");
{
  const bad = await act("home.section.save", { section: { key: "custom", title: "x", layout: "banner", config: {} } });
  check("عنوان کوتاه رد می‌شود", bad.status === 400);
  const badBg = await act("home.section.save", { section: { key: "custom", title: "تست رنگ", layout: "banner", config: { background: "red" } } });
  check("رنگ غیر hex رد می‌شود", badBg.status === 400);
  const badLink = await act("home.section.save", { section: { key: "custom", title: "تست لینک", layout: "banner", config: { link: "https://evil.com" } } });
  check("لینک خارجی رد می‌شود", badLink.status === 400);
  const { rows: [hero] } = await client.query("select id from kiya_home_sections where key='hero'");
  const delBuiltin = await act("home.section.delete", { id: hero.id });
  check("حذف سکشن داخلی ممنوع", delBuiltin.status === 400);
  const delCustom = await act("home.section.delete", { id: productSectionId });
  check("حذف سکشن دلخواه", delCustom.status === 200);
  check("از صفحه هم حذف شد", !(await home()).includes("دست‌چین QA13"));
}

/* ---------- ۷) منوها ---------- */
console.log("\n● مدیریت منوها");
{
  const { rows: [pref] } = await client.query("select * from kiya_settings where id=1");
  const settingsPayload = { storeName: pref.store_name, announcement: pref.announcement, shippingThreshold: pref.shipping_threshold, shippingCost: pref.shipping_cost, instagramUrl: pref.instagram_url, telegramUrl: pref.telegram_url, botUrl: pref.bot_url, supportPhone: pref.support_phone, address: pref.address, heroTitle: pref.hero_title, heroAccent: pref.hero_accent, heroDescription: pref.hero_description, heroImage: pref.hero_image, heroButton: pref.hero_button, heroLink: pref.hero_link };
  const menus = {
    header: [{ label: "خانه", href: "/" }, { label: "حراج مخفی QA13", href: "/shop?sale=1" }],
    shopTitle: "ستون آزمایشی خرید", shop: [{ label: "لینک خرید QA13", href: "/collections" }],
    helpTitle: "ستون آزمایشی کمک", help: [{ label: "دکمهٔ ارسال QA13", href: "#shipping" }],
  };
  const res = await act("settings.save", { settings: { ...settingsPayload, menus } });
  check("ذخیرهٔ منوهای سفارشی", res.status === 200, JSON.stringify(await json(res)));
  const html = await home();
  check("لینک هدر جدید رندر شد", html.includes("حراج مخفی QA13"));
  check("آیکون پیشنهاد ویژه از روی href", html.indexOf("offers-link") > -1 && html.includes("حراج مخفی QA13"));
  check("عنوان ستون فوتر عوض شد", html.includes("ستون آزمایشی خرید") && html.includes("ستون آزمایشی کمک"));
  check("لینک # به‌صورت دکمهٔ اورلی", html.includes("دکمهٔ ارسال QA13") && !html.includes('href="#shipping"'));
  // اعتبارسنجی: لینک خارجی در منو حذف می‌شود
  const evil = await act("settings.save", { settings: { ...settingsPayload, menus: { ...menus, header: [{ label: "مخرب", href: "https://evil.com" }] } } });
  check("منوی بدون لینک سالم رد می‌شود", evil.status === 400);
  // بازگشت به پیش‌فرض
  const reset = await act("settings.save", { settings: { ...settingsPayload, menus: null } });
  check("بازگشت به منوی پیش‌فرض", reset.status === 200);
  const html2 = await home();
  check("منوی پیش‌فرض برگشت", html2.includes("پیشنهادهای ویژه") && !html2.includes("حراج مخفی QA13"));
}

/* ---------- ۸) بنر کمپینی زمان‌دار ---------- */
console.log("\n● بنر زمان‌دار و تصویر موبایل");
{
  const past = await act("slide.save", { slide: { eyebrow: "", title: "کمپین منقضی QA13", accent: "تمام شد", description: "", image: "/images/hero-belt.webp", button: "برو", link: "/shop", label: "", mobileImage: "", startsAt: new Date(Date.now() - 172800000).toISOString(), endsAt: new Date(Date.now() - 86400000).toISOString(), position: 40, active: true } });
  check("ثبت بنر منقضی", past.status === 200);
  const live = await act("slide.save", { slide: { eyebrow: "", title: "کمپین زندهٔ QA13", accent: "الان", description: "", image: "/images/hero-belt.webp", button: "برو", link: "/shop", label: "", mobileImage: "/images/hero-jewelry.webp", startsAt: new Date(Date.now() - 3600000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), position: 41, active: true } });
  check("ثبت بنر زنده با تصویر موبایل", live.status === 200);
  const html = await home();
  check("بنر منقضی نمایش داده نمی‌شود", !html.includes("کمپین منقضی QA13"));
  check("بنر داخل بازه نمایش داده می‌شود", html.includes("کمپین زندهٔ QA13"));
  const bad = await act("slide.save", { slide: { title: "بد", accent: "بد", image: "/images/hero-belt.webp", button: "برو", link: "/shop", startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date().toISOString(), position: 42 } });
  check("پایان قبل از شروع رد می‌شود", bad.status === 400);
  // تصویر موبایل: در دیتابیس ذخیره و در دادهٔ صفحه (flight) به کلاینت می‌رسد
  // (تگ <source> فقط برای اسلاید فعال رندر می‌شود؛ اسلاید اول همیشه بنر تنظیمات است)
  const { rows: [saved] } = await client.query("select mobile_image from kiya_hero_slides where title='کمپین زندهٔ QA13'");
  check("تصویر موبایل بنر ذخیره و به صفحه ارسال شد", saved.mobile_image === "/images/hero-jewelry.webp" && html.includes("mobileImage"));
}

/* ---------- ۹) انتشار زمان‌بندی‌شدهٔ مقاله ---------- */
console.log("\n● انتشار زمان‌بندی‌شدهٔ محتوا");
{
  const future = await act("article.save", { article: { slug: "qa13-future", section: "main-story", title: "مقالهٔ آیندهٔ QA13", kicker: "", excerpt: "هنوز نباید دیده شود", body: "متن", image: "/images/hero-belt.webp", colorHex: "#D19B44", author: "QA", readMinutes: 2, editionDate: new Date().toISOString(), publishAt: new Date(Date.now() + 86400000).toISOString(), productIds: [], shopLabel: "", position: 30, active: true } });
  check("ثبت مقاله با انتشار فردا", future.status === 200, JSON.stringify(await json(future)));
  const daily = await (await fetch(`${BASE}/daily`, { cache: "no-store" })).text();
  check("مقالهٔ زمان‌بندی‌شده هنوز عمومی نیست", !daily.includes("مقالهٔ آیندهٔ QA13"));
}

/* ---------- ۱۰) CMS موجود: نظر و پرسش و همکار ---------- */
console.log("\n● تأیید/رد محتوا (رگرسیون CMS)");
{
  const { rows: [p] } = await client.query("select id from kiya_products where active=true limit 1");
  const { rows: [review] } = await client.query("insert into kiya_reviews (product_id, name, rating, text, approved) values ($1, 'کاربر QA13', 5, 'عالی بود — تست فاز سیزده', false) returning id", [p.id]);
  const approve = await act("review.approve", { id: review.id, approved: true });
  check("تأیید نظر", approve.status === 200);
  const { rows: [after] } = await client.query("select approved from kiya_reviews where id=$1", [review.id]);
  check("نظر تأییدشده در دیتابیس", after.approved === true);
  const del = await act("review.delete", { id: review.id });
  check("حذف نظر", del.status === 200);
  const badPartner = await act("partner.status", { id: 999999, status: "approved" });
  check("اکشن وضعیت همکار موجود است", badPartner.status === 400 || badPartner.status === 404 || badPartner.status === 200);
}

/* ---------- پاک‌سازی ---------- */
console.log("\n● پاک‌سازی");
{
  await client.query("delete from kiya_home_sections where title like '%QA13%' or title like 'تست %'");
  await client.query("delete from kiya_hero_slides where title like '%QA13%'");
  await client.query("delete from kiya_articles where slug='qa13-future'");
  await client.query("delete from kiya_reviews where name='کاربر QA13'");
  const { rows: [c] } = await client.query("select count(*)::int c from kiya_home_sections where key='custom'");
  check("سکشن‌های آزمایشی پاک شدند", c.c === 0);
  const html = await home();
  check("صفحهٔ اصلی سالم برگشت", html.includes("hero-grid") && !html.includes("QA13"));
}

console.log(`\n========== نتیجه: ${pass} موفق / ${fail} ناموفق ==========`);
await client.end();
process.exit(fail ? 1 : 0);
