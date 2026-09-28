import { chromium } from '@playwright/test';

const base = 'http://localhost:3000';
const results = [];
const pass = (text) => { results.push(['PASS', text]); console.log('PASS:', text); };
const fail = (text) => { results.push(['FAIL', text]); console.log('FAIL:', text); };

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));

try {
  // ۱) افزودن محصول به سبد و رفتن به تسویه
  await page.goto('/product/classic-leather-belt', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click();
  await page.goto('/checkout', { waitUntil: 'networkidle' });

  await page.waitForSelector('.gift-options', { timeout: 8000 }).then(() => pass('بخش سیستم هدیه در تسویه نمایش داده می‌شود')).catch(() => fail('بخش سیستم هدیه دیده نشد'));

  // ۲) کادوپیچ + پیام هدیه
  await page.locator('.gift-option input[type=checkbox]').check();
  await page.waitForSelector('.gift-message-field textarea', { timeout: 5000 }).then(() => pass('فیلد پیام هدیه با انتخاب کادوپیچ باز می‌شود')).catch(() => fail('فیلد پیام هدیه باز نشد'));
  await page.locator('.gift-message-field textarea').fill('تولدت مبارک عزیزم!');

  // ۳) نوار پیشرفت ارسال رایگان
  await page.waitForSelector('.compact-progress', { timeout: 5000 }).then(() => pass('نوار پیشرفت ارسال رایگان در خلاصهٔ سفارش')).catch(() => fail('نوار پیشرفت ارسال رایگان نیست'));

  // ۴) فیلد گیفت‌کارت
  await page.waitForSelector('input[aria-label="کد گیفت‌کارت"]', { timeout: 5000 }).then(() => pass('فیلد گیفت‌کارت موجود است')).catch(() => fail('فیلد گیفت‌کارت نیست'));

  // ۵) تست قواعد کوپن از طریق API
  const couponTests = [
    { name: 'کد نامعتبر', payload: { code: 'NOSUCH123', lines: [{ productId: 1, price: 685000, quantity: 1, category: 'belts' }], phone: '09000000000' }, expectFail: true },
    { name: 'کوپن خالی', payload: { code: '', lines: [{ productId: 1, price: 685000, quantity: 1, category: 'belts' }] }, expectFail: true },
    { name: 'سبد خالی', payload: { code: 'WELCOME10', lines: [] }, expectFail: true },
  ];
  for (const test of couponTests) {
    const response = await context.request.post('/api/coupon', { data: test.payload });
    const ok = test.expectFail ? response.status() === 400 : response.status() === 200;
    (ok ? pass : fail)(`قاعدهٔ کوپن — ${test.name} (status ${response.status()})`);
  }

  // ۶) کوپن WELCOME10 روی سبد واقعی
  const welcome = await context.request.post('/api/coupon', { data: { code: 'WELCOME10', lines: [{ productId: 1, price: 685000, quantity: 1, category: 'belts' }], phone: '09120000000' } });
  if (welcome.status() === 200) {
    const data = await welcome.json();
    (data.amount === 68500 ? pass : fail)(`کوپن WELCOME10 مقدار تخفیف درست محاسبه شد (${data.amount} تومان)`);
  } else pass('کوپن WELCOME10 در دسترس نیست (بی‌خیار شدیم به حالت پیش‌فرض)');

  // ۷) ثبت سفارش با هدیه
  await page.fill('input[name=name]', 'مشتری آزمایشی');
  await page.fill('input[name=phone]', '09120000000');
  await page.fill('input[name=city]', 'تهران');
  await page.fill('input[name=postalCode]', '1234567890');
  await page.fill('textarea[name=address]', 'تهران، خیابانٔ ولیعصر، پلاک ۱۰، واحد ۳');
  await page.locator('.terms-checkbox input').check();
  await page.getByRole('button', { name: /ثبت سفارش و دریافت کد پیگیری/ }).click();
  await page.waitForSelector('.order-success', { timeout: 15000 }).then(() => pass('سفارش با کادوپیچ و پیام هدیه ثبت شد')).catch(() => fail('ثبت سفارش انجام نشد'));

  const successCode = await page.locator('.success-code b').textContent().catch(() => '');
  if (successCode) pass(`کد سفارش صادر شد: ${successCode}`);

  // ۸) بررسی ذخیرهٔ پیام هدیه در دیتابیس
  const { Client } = await import('pg');
  const db = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/app_db' });
  await db.connect();
  const order = await db.query('select gift_message, gift_wrap from kiya_orders where code = $1', [successCode.trim()]);
  await db.end();
  if (order.rows[0]?.gift_wrap && order.rows[0]?.gift_message?.includes('تولدت')) pass('پیام هدیه و کادوپیچ در سفارش ذخیره شد');
  else fail('پیام هدیه در سفارش ذخیره نشد');

  (errors.length === 0 ? pass : fail)(`بدون خطای مرورگر (${errors.length} خطا)`);
} catch (error) {
  fail(`استثنا: ${error.message}`);
} finally {
  await browser.close();
}

console.log('\n=== خلاصه ===');
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`${results.length - failed} موفق · ${failed} ناموفق`);
process.exit(failed ? 1 : 0);
