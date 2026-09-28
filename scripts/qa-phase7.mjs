import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Client } from 'pg';

const base = 'http://localhost:3000';
const results = [];
const pass = t => { results.push(1); console.log('PASS:', t); };
const fail = t => { results.push(0); console.log('FAIL:', t); };

let password = process.env.QA_ADMIN_PASSWORD;
if (!password) { try { password = await readFile('/home/user/.kiya-qa-password', 'utf8'); } catch { password = randomBytes(12).toString('base64url'); await writeFile('/home/user/.kiya-qa-password', password, { mode: 0o600 }); } }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ baseURL: base, viewport: { width: 1500, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const db = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/app_db' });
await db.connect();

const slug = 'qa-daily-' + randomBytes(4).toString('hex');
const title = 'مطلب آزمون روزنامهٔ کیا';
let orderCode = '';
let createdId = 0;

const localInput = (date) => {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

try {
  /* ---------- ۱) صفحهٔ امروز ---------- */
  await page.goto('/daily', { waitUntil: 'networkidle' });
  await page.waitForSelector('.daily-masthead', { timeout: 10000 }).then(() => pass('صفحهٔ Fashion Daily باز می‌شود')).catch(() => fail('صفحهٔ Fashion Daily باز نشد'));

  (await page.locator('.daily-edition-date').count() && /[۰-۹]/.test(await page.locator('.daily-edition-date').textContent() || '')
    ? pass : fail)(`تاریخ شمسی در سربرگ روزنامه نمایش داده می‌شود: ${(await page.locator('.daily-edition-date').textContent() || '').trim()}`);
  (await page.locator('.daily-edition-tag').textContent() || '').includes('TODAY') ? pass('برچسب TODAY\u2019S EDITION موجود است') : fail('برچسب TODAY\u2019S EDITION نیست');
  (await page.locator('.daily-title').textContent() || '').includes('FASHION') ? pass('تیتر روزنامهٔ FASHION DAILY رندر می‌شود') : fail('تیتر روزنامه دیده نشد');

  const sections = await page.locator('.daily-section').count();
  (sections >= 7 ? pass : fail)(`سکشن‌های روزنامه رندر می‌شوند (${sections} سکشن)`);

  const cards = await page.locator('.daily-card').count();
  (cards >= 7 ? pass : fail)(`کارت مقاله‌ها نمایش داده می‌شوند (${cards} مطلب)`);

  await page.waitForSelector('.daily-main').then(() => pass('بخش مطلب اصلی رندر می‌شود')).catch(() => fail('مطلب اصلی دیده نشد'));
  const mainBadge = (await page.locator('.daily-main-badge').textContent() || '').trim();
  (mainBadge === 'MAIN STORY' ? pass : fail)(`برچسب MAIN STORY روی مطلب اصلی است (${mainBadge})`);

  /* ---------- ۲) فیلتر سکشن‌ها ---------- */
  await page.locator('.daily-section-nav button', { hasText: 'رنگ روز' }).click();
  await page.waitForTimeout(600);
  const filteredSections = await page.locator('.daily-section').count();
  (filteredSections === 1 ? pass : fail)(`فیلتر سکشن «رنگ روز» فقط یک سکشن را نشان می‌دهد (${filteredSections})`);
  const filteredTitle = (await page.locator('.daily-section-head h2').first().textContent() || '').trim();
  (filteredTitle.includes('رنگ روز') ? pass : fail)(`سکشن فیلترشده درست است: ${filteredTitle}`);
  await page.locator('.daily-section-nav button', { hasText: 'همه' }).click();
  await page.waitForTimeout(400);

  /* ---------- ۳) لینک هدر ---------- */
  await page.goto('/', { waitUntil: 'networkidle' });
  (await page.locator('.nav-links a[href="/daily"]').count() >= 1 ? pass : fail)('لینک «مجلهٔ مد» در منوی اصلی هدر دیده می‌شود');

  /* ---------- ۴) صفحهٔ مقاله + Content → Commerce ---------- */
  await page.goto('/daily/warm-gold-this-autumn', { waitUntil: 'networkidle' });
  await page.waitForSelector('.article-header h1', { timeout: 10000 }).then(() => pass('صفحهٔ مقاله باز می‌شود')).catch(() => fail('صفحهٔ مقاله باز نشد'));
  (await page.locator('.article-section-tag').textContent() || '').trim() === 'MAIN STORY' ? pass('برچسب سکشن در صفحهٔ مقاله درست است') : fail('برچسب سکشن مقاله اشتباه است');
  (await page.locator('.article-breadcrumb a[href="/daily"]').count() >= 1 ? pass : fail)('مسیر صفحه (breadcrumb) به روزنامه وصل است');
  (await page.locator('.article-subhead').count() >= 2 ? pass : fail)(`زیرتیترهای مطلب رندر می‌شوند (${await page.locator('.article-subhead').count()})`);
  (await page.locator('.article-quote').count() >= 1 ? pass : fail)('نقل‌قول برجسته در متن مقاله رندر می‌شود');
  (await page.locator('.article-paragraph').count() >= 3 ? pass : fail)(`پاراگراف‌های متن رندر می‌شوند (${await page.locator('.article-paragraph').count()})`);
  (await page.locator('.article-lead').count() >= 1 ? pass : fail)('پیش‌گفتار (خلاصهٔ مطلب) نمایش داده می‌شود');

  const inlineCards = await page.locator('.article-content .daily-product-card').count();
  (inlineCards >= 2 ? pass : fail)(`کارت محصول داخل متن مقاله رندر می‌شود (${inlineCards} کارت)`);

  // افزودن به سبد از کارت داخل مقاله
  const firstCard = page.locator('.article-content .daily-product-card').first();
  const cardName = (await firstCard.locator('h4').textContent() || '').trim();
  await firstCard.getByRole('button', { name: /افزودن به سبد/ }).click();
  await page.waitForTimeout(1200);
  const cartCount = await page.evaluate(() => JSON.parse(localStorage.getItem('kiya-cart') || '[]').length);
  (cartCount >= 1 ? pass : fail)(`محصول از داخل مقاله به سبد اضافه شد: ${cardName} (${cartCount} قلم)`);

  // SHOP THE TREND
  await page.waitForSelector('.article-shop').then(() => pass('بخش SHOP THE TREND پایین مقاله رندر می‌شود')).catch(() => fail('بخش SHOP THE TREND نیست'));
  (await page.locator('.article-shop .daily-product-card').count() >= 2 ? pass : fail)(`محصولات این مطلب نمایش داده می‌شوند (${await page.locator('.article-shop .daily-product-card').count()} محصول)`);

  // رفتن به صفحهٔ محصول از کارت مقاله
  const cardHref = await firstCard.locator('h4 a').getAttribute('href').catch(() => '');
  await page.goto(cardHref || '/product/sculpture-gold-earrings', { waitUntil: 'networkidle' });
  await page.waitForSelector('body', { timeout: 10000 }).then(() => pass('مسیر مقاله ← محصول باز می‌شود')).catch(() => fail('رفتن از مقاله به صفحهٔ محصول انجام نشد'));
  (/\/product\//.test(page.url()) ? pass : fail)(`آدرس محصول از کارت مقاله: ${page.url()}`);

  /* ---------- ۵) تسویه کامل (Content → Commerce) ---------- */
  await page.goto('/checkout', { waitUntil: 'networkidle' });
  await page.fill('input[name=name]', 'مشتری روزنامهٔ آزمون');
  await page.fill('input[name=phone]', '09120000000');
  await page.fill('input[name=city]', 'تهران');
  await page.fill('input[name=postalCode]', '1234567890');
  await page.fill('textarea[name=address]', 'تهران، خیابانٔ ولیعصر، پلاک ۱۰، واحد ۳');
  await page.locator('.terms-checkbox input').check();
  await page.getByRole('button', { name: /ثبت سفارش و دریافت کد پیگیری/ }).click();
  await page.waitForSelector('.order-success', { timeout: 20000 }).then(() => pass('سفارش از مسیر مقاله ← محصول ← تسویه ثبت شد')).catch(() => fail('ثبت سفارش از مسیر مقاله انجام نشد'));
  orderCode = ((await page.locator('.success-code b').textContent().catch(() => '')) || '').trim();
  if (orderCode) pass(`کد پیگیری سفارش صادر شد: ${orderCode}`); else fail('کد پیگیری صادر نشد');

  /* ---------- ۶) مطلب رنگ روز ---------- */
  await page.goto('/daily/color-of-the-day-matte-gold', { waitUntil: 'networkidle' });
  await page.waitForSelector('.article-color-strip', { timeout: 10000 }).then(() => pass('نوار «رنگ روز» در صفحهٔ مطلب رندر می‌شود')).catch(() => fail('نوار رنگ روز دیده نشد'));
  const chip = await page.locator('.article-color-chip').evaluate(el => getComputedStyle(el).backgroundColor).catch(() => '');
  (chip === 'rgb(209, 155, 68)' ? pass : fail)(`رنگ روز روی چیپ اعمال شد (${chip})`);
  (await page.locator('.article-related-item').count() >= 1 ? pass : fail)(`مطالب مرتبط در سایدبار نمایش داده می‌شوند (${await page.locator('.article-related-item').count()})`);

  /* ---------- ۷) مطلب نامعتبر ---------- */
  await page.goto('/daily/does-not-exist', { waitUntil: 'networkidle' });
  (await page.locator('body').textContent() || '').match(/پیدا نشد|404/) ? pass('مطلب نامعتبر صفحهٔ ۴۰۴ فارسی نشان می‌دهد') : fail('مسیر نامعتبر مدیریت نشد');

  /* ---------- ۸) پنل مدیر: تب Fashion Daily ---------- */
  await page.goto('/admin', { waitUntil: 'networkidle' });
  const pwFields = page.locator('input[type=password]');
  if (await pwFields.count() >= 2) { await pwFields.nth(0).fill(password); await pwFields.nth(1).fill(password); await page.getByRole('button', { name: /راه‌اندازی/ }).click(); }
  else { await pwFields.first().fill(password); await page.getByRole('button', { name: /ورود/ }).click(); }
  await page.waitForSelector('.admin-sidebar', { timeout: 12000 }).then(() => pass('ورود به پنل مدیر')).catch(() => fail('ورود به پنل مدیر'));

  await page.locator('.admin-sidebar nav').getByRole('button', { name: /Fashion Daily/ }).click();
  await page.waitForSelector('.daily-admin', { timeout: 8000 }).then(() => pass('تب Fashion Daily در پنل باز می‌شود')).catch(() => fail('تب Fashion Daily باز نشد'));
  const listed = await page.locator('.daily-admin tbody tr').count();
  (listed >= 8 ? pass : fail)(`همهٔ مطالب در پنل فهرست می‌شوند (${listed} مطلب)`);

  /* ---------- ۹) ساخت مطلب زمان‌بندی‌شده ---------- */
  await page.locator('.daily-admin').getByRole('button', { name: /مطلب جدید/ }).click();
  await page.waitForSelector('.admin-modal-form', { timeout: 8000 }).then(() => pass('مودال ساخت مطلب باز می‌شود')).catch(() => fail('مودال مطلب باز نشد'));

  await page.getByLabel('عنوان مطلب').fill(title);
  await page.getByLabel('سکشن روزنامه').selectOption('trending-now');
  await page.getByLabel('لیبل کوچک بالا').fill('گزارش آزمون');
  await page.getByLabel('نویسنده').fill('دبیرخانهٔ آزمون');
  await page.getByLabel('خلاصهٔ مطلب (در کارت و صفحهٔ مقاله)').fill('این مطلب برای آزمون خودکار فاز ۷ ساخته شده است.');
  await page.getByLabel('متن مطلب').fill('## زیرتیتر آزمون\nاین اولین پاراگراف مطلب آزمون است.\n\n[[product:1|کمربند کلاسیک آزمون]]\n\nپاراگراف دوم برای بررسی جداکردن متن.');
  await page.locator('.daily-admin-picker .picker-chip', { hasText: 'کمربند چرم کلاسیک' }).locator('input').check();
  await page.getByLabel('زمان انتشار').fill(localInput(new Date(Date.now() + 60 * 60 * 1000)));
  await page.getByRole('button', { name: /ذخیرهٔ مطلب/ }).click();
  await page.waitForSelector('.admin-modal-form', { state: 'detached', timeout: 20000 }).then(() => pass('مودال مطلب پس از ذخیره بسته شد')).catch(() => fail('مودال مطلب بسته نشد'));
  const saveToast = (await page.locator('[role=status], [role=alert]').allTextContents().catch(() => [])).join(' ');
  (saveToast.includes('ذخیره') ? pass : fail)(`پیام موفقیت ذخیره نمایش داده شد: ${saveToast.slice(0, 60)}`);

  const scheduled = await db.query('select id, slug, section, publish_at from kiya_articles where title = $1', [title]);
  if (scheduled.rows.length) {
    createdId = scheduled.rows[0].id;
    pass(`مطلب زمان‌بندی‌شده ذخیره شد (شناسه ${createdId}، مسیر /daily/${scheduled.rows[0].slug})`);
    (/^[a-z0-9-]+$/.test(scheduled.rows[0].slug) ? pass : fail)(`نشانی خودکار از عنوان فارسی، لاتین و امن ساخته شد: ${scheduled.rows[0].slug}`);
  } else fail('مطلب زمان‌بندی‌شده در دیتابیس ذخیره نشد');

  // پیش از موعد نباید در روزنامه دیده شود
  await page.goto('/daily', { waitUntil: 'networkidle' });
  const notYet = !((await page.locator('body').textContent() || '').includes(title));
  (notYet ? pass : fail)('مطلب زمان‌بندی‌شده پیش از موعد در روزنامه منتشر نمی‌شود');

  /* ---------- ۱۰) انتشار فوری از پنل ---------- */
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.locator('.admin-sidebar nav').getByRole('button', { name: /Fashion Daily/ }).click();
  await page.waitForSelector('.daily-admin tbody', { timeout: 8000 });
  const row = page.locator('.daily-admin tbody tr', { hasText: title }).first();
  await row.getByRole('button', { name: /ویرایش/ }).click();
  await page.waitForSelector('.admin-modal-form', { timeout: 8000 });
  await page.getByLabel('زمان انتشار').fill(localInput(new Date(Date.now() - 5 * 60 * 1000)));
  await page.getByRole('button', { name: /ذخیرهٔ مطلب/ }).click();
  await page.waitForSelector('.admin-modal-form', { state: 'detached', timeout: 20000 }).then(() => pass('ویرایش مطلب ذخیره و مودال بسته شد')).catch(() => fail('مودال ویرایش مطلب بسته نشد'));

  await page.goto(`/daily/${scheduled.rows[0].slug}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.article-header h1', { timeout: 10000 }).then(() => pass('مطلب پس از انتشار در صفحهٔ اختصاصی دیده می‌شود')).catch(() => fail('مطلب منتشرشده باز نشد'));
  (await page.locator('.article-section-tag').textContent() || '').trim() === 'TRENDING NOW' ? pass('سکشن مطلب در صفحهٔ مقاله درست است') : fail('سکشن مطلب اشتباه است');
  const inline = await page.locator('.article-content .daily-product-card').count();
  (inline >= 1 ? pass : fail)(`کارت محصول نوشته‌شده با [[product:1]] در متن رندر می‌شود (${inline} کارت)`);
  const inlineLabel = (await page.locator('.article-content .daily-product-card h4').first().textContent() || '').trim();
  (inlineLabel.includes('آزمون') ? pass : fail)(`برچسب دلخواه کارت محصول اعمال شد: ${inlineLabel}`);

  await page.goto('/daily', { waitUntil: 'networkidle' });
  ((await page.locator('body').textContent() || '').includes(title) ? pass : fail)('مطلب منتشرشده در صفحهٔ امروز دیده می‌شود');

  /* ---------- ۱۱) پیش‌نویس ---------- */
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.locator('.admin-sidebar nav').getByRole('button', { name: /Fashion Daily/ }).click();
  await page.waitForSelector('.daily-admin tbody', { timeout: 8000 });
  const draftRow = page.locator('.daily-admin tbody tr', { hasText: title }).first();
  await draftRow.getByRole('button', { name: /ویرایش/ }).click();
  await page.waitForSelector('.admin-modal-form', { timeout: 8000 });
  await page.getByLabel(/این مطلب منتشر شود/).uncheck();
  await page.getByRole('button', { name: /ذخیرهٔ مطلب/ }).click();
  await page.waitForSelector('.admin-modal-form', { state: 'detached', timeout: 20000 }).then(() => pass('ذخیرهٔ پیش‌نویس انجام شد')).catch(() => fail('مودال پیش‌نویس بسته نشد'));
  await page.goto('/daily', { waitUntil: 'networkidle' });
  const draftHidden = !((await page.locator('body').textContent() || '').includes(title));
  (draftHidden ? pass : fail)('مطلب پیش‌نویس (غیرفعال) از روزنامه حذف می‌شود');

  /* ---------- ۱۲) حذف ---------- */
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.locator('.admin-sidebar nav').getByRole('button', { name: /Fashion Daily/ }).click();
  await page.waitForSelector('.daily-admin tbody', { timeout: 8000 });
  page.once('dialog', d => d.accept());
  await page.locator('.daily-admin tbody tr', { hasText: title }).first().getByRole('button', { name: /حذف/ }).click();
  await page.waitForTimeout(4000);
  const afterDelete = await db.query('select id from kiya_articles where id = $1', [createdId]);
  (afterDelete.rows.length === 0 ? pass : fail)('مطلب آزمون از دیتابیس حذف شد');

  /* ---------- ۱۳) سفارش ثبت‌شده در دیتابیس ---------- */
  if (orderCode) {
    const order = await db.query('select code, total, items from kiya_orders where code = $1', [orderCode]);
    (order.rows.length ? pass : fail)(`سفارش «${orderCode}» در دیتابیس فروشگاه ثبت است (${order.rows[0]?.items?.length ?? 0} قلم)`);
  }

  /* ---------- ۱۴) پاک‌سازی سفارش آزمون ---------- */
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
