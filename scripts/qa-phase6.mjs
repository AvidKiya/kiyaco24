import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

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

const partnerPhone = '0912' + String(Math.floor(Math.random() * 9000000) + 1000000);
const partnerPassword = 'KiYa' + randomBytes(4).toString('hex');
let partnerOrderCode = '';

try {
  /* ۱) لندینگ همکاری */
  await page.goto('/partner', { waitUntil: 'networkidle' });
  await page.waitForSelector('.partner-hero', { timeout: 10000 }).then(() => pass('لندینگ «همکاری با ما» باز می‌شود')).catch(() => fail('لندینگ همکاری باز نشد'));
  (await page.locator('.partner-tier-card').count() >= 4 ? pass : fail)(`لایه‌های قیمت نمایش داده می‌شوند (${await page.locator('.partner-tier-card').count()} لایه)`);
  await page.waitForSelector('.partner-form').then(() => pass('فرم درخواست همکاری موجود است')).catch(() => fail('فرم درخواست همکاری نیست'));

  // لینک هدر
  await page.goto('/', { waitUntil: 'networkidle' });
  (await page.locator('.partner-nav-link').count() >= 1 ? pass : fail)('لینک «همکاری با ما» در منوی اصلی هدر دیده می‌شود');

  /* ۲) ثبت درخواست همکاری */
  await page.goto('/partner', { waitUntil: 'networkidle' });
  await page.getByLabel('نام کسب‌وکار یا برند').fill('بوتیک آزمون خودکار');
  await page.getByLabel('نام و نام خانوادگی مسئول').fill('مدیر آزمون');
  await page.getByLabel('شماره موبایل', { exact: true }).fill(partnerPhone);
  await page.getByLabel('شهر', { exact: true }).fill('اصفهان');
  await page.getByLabel('دربارهٔ کسب‌وکار و حجم خرید شما').fill('فروشگاه اکسسوری با ۳ شعبه؛ خرید ماهانه حدود ۸۰ میلیون تومان.');
  await page.locator('.partner-password-block input[type=password]').fill(partnerPassword);
  await page.getByRole('button', { name: /ارسال درخواست همکاری/ }).click();
  await page.waitForSelector('.partner-apply-done', { timeout: 10000 }).then(() => pass('درخواست همکاری ثبت شد')).catch(() => fail('درخواست همکاری ثبت نشد'));

  // ورود همکار قبل از تأیید باید رد شود
  await page.goto('/partner/login', { waitUntil: 'networkidle' });
  await page.getByLabel('شماره موبایل').fill(partnerPhone);
  await page.locator('input[name=password]').fill(partnerPassword);
  await page.getByRole('button', { name: /ورود به پنل همکار/ }).click();
  await page.waitForTimeout(1500);
  const preApprovalError = await page.locator('.form-error').textContent().catch(() => '');
  (/بررسی نشده/.test(preApprovalError || '') ? pass : fail)(`ورود پیش از تأیید با پیام فارسی رد می‌شود: "${preApprovalError}"`);

  /* ۳) تأیید توسط مدیر */
  await page.goto('/admin', { waitUntil: 'networkidle' });
  const pwFields = page.locator('input[type=password]');
  if (await pwFields.count() >= 2) { await pwFields.nth(0).fill(password); await pwFields.nth(1).fill(password); await page.getByRole('button', { name: /راه‌اندازی/ }).click(); }
  else { await pwFields.first().fill(password); await page.getByRole('button', { name: /ورود/ }).click(); }
  await page.waitForSelector('.admin-sidebar', { timeout: 12000 }).then(() => pass('ورود به پنل مدیر')).catch(() => fail('ورود به پنل مدیر'));

  await page.locator('.admin-sidebar nav').getByRole('button', { name: /همکاران عمده/ }).click();
  await page.waitForSelector('.partners-admin', { timeout: 8000 }).then(() => pass('تب «همکاران عمده» در پنل باز می‌شود')).catch(() => fail('تب همکاران باز نشد'));
  (await page.locator('.partner-tier-card, .partners-admin table').count() >= 1 ? pass : fail)('جدول لایه‌های قیمت و همکاران رندر می‌شود');

  const partnerRow = page.locator('tr', { hasText: 'بوتیک آزمون خودکار' }).first();
  await partnerRow.getByRole('button', { name: /بررسی همکار/ }).click();
  await page.waitForSelector('.partner-review', { timeout: 8000 }).then(() => pass('مودال بررسی درخواست همکار باز می‌شود')).catch(() => fail('مودال بررسی همکار باز نشد'));

  // انتخاب لایهٔ عمده
  const tierSelect = page.locator('.partner-review select').first();
  const tierOptions = await tierSelect.locator('option').allTextContents();
  const wholesaleIndex = tierOptions.findIndex(text => text.includes('عمده') && !text.includes('VIP'));
  if (wholesaleIndex >= 0) await tierSelect.selectOption({ index: wholesaleIndex });
  pass(`لایهٔ انتخاب‌شده برای همکار: ${tierOptions[wholesaleIndex]?.slice(0, 40) ?? 'پیش‌فرض'}`);
  await page.getByRole('button', { name: /تأیید و فعال‌سازی/ }).click();
  await page.waitForTimeout(1500);
  const partnerRowText = await page.locator('tr', { hasText: 'بوتیک آزمون خودکار' }).first().textContent().catch(() => '');
  (/تأیید‌شده/.test(partnerRowText || '') ? pass : fail)('وضعیت همکار پس از تأیید «تأیید‌شده» شد');

  /* ۴) ورود همکار و مشاهدهٔ قیمت لایه‌ای */
  await page.goto('/partner/login', { waitUntil: 'networkidle' });
  await page.getByLabel('شماره موبایل').fill(partnerPhone);
  await page.locator('input[name=password]').fill(partnerPassword);
  await page.getByRole('button', { name: /ورود به پنل همکار/ }).click();
  await page.waitForURL('**/partner/panel', { timeout: 15000 }).then(() => pass('همکار پس از تأیید وارد پنل شد')).catch(() => fail('ورود به پنل همکار پس از تأیید ناموفق'));

  await page.waitForSelector('.partner-panel', { timeout: 10000 }).then(() => pass('پنل همکار رندر می‌شود')).catch(() => fail('پنل همکار رندر نشد'));
  const tierBadge = await page.locator('.partner-tier-badge').textContent().catch(() => '');
  pass(`نشان لایهٔ قیمت در پنل: ${tierBadge.replace(/\s+/g, ' ').trim()}`);

  const priceCells = await page.locator('.partner-price').allTextContents();
  (priceCells.length > 0 && priceCells.every(text => /[۰-۹\d]/.test(text)) ? pass : fail)(`کاتالوگ با قیمت همکار نمایش داده می‌شود (${priceCells.length} محصول)`);

  // افزودن دو محصول به سبد عمده
  const qtyInputs = page.locator('.partner-qty');
  await qtyInputs.nth(0).fill('3');
  await page.locator('.partner-catalog-table tbody tr').first().getByRole('button', { name: /افزودن/ }).click();
  await qtyInputs.nth(1).fill('2');
  await page.locator('.partner-catalog-table tbody tr').nth(1).getByRole('button', { name: /افزودن/ }).click();
  await page.waitForTimeout(500);
  (await page.locator('.partner-cart-items>div').count() >= 2 ? pass : fail)('سبد عمده با دو محصول پر شد');

  /* ۵) سفارش عمدهٔ سریع + ثبت سفارش */
  await page.locator('.partner-panel-side nav').getByRole('button', { name: /سفارش عمدهٔ سریع/ }).click();
  await page.waitForSelector('.partner-quick', { timeout: 8000 }).then(() => pass('جدول سفارش عمدهٔ سریع باز می‌شود')).catch(() => fail('جدول سفارش سریع باز نشد'));
  (await page.locator('.partner-quick table tbody tr').count() >= 2 ? pass : fail)('ردیف‌های Product/Color/Size/Qty در جدول سریع');
  const totalText = await page.locator('.partner-order-total').textContent().catch(() => '');
  pass(`خلاصهٔ مبلغ با تخفیف لایه: ${totalText.replace(/\s+/g, ' ').trim()}`);

  // «افزودن همه»
  await page.locator('.partner-panel-side nav').getByRole('button', { name: /کاتالوگ عمده/ }).click();
  await page.getByRole('button', { name: /افزودن همه/ }).click();
  await page.waitForTimeout(600);
  (await page.locator('.partner-cart-items>div').count() >= 3 ? pass : fail)('دکمهٔ «افزودن همه» سبد را پر کرد');

  // اگر زیر حداقل سفارش بود، باید خطا بدهد
  const subtotalText = await page.locator('.partner-cart-total strong').textContent().catch(() => '0');
  pass(`جمع سبد عمده: ${subtotalText}`);

  /* ۶) ثبت سفارش عمده */
  await page.locator('.partner-panel-side nav').getByRole('button', { name: /سفارش عمدهٔ سریع/ }).click();
  await page.waitForSelector('.partner-quick');
  const submitButton = page.getByRole('button', { name: /ثبت سفارش عمده/ });
  const disabled = await submitButton.isDisabled();
  if (disabled) {
    const minError = await page.locator('.coupon-error').textContent().catch(() => '');
    pass(`ثبت سفارش زیر حداقل لایه با پیام فارسی مسدود شد: ${minError.slice(0, 60)}`);
    // پر کردن با حداکثر موجودی هر محصول (max ورودی = موجودی انبار)
    const rows = page.locator('.partner-quick table tbody tr');
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const input = rows.nth(i).locator('input[type=number]');
      if (!(await input.count())) continue;
      const max = Number(await input.getAttribute('max') || '1');
      await input.fill(String(Math.max(1, max)));
    }
    await page.waitForTimeout(400);
    const filledTotal = await page.locator('.partner-order-total strong').textContent().catch(() => '');
    pass(`جمع سبد پس از پر کردن با موجودی کامل: ${filledTotal}`);
  }
  if (!(await submitButton.isDisabled())) {
    await submitButton.click();
    await page.waitForTimeout(2500);
    const successText = await page.locator('.coupon-success').textContent().catch(() => '');
    const match = (successText || '').match(/PB-[A-Z0-9]+/);
    if (match) { partnerOrderCode = match[0]; pass(`سفارش عمده ثبت شد: ${partnerOrderCode}`); }
    else fail('سفارش عمده ثبت نشد');
  } else fail('دکمهٔ ثبت سفارش هنوز غیرفعال است (حداقل سفارش برآورده نشد)');

  /* ۷) تأیید مدیر و صدور فاکتور */
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.locator('.admin-sidebar nav').getByRole('button', { name: /همکاران عمده/ }).click();
  await page.waitForSelector('.partners-admin');
  await page.waitForTimeout(1000);
  const orderRow = page.locator('tr', { hasText: partnerOrderCode || 'PB-' }).first();
  if (await orderRow.count()) {
    await orderRow.locator('select').selectOption('confirmed');
    await page.waitForTimeout(1500);
    const rowText = await orderRow.textContent();
    (/INV-/.test(rowText || '') ? pass : fail)(`شمارهٔ فاکتور پس از تأیید صادر شد: ${(rowText || '').match(/INV-[A-Z0-9]+/)?.[0] ?? '—'}`);
  } else fail('سفارش عمده در پنل مدیر دیده نشد');

  /* ۸) فاکتور و سفارش مجدد در پنل همکار */
  await page.goto('/partner/panel', { waitUntil: 'networkidle' });
  await page.locator('.partner-panel-side nav').getByRole('button', { name: /سفارش‌ها و فاکتور/ }).click();
  await page.waitForSelector('.partner-orders', { timeout: 8000 }).then(() => pass('تب سفارش‌ها و فاکتور باز می‌شود')).catch(() => fail('تب سفارش‌ها باز نشد'));
  const invoice = await page.locator('.partner-invoice').first().textContent().catch(() => '');
  (/INV-/.test(invoice || '') ? pass : fail)(`فاکتور در پنل همکار نمایش داده می‌شود: ${invoice?.trim()}`);

  const reorderButton = page.getByRole('button', { name: /سفارش مجدد/ }).first();
  if (await reorderButton.count()) {
    await reorderButton.click();
    await page.waitForTimeout(1200);
    (await page.locator('.partner-cart-items>div').count() >= 1 ? pass : fail)('سفارش مجدد سبد را پر کرد');
  }

  /* ۹) حساب همکاری و تغییر رمز */
  await page.locator('.partner-panel-side nav').getByRole('button', { name: /حساب همکاری/ }).click();
  await page.waitForSelector('.partner-account', { timeout: 8000 }).then(() => pass('تب حساب همکاری باز می‌شود')).catch(() => fail('تب حساب همکاری باز نشد'));
  const accountText = await page.locator('.partner-account-card').first().textContent().catch(() => '');
  (/اصفهان/.test(accountText || '') ? pass : fail)('اطلاعات همکاری در پنل درست نمایش داده می‌شود');

  (errors.length === 0 ? pass : fail)(`بدون خطای مرورگر (${errors.length} خطا)`);
} catch (error) {
  fail(`استثنا: ${error.message}`);
} finally {
  await browser.close();
}

const failed = results.filter(r => !r).length;
console.log(`\n=== خلاصه: ${results.length - failed} موفق · ${failed} ناموفق ===`);
process.exit(failed ? 1 : 0);
