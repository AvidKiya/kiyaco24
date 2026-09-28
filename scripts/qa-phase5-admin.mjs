import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

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

const giftCode = 'QA' + randomBytes(3).toString('hex').toUpperCase();
const couponCode = 'QA' + randomBytes(3).toString('hex').toUpperCase();

try {
  // ── ورود به پنل ──
  await page.goto('/admin', { waitUntil: 'networkidle' });
  const pwFields = page.locator('input[type=password]');
  const pwCount = await pwFields.count();
  if (pwCount >= 2) {
    // حالت راه‌اندازی اولیه: تنظیم رمز عبور
    await pwFields.nth(0).fill(password);
    await pwFields.nth(1).fill(password);
    await page.getByRole('button', { name: /راه‌اندازی/ }).click();
    pass('راه‌اندازی اولیهٔ رمز ادمین انجام شد');
  } else {
    await pwFields.first().fill(password);
    await page.getByRole('button', { name: /ورود|ادامه/ }).click();
  }
  await page.waitForSelector('.admin-panel, .admin-sidebar', { timeout: 12000 }).then(() => pass('ورود به پنل ادمین')).catch(() => fail('ورود به پنل'));

  // ── ساخت کوپن پیشرفته (درصدی + سقف + حداقل سفارش) ──
  await page.locator('.admin-sidebar nav').getByRole('button', { name: /کوپن|تخفیف/ }).click();
  await page.getByRole('button', { name: 'کد تخفیف جدید' }).click();
  await page.waitForSelector('.picker-fieldset', { timeout: 8000 }).then(() => pass('ادیتور پیشرفتهٔ کوپن با محدودیت دسته/محصول باز شد')).catch(() => fail('ادیتور پیشرفتهٔ کوپن باز نشد'));
  await page.locator('.modal form input[dir=ltr]').first().fill(couponCode);
  await page.locator('.modal form input[type=number]').nth(2).fill('1000000'); // حداقل مبلغ سفارش
  await page.locator('.modal form input[type=number]').nth(3).fill('80000'); // سقف تخفیف
  await page.locator('.modal form input[type=checkbox]').nth(1).check(); // فقط اولین سفارش
  await page.locator('.modal form .picker-fieldset').first().locator('.filter-chip').first().click(); // محدودیت به اولین دسته
  await page.getByRole('button', { name: /ذخیرهٔ کد تخفیف/ }).click();
  await page.waitForTimeout(1200);
  const couponRow = await page.locator('.coupon-code', { hasText: couponCode }).count();
  (couponRow ? pass : fail)(`کوپن پیشرفته ثبت شد (${couponCode})`);

  // ── ساخت گیفت‌کارت ──
  await page.getByRole('button', { name: 'گیفت‌کارت جدید' }).click();
  await page.locator('.modal form input[dir=ltr]').first().fill(giftCode);
  await page.locator('.modal form input[type=number]').first().fill('250000');
  await page.getByRole('button', { name: /ذخیرهٔ گیفت‌کارت/ }).click();
  await page.waitForTimeout(1200);
  const giftRow = await page.locator('.gift-card-row code', { hasText: giftCode }).count();
  (giftRow ? pass : fail)(`گیفت‌کارت ساخته شد (${giftCode} · ۲۵۰٬۰۰۰ تومان)`);

  // ── تست قواعد پیشرفتهٔ کوپن از API ──
  // سبد پایین‌تر از حداقل مبلغ
  const lowOrder = await context.request.post('/api/coupon', { data: { code: couponCode, lines: [{ productId: 1, price: 500000, quantity: 1, category: 'belts' }], phone: '09120000000' } });
  (lowOrder.status() === 400 ? pass : fail)(`حداقل سفارش: سفارش ۵۰۰ هزار تومانی رد شد (status ${lowOrder.status()})`);
  const lowJson = await lowOrder.json();
  ((lowJson.error || '').includes('سفارش') && /[\u0600-\u06FF]/.test(lowJson.error || '') ? pass : fail)(`پیام خطای حداقل سفارش فارسی است: "${lowJson.error}"`);

  // سبد بالاتر از حداقل + سقف تخفیف
  const highOrder = await context.request.post('/api/coupon', { data: { code: couponCode, lines: [{ productId: 1, price: 1200000, quantity: 1, category: 'belts' }], phone: '09120000001' } });
  if (highOrder.status() === 200) {
    const data = await highOrder.json();
    (data.amount === 80000 ? pass : fail)(`سقف تخفیف اعمال شد (${data.amount} از ۱۲۰٬۰۰۰ تومان محاسبهٔ ۱۰٪)`);
  } else fail(`سفارش بالای حداقل ناموفق: ${(await highOrder.json()).error}`);

  // محدودیت دسته: سبد از دستهٔ دیگر
  const shopData = await (await context.request.get('/api/shop')).json();
  const otherCat = shopData.products.find(p => p.category !== shopData.products.find(x => x.id === 1)?.category)?.category || 'bags';
  const wrongCat = await context.request.post('/api/coupon', { data: { code: couponCode, lines: [{ productId: 2, price: 1200000, quantity: 1, category: otherCat }], phone: '09120000002' } });
  pass(`دستهٔ مقایسه‌ای انتخاب‌شده: ${otherCat}`);
  (wrongCat.status() === 400 ? pass : fail)(`محدودیت دسته: سبد دستهٔ bags رد شد (status ${wrongCat.status()})`);

  // ── استفاده از گیفت‌کارت در API کوپن ──
  const gcCheck = await context.request.post('/api/coupon', { data: { giftCard: giftCode, lines: [{ productId: 1, price: 3000000, quantity: 1, category: 'belts' }] } });
  (gcCheck.status() === 200 ? pass : fail)('بررسی گیفت‌کارت در تسویه پاسخ مثبت داد');

  const badGc = await context.request.post('/api/coupon', { data: { giftCard: 'ZZZZZZZZ', lines: [{ productId: 1, price: 3000000, quantity: 1 }] } });
  (badGc.status() === 400 ? pass : fail)('گیفت‌کارت نامعتبر رد می‌شود');

  // ── ثبت سفارش با اعتبار کامل ──
  const belt = (await (await context.request.get('/api/shop')).json()).products.find(x => x.id === 1);
  const order = await context.request.post('/api/orders', {
    headers: { Origin: base },
    data: {
      name: 'مشتری گیفت', phone: '09120000003', city: 'تهران', postalCode: '1234567890', address: 'تهران، خیابانٔ ولیعصر، پلاک ۱۰',
      items: [{ productId: 1, quantity: 1, size: belt.sizes?.[0] || "", color: belt.colors?.[0]?.name || "" }],
      couponCode: null, giftWrap: false, giftMessage: '', giftCard: giftCode,
      requestKey: crypto.randomUUID(),
    },
  });
  if (order.status() === 200) {
    const data = await order.json();
    pass(`سفارش با گیفت‌کارت ثبت شد: ${data.code} (پرداختی: ${data.total})`);
  } else fail(`ثبت سفارش با گیفت‌کارت: ${(await order.json()).error || order.status()}`);

  // ── بررسی کسر اعتبار در دیتابیس ──
  const { Client } = await import('pg');
  const db = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/app_db' });
  await db.connect();
  const cards = await db.query('select balance from kiya_gift_cards where code = $1', [giftCode]);
  const uses = await db.query('select * from kiya_gift_card_uses where code = $1', [giftCode]);
  await db.end();
  (Number(cards.rows[0]?.balance) === 0 ? pass : fail)(`اعتبار گیفت‌کارت پس از سفارش کسر شد (${cards.rows[0]?.balance})`);
  (uses.rows.length >= 1 ? pass : fail)('ثبت مصرف گیفت‌کارت در تاریخچه');

  (errors.length === 0 ? pass : fail)(`بدون خطای مرورگر (${errors.length})`);
} catch (error) {
  fail(`استثنا: ${error.message}`);
} finally {
  await browser.close();
}

const failed = results.filter(r => !r).length;
console.log(`\n=== خلاصه: ${results.length - failed} موفق · ${failed} ناموفق ===`);
process.exit(failed ? 1 : 0);
