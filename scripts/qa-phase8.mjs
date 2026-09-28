import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const base = 'http://localhost:3000';
const results = [];
const pass = t => { results.push(1); console.log('PASS:', t); };
const fail = t => { results.push(0); console.log('FAIL:', t); };

let password = process.env.QA_ADMIN_PASSWORD;
if (!password) { try { password = await readFile('/home/user/.kiya-qa-password', 'utf8'); } catch { password = randomBytes(12).toString('base64url'); } }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ baseURL: base, viewport: { width: 1280, height: 800 } });
let page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const db = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/app_db' });
await db.connect();

const guideSlug = 'qa-guide-' + randomBytes(4).toString('hex');
const collectionSlug = 'qa-collection-' + randomBytes(4).toString('hex');
let guideId = 0, collectionId = 0, orderCode = '';

const localInput = (date) => {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

try {
  /* ---------- ۱) صفحهٔ ترندینگ ---------- */
  await page.goto('/trending', { waitUntil: 'networkidle' });
  await page.waitForSelector('.trending-page', { timeout: 10000 }).then(() => pass('صفحهٔ ترندینگ باز می‌شود')).catch(() => fail('صفحهٔ ترندینگ باز نشد'));
  (await page.locator('.page-hero h1').textContent() || '').includes('ترند') ? pass('تیتر صفحهٔ ترندینگ درست است') : fail('تیتر صفحهٔ ترندینگ اشتباه است');
  const tabs = await page.locator('.trending-tabs button').count();
  (tabs >= 4 ? pass : fail)(`ترندهای مدیریت‌شده در صفحه نمایش داده می‌شوند (${tabs} ترند)`);
  (await page.locator('.trending-grid .trending-card').count() >= 4 ? pass : fail)('همهٔ ترندها در پایین صفحه فهرست می‌شوند');

  // تغییر تب ترند
  await page.locator('.trending-tabs button').nth(1).click();
  await page.waitForTimeout(500);
  const detailTitle = (await page.locator('.trending-detail-head h2').textContent() || '').trim();
  const activeTab = (await page.locator('.trending-tabs button.active').textContent() || '').trim().replace(/^[۰-۹\d]+/, '').trim();
  (detailTitle.includes(activeTab) ? pass : fail)(`انتخاب ترند، محصولات همان ترند را نشان می‌دهد: ${activeTab}`);
  (await page.locator('.trending-detail .product-card').count() >= 1 ? pass : fail)(`محصولات ترند انتخاب‌شده رندر می‌شوند (${await page.locator('.trending-detail .product-card').count()} محصول)`);

  /* ---------- ۲) فهرست راهنما ---------- */
  await page.goto('/guide', { waitUntil: 'networkidle' });
  await page.waitForSelector('.guide-page', { timeout: 10000 }).then(() => pass('صفحهٔ راهنمای استایل باز می‌شود')).catch(() => fail('صفحهٔ راهنما باز نشد'));
  (await page.locator('.guide-card').count() >= 6 ? pass : fail)(`راهنماهای استایل رندر می‌شوند (${await page.locator('.guide-card').count()} راهنما)`);
  const topicButtons = await page.locator('.guide-topics button').count();
  (topicButtons >= 4 ? pass : fail)(`فیلتر موضوعات راهنما موجود است (${topicButtons} موضوع)`);

  await page.locator('.guide-topics button', { hasText: 'اندازه و سایز' }).click();
  await page.waitForTimeout(500);
  const filteredGuides = await page.locator('.guide-card').count();
  (filteredGuides >= 1 && filteredGuides < 6 ? pass : fail)(`فیلتر موضوع «اندازه و سایز» درست کار می‌کند (${filteredGuides} راهنما)`);
  await page.locator('.guide-topics button', { hasText: 'همهٔ راهنماها' }).click();
  await page.waitForTimeout(400);

  /* ---------- ۳) صفحهٔ راهنما + HowTo ---------- */
  await page.goto('/guide/belt-size-guide', { waitUntil: 'networkidle' });
  await page.waitForSelector('.guide-view', { timeout: 10000 }).then(() => pass('صفحهٔ راهنمای سایز کمربند باز می‌شود')).catch(() => fail('صفحهٔ راهنما باز نشد'));
  (await page.locator('.guide-breadcrumb a[href="/guide"]').count() >= 1 ? pass : fail)('مسیر صفحه (breadcrumb) راهنما درست است');
  const stepNumbers = await page.locator('.guide-step-number').count();
  (stepNumbers >= 3 ? pass : fail)(`مراحل راهنما شماره‌گذاری شده‌اند (${stepNumbers} مرحله)`);
  (await page.locator('.guide-view-list li').count() >= 3 ? pass : fail)('لیست نکات در متن راهنما رندر می‌شود');
  (await page.locator('.guide-view-quote').count() >= 1 ? pass : fail)('نکتهٔ برجسته در راهنما رندر می‌شود');
  (await page.locator('.guide-view-content .guide-product-card').count() >= 1 ? pass : fail)('کارت محصول داخل راهنما رندر می‌شود');
  (await page.locator('.guide-view-shop .guide-product-card').count() >= 1 ? pass : fail)('بخش SHOP THE GUIDE پایین راهنما رندر می‌شود');
  (await page.locator('.guide-view-related .guide-related-item').count() >= 1 ? pass : fail)('راهنماهای مرتبط در سایدبار نمایش داده می‌شوند');

  // دادهٔ ساخت‌یافته HowTo
  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent().catch(() => '');
  let howToOk = false;
  try { const parsed = JSON.parse(jsonLd); howToOk = parsed['@type'] === 'HowTo' && Array.isArray(parsed.step) && parsed.step.length >= 3; } catch {}
  (howToOk ? pass : fail)(`دادهٔ ساخت‌یافته HowTo برای سئو ثبت شده (${(() => { try { return JSON.parse(jsonLd).step.length; } catch { return 0; } })()} مرحله)`);

  // افزودن به سبد از راهنما
  await page.locator('.guide-view-content .guide-product-card').first().getByRole('button', { name: /افزودن به سبد/ }).click();
  await page.waitForTimeout(1200);
  const cartCount = await page.evaluate(() => JSON.parse(localStorage.getItem('kiya-cart') || '[]').length);
  (cartCount >= 1 ? pass : fail)(`محصول از داخل راهنما به سبد اضافه شد (${cartCount} قلم)`);

  /* ---------- ۴) کالکشن‌ها ---------- */
  await page.goto('/collections', { waitUntil: 'networkidle' });
  await page.waitForSelector('.collections-page', { timeout: 10000 }).then(() => pass('صفحهٔ کالکشن‌ها باز می‌شود')).catch(() => fail('صفحهٔ کالکشن‌ها باز نشد'));
  (await page.locator('.collection-card').count() >= 7 ? pass : fail)(`کالکشن‌ها رندر می‌شوند (${await page.locator('.collection-card').count()} کالکشن)`);
  (await page.locator('.collection-card.wide').count() >= 1 ? pass : fail)('کالکشن‌های ویژه بزرگ نمایش داده می‌شوند');

  await page.goto('/collections/autumn-warm', { waitUntil: 'networkidle' });
  await page.waitForSelector('.collection-page', { timeout: 10000 }).then(() => pass('لندینگ کالکشن باز می‌شود')).catch(() => fail('لندینگ کالکشن باز نشد'));
  (await page.locator('.collection-hero h1').textContent() || '').includes('پاییز') ? pass('تیتر لندینگ کالکشن درست است') : fail('تیتر لندینگ کالکشن اشتباه است');
  (await page.locator('.collection-hero-stats span').count() >= 2 ? pass : fail)('آمار کالکشن (تعداد محصول و شروع قیمت) نمایش داده می‌شود');
  (await page.locator('.collection-products .product-card').count() >= 2 ? pass : fail)(`محصولات کالکشن رندر می‌شوند (${await page.locator('.collection-products .product-card').count()} محصول)`);
  (await page.locator('.collection-related .collection-card').count() >= 1 ? pass : fail)('کالکشن‌های مرتبط نمایش داده می‌شوند');
  (await page.locator('.guide-breadcrumb a[href="/collections"]').count() >= 1 ? pass : fail)('مسیر صفحهٔ کالکشن درست است');

  const collectionJsonLd = await page.locator('script[type="application/ld+json"]').textContent().catch(() => '');
  let collectionOk = false;
  try { const parsed = JSON.parse(collectionJsonLd); collectionOk = parsed['@type'] === 'CollectionPage' && parsed.mainEntity.itemListElement.length >= 2; } catch {}
  (collectionOk ? pass : fail)('دادهٔ ساخت‌یافته CollectionPage برای سئو ثبت شده');

  /* ---------- ۵) لینک‌دهی داخلی و ساختار URL ---------- */
  await page.goto('/guide', { waitUntil: 'networkidle' });
  (await page.locator('.guide-cross-links a[href="/collections"]').count() >= 1 ? pass : fail)('لینک داخلی راهنما ← کالکشن‌ها موجود است');
  (await page.locator('.guide-cross-links a[href="/trending"]').count() >= 1 ? pass : fail)('لینک داخلی راهنما ← ترندینگ موجود است');
  await page.goto('/collections', { waitUntil: 'networkidle' });
  (await page.locator('.guide-cross-links a[href="/guide"]').count() >= 1 ? pass : fail)('لینک داخلی کالکشن ← راهنما موجود است');
  await page.goto('/', { waitUntil: 'networkidle' });
  (await page.locator('.site-footer a[href="/guide"]').count() >= 1 ? pass : fail)('لینک راهنمای استایل در فوتر سایت موجود است');
  (await page.locator('.site-footer a[href="/collections"]').count() >= 1 ? pass : fail)('لینک کالکشن‌ها در فوتر سایت موجود است');
  (await page.locator('.site-footer a[href="/trending"]').count() >= 1 ? pass : fail)('لینک ترندینگ در فوتر سایت موجود است');

  // نقشهٔ سایت
  const sitemap = await page.request.get(`${base}/sitemap.xml`);
  const sitemapBody = await sitemap.text();
  const hasAll = ['/guide/belt-size-guide', '/collections/autumn-warm', '/daily/warm-gold-this-autumn', '/product/classic-leather-belt', '/trending'].every(path => sitemapBody.includes(path));
  (sitemap.ok() && hasAll ? pass : fail)(`نقشهٔ سایت همهٔ مسیرهای محتوایی را شامل می‌شود (${(sitemapBody.match(/<loc>/g) || []).length} آدرس)`);

  /* ---------- ۶) تسویه از مسیر راهنما ---------- */
  await page.goto('/checkout', { waitUntil: 'networkidle' });
  await page.fill('input[name=name]', 'مشتری راهنمای آزمون');
  await page.fill('input[name=phone]', '09120000000');
  await page.fill('input[name=city]', 'تهران');
  await page.fill('input[name=postalCode]', '1234567890');
  await page.fill('textarea[name=address]', 'تهران، خیابانٔ ولیعصر، پلاک ۱۰، واحد ۳');
  await page.locator('.terms-checkbox input').check();
  await page.getByRole('button', { name: /ثبت سفارش و دریافت کد پیگیری/ }).click();
  await page.waitForSelector('.order-success', { timeout: 20000 }).then(() => pass('سفارش از مسیر راهنما ← سبد ← تسویه ثبت شد')).catch(() => fail('ثبت سفارش از مسیر راهنما انجام نشد'));
  orderCode = ((await page.locator('.success-code b').textContent().catch(() => '')) || '').trim();
  if (orderCode) pass(`کد پیگیری سفارش صادر شد: ${orderCode}`); else fail('کد پیگیری صادر نشد');

  /* ---------- ۷) پنل مدیر ---------- */
  // بستن صفحهٔ عمومی و باز کردن صفحهٔ تازه تا حافظهٔ مرورگر آزاد شود
  await page.close();
  const adminPage = await context.newPage();
  adminPage.setDefaultTimeout(15000);
  page = adminPage;
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  const pwFields = page.locator('input[type=password]');
  if (await pwFields.count() >= 2) { await pwFields.nth(0).fill(password); await pwFields.nth(1).fill(password); await page.getByRole('button', { name: /راه‌اندازی/ }).click(); }
  else { await pwFields.first().fill(password); await page.getByRole('button', { name: /ورود/ }).click(); }
  await page.waitForSelector('.admin-sidebar', { timeout: 12000 }).then(() => pass('ورود به پنل مدیر')).catch(() => fail('ورود به پنل مدیر'));

  await page.locator('.admin-sidebar nav').getByRole('button', { name: /راهنما و کالکشن/ }).click();
  await page.waitForSelector('.guides-admin', { timeout: 8000 }).then(() => pass('تب «راهنما و کالکشن» در پنل باز می‌شود')).catch(() => fail('تب راهنما و کالکشن باز نشد'));
  (await page.locator('.guides-admin tbody tr').count() >= 6 ? pass : fail)(`راهنماها در پنل فهرست می‌شوند (${await page.locator('.guides-admin tbody tr').count()} راهنما)`);

  /* ---------- ۸) ساخت راهنمای زمان‌بندی‌شده ---------- */
  await page.locator('.guides-admin').getByRole('button', { name: /راهنمأ جدید/ }).click();
  await page.waitForSelector('.admin-modal-form', { timeout: 8000 }).then(() => pass('مودال ساخت راهنما باز می‌شود')).catch(() => fail('مودال راهنما باز نشد'));
  await page.getByLabel('عنوان راهنما').fill('راهنمای آزمون فاز هشت');
  await page.getByLabel('موضوع').selectOption('layering');
  await page.getByLabel('لیبل کوچک بالا').fill('آزمون خودکار');
  await page.getByLabel('خلاصه (در کارت و صفحهٔ راهنما)').fill('این راهنما برای آزمون خودکار فاز ۸ ساخته شده است.');
  await page.getByLabel('متن راهنما').fill('## مرحلهٔ آزمون\nاین اولین پاراگراف راهنمای آزمون است.\n\n- نکتهٔ اول\n- نکتهٔ دوم\n\n[[product:2|گردنبند آزمون]]\n\n## مرحلهٔ دوم\nادامهٔ متن آزمون.');
  await page.locator('.daily-admin-picker .picker-chip', { hasText: 'گردنبند زنجیری کوبان' }).locator('input').check();
  await page.getByLabel('زمان انتشار').fill(localInput(new Date(Date.now() + 60 * 60 * 1000)));
  await page.getByRole('button', { name: /ذخیرهٔ راهنما/ }).click();
  await page.waitForSelector('.admin-modal-form', { state: 'detached', timeout: 20000 }).then(() => pass('راهنما ذخیره و مودال بسته شد')).catch(() => fail('مودال راهنما بسته نشد'));

  const guideRow = await db.query('select id, slug, topic from kiya_guides where title = $1', ['راهنمای آزمون فاز هشت']);
  if (guideRow.rows.length) {
    guideId = guideRow.rows[0].id;
    pass(`راهنمای زمان‌بندی‌شده ذخیره شد (شناسه ${guideId}، مسیر /guide/${guideRow.rows[0].slug})`);
    (/^[a-z0-9-]+$/.test(guideRow.rows[0].slug) ? pass : fail)(`نشانی خودکار راهنما لاتین است: ${guideRow.rows[0].slug}`);
  } else fail('راهنمای زمان‌بندی‌شده در دیتابیس ذخیره نشد');

  await page.goto('/guide', { waitUntil: 'networkidle' });
  (!((await page.locator('body').textContent() || '').includes('راهنمای آزمون فاز هشت')) ? pass : fail)('راهنمای زمان‌بندی‌شده پیش از موعد منتشر نمی‌شود');

  /* ---------- ۹) انتشار فوری ---------- */
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-sidebar nav').getByRole('button', { name: /راهنما و کالکشن/ }).click();
  await page.waitForSelector('.guides-admin tbody', { timeout: 8000 });
  await page.locator('.guides-admin tbody tr', { hasText: 'راهنمای آزمون فاز هشت' }).first().getByRole('button', { name: /ویرایش/ }).click();
  await page.waitForSelector('.admin-modal-form', { timeout: 8000 });
  await page.getByLabel('زمان انتشار').fill(localInput(new Date(Date.now() - 5 * 60 * 1000)));
  await page.getByRole('button', { name: /ذخیرهٔ راهنما/ }).click();
  await page.waitForSelector('.admin-modal-form', { state: 'detached', timeout: 20000 }).then(() => pass('ویرایش راهنما ذخیره شد')).catch(() => fail('مودال ویرایش راهنما بسته نشد'));

  await page.goto(`/guide/${guideRow.rows[0].slug}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.guide-view', { timeout: 10000 }).then(() => pass('راهنمای منتشرشده در صفحهٔ اختصاصی دیده می‌شود')).catch(() => fail('راهنمای منتشرشده باز نشد'));
  (await page.locator('.guide-view-topic').textContent() || '').trim() === 'LAYERING' ? pass('موضوع راهنما در صفحهٔ اختصاصی درست است') : fail('موضوع راهنما اشتباه است');
  (await page.locator('.guide-view-list li').count() >= 2 ? pass : fail)('لیست نوشته‌شده در متن آزمون رندر می‌شود');
  (await page.locator('.guide-view-content .guide-product-card h4').first().textContent() || '').includes('آزمون') ? pass('برچسب دلخواه کارت محصول در راهنما اعمال شد') : fail('برچسب کارت محصول راهنما اعمال نشد');

  /* ---------- ۱۰) ساخت کالکشن آزمون ---------- */
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-sidebar nav').getByRole('button', { name: /راهنما و کالکشن/ }).click();
  await page.waitForSelector('.guides-admin', { timeout: 8000 });
  await page.locator('.admin-sub-tabs button', { hasText: 'کالکشن‌ها' }).click();
  await page.waitForSelector('.guides-admin tbody', { timeout: 8000 });
  await page.locator('.guides-admin').getByRole('button', { name: /کالکشن جدید/ }).click();
  await page.waitForSelector('.admin-modal-form', { timeout: 8000 }).then(() => pass('مودال ساخت کالکشن باز می‌شود')).catch(() => fail('مودال کالکشن باز نشد'));
  await page.getByLabel('نام کالکشن').fill('کالکشن آزمون فاز هشت');
  await page.getByLabel('برچسب انگلیسی').fill('QA COLLECTION');
  await page.getByLabel('برچسب کوچک (مثل «جدید»)').fill('آزمون');
  await page.getByLabel('زیرعنوان').fill('زیرعنوان کالکشن آزمون');
  await page.getByLabel('توضیح کالکشن (برای صفحه و سئو)').fill('توضیح کالکشن آزمون برای بررسی سئو.');
  await page.locator('.daily-admin-picker .picker-chip', { hasText: 'انگشتر سیگنت مینیمال' }).locator('input').check();
  await page.locator('.daily-admin-picker .picker-chip', { hasText: 'گوشواره حلقه‌ای آوا' }).locator('input').check();
  await page.getByLabel('کالکشن ویژه (بزرگ در بالای صفحه)').check();
  await page.getByRole('button', { name: /ذخیرهٔ کالکشن/ }).click();
  await page.waitForSelector('.admin-modal-form', { state: 'detached', timeout: 20000 }).then(() => pass('کالکشن ذخیره و مودال بسته شد')).catch(() => fail('مودال کالکشن بسته نشد'));

  const colRow = await db.query('select id, slug, featured from kiya_collections where name = $1', ['کالکشن آزمون فاز هشت']);
  if (colRow.rows.length) {
    collectionId = colRow.rows[0].id;
    pass(`کالکشن آزمون ذخیره شد (شناسه ${collectionId}، مسیر /collections/${colRow.rows[0].slug})`);
  } else fail('کالکشن آزمون در دیتابیس ذخیره نشد');

  await page.goto(`/collections/${colRow.rows[0].slug}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.collection-page', { timeout: 10000 }).then(() => pass('لندینگ کالکشن آزمون باز می‌شود')).catch(() => fail('لندینگ کالکشن آزمون باز نشد'));
  (await page.locator('.collection-hero h1').textContent() || '').includes('آزمون') ? pass('تیتر کالکشن آزمون درست است') : fail('تیتر کالکشن آزمون اشتباه است');
  (await page.locator('.collection-badge').first().textContent() || '').trim() === 'آزمون' ? pass('برچسب کالکشن نمایش داده می‌شود') : fail('برچسب کالکشن دیده نشد');
  (await page.locator('.collection-products .product-card').count() === 2 ? pass : fail)(`محصولات کالکشن آزمون رندر می‌شوند (${await page.locator('.collection-products .product-card').count()} محصول)`);

  /* ---------- ۱۱) پیش‌نویس راهنما + حذف‌ها ---------- */
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-sidebar nav').getByRole('button', { name: /راهنما و کالکشن/ }).click();
  await page.waitForSelector('.guides-admin tbody', { timeout: 8000 });
  await page.locator('.guides-admin tbody tr', { hasText: 'راهنمای آزمون فاز هشت' }).first().getByRole('button', { name: /ویرایش/ }).click();
  await page.waitForSelector('.admin-modal-form', { timeout: 8000 });
  await page.getByLabel(/این راهنما منتشر شود/).uncheck();
  await page.getByRole('button', { name: /ذخیرهٔ راهنما/ }).click();
  await page.waitForSelector('.admin-modal-form', { state: 'detached', timeout: 20000 }).then(() => pass('ذخیرهٔ پیش‌نویس راهنما انجام شد')).catch(() => fail('مودال پیش‌نویس راهنما بسته نشد'));
  await page.goto('/guide', { waitUntil: 'networkidle' });
  (!((await page.locator('body').textContent() || '').includes('راهنمای آزمون فاز هشت')) ? pass : fail)('راهنمای پیش‌نویس از فهرست حذف می‌شود');

  // حذف راهنما
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-sidebar nav').getByRole('button', { name: /راهنما و کالکشن/ }).click();
  await page.waitForSelector('.guides-admin tbody', { timeout: 8000 });
  page.once('dialog', d => d.accept());
  await page.locator('.guides-admin tbody tr', { hasText: 'راهنمای آزمون فاز هشت' }).first().getByRole('button', { name: /حذف/ }).click();
  await page.waitForTimeout(4000);
  const guideAfter = await db.query('select id from kiya_guides where id = $1', [guideId]);
  (guideAfter.rows.length === 0 ? pass : fail)('راهنمای آزمون از دیتابیس حذف شد');

  // حذف کالکشن
  await page.locator('.admin-sub-tabs button', { hasText: 'کالکشن‌ها' }).click();
  await page.waitForSelector('.guides-admin tbody', { timeout: 8000 });
  page.once('dialog', d => d.accept());
  await page.locator('.guides-admin tbody tr', { hasText: 'کالکشن آزمون فاز هشت' }).first().getByRole('button', { name: /حذف/ }).click();
  await page.waitForTimeout(4000);
  const colAfter = await db.query('select id from kiya_collections where id = $1', [collectionId]);
  (colAfter.rows.length === 0 ? pass : fail)('کالکشن آزمون از دیتابیس حذف شد');

  /* ---------- ۱۲) بررسی سفارش و پاک‌سازی ---------- */
  if (orderCode) {
    const order = await db.query('select code, items from kiya_orders where code = $1', [orderCode]);
    (order.rows.length ? pass : fail)(`سفارش «${orderCode}» در دیتابیس فروشگاه ثبت است`);
  }
  await db.query('delete from kiya_orders where code = $1', [orderCode]);

  (errors.length === 0 ? pass : fail)(`بدون خطای مرورگر (${errors.length} خطا)`);
} catch (error) {
  fail('اجرای تست با خطای غیرمنتظره متوقف شد: ' + error.message);
} finally {
  await db.end();
  await browser.close();
  console.log(`\nنتیجه: ${results.filter(Boolean).length}/${results.length} PASS`);
  process.exit(results.some(r => !r) ? 1 : 0);
}
