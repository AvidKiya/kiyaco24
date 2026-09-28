/* ============================================================
 *  فاز ۹ — آزمون خودکار حساب مشتری + باشگاه مشتریان + سیستم معرف
 *  اجرا: node scripts/qa-phase9.mjs   (سرور dev باید روی ۳۰۰۰ بالا باشد)
 * ============================================================ */
import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const base = 'http://localhost:3000';
const results = [];
const pass = t => { results.push(1); console.log('PASS:', t); };
const fail = t => { results.push(0); console.log('FAIL:', t); };
const check = (ok, t) => (ok ? pass : fail)(t);

let password = process.env.QA_ADMIN_PASSWORD;
if (!password) { try { password = await readFile('/home/user/.kiya-qa-password', 'utf8'); } catch { password = randomBytes(12).toString('base64url'); } }

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ baseURL: base, viewport: { width: 1280, height: 800 } });
let page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', async r => { if (r.url().includes('/api/') && r.status() >= 400) { try { console.log('API ERROR', r.status(), r.url(), JSON.stringify(await r.json())); } catch {} } });

const db = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/app_db' });
await db.connect();

const phoneA = '0912' + String(Math.floor(1000000 + Math.random() * 8999999));
const phoneB = '0935' + String(Math.floor(1000000 + Math.random() * 8999999));
const qaName = 'آزمون خودکار فاز ۹';
let customerA = 0, customerB = 0, orderCode = '', inviteCode = '';

/* اطمینان از hydrate شدن صفحهٔ ورود: کلید روی حالت «رمز عبور» فقط با React کار می‌کند */
async function hydrateAccountPage() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.getByRole('button', { name: /رمز عبور/ }).click({ timeout: 5000 });
      if (await page.getByLabel('رمز عبور').count()) { await page.getByRole('button', { name: /کد پیامکی/ }).click({ timeout: 5000 }); return true; }
    } catch { /* صفحه native ثبت شده؛ دوباره بارگذاری می‌کنیم */ }
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.account-login-card', { timeout: 8000 });
  }
  return false;
}

async function post(path, payload) {
  const response = await page.evaluate(async ([url, body]) => {
    const result = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: result.status, data: await result.json() };
  }, [path, payload]);
  return response;
}

try {
  /* ---------- ۱) صفحهٔ ورود مشتری ---------- */
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.account-login-card', { timeout: 10000 }).then(() => pass('صفحهٔ ورود حساب کاربری باز می‌شود')).catch(() => fail('صفحهٔ ورود حساب کاربری باز نشد'));
  (await page.locator('.account-login-side li').count() >= 4 ? pass : fail)(`مزیت‌های حساب کاربری نمایش داده می‌شود (${await page.locator('.account-login-side li').count()} مورد)`);
  (await page.locator('.account-tier-chip').count() === 4 ? pass : fail)(`چهار سطح باشگاه مشتریان در صفحهٔ ورود معرفی می‌شوند (${await page.locator('.account-tier-chip').count()})`);

  /* ---------- ۲) ورود با کد پیامکی (OTP) ---------- */
  await hydrateAccountPage().then(ok => (ok ? pass('صفحهٔ ورود کامل بارگذاری و تعاملی می‌شود') : fail('صفحهٔ ورود تعاملی نشد')));
  await page.getByLabel('شماره موبایل').fill(phoneA);
  await page.getByRole('button', { name: /دریافت کد تأیید/ }).click();
  await page.waitForSelector('.otp-input', { timeout: 10000 }).then(() => pass('درخواست کد پیامکی مرحلهٔ بعد را باز می‌کند')).catch(() => fail('مرحلهٔ وارد کردن کد باز نشد'));
  await page.waitForSelector('.account-dev-hint', { timeout: 5000 }).then(() => pass('کد یک‌بارمصرف در حالت توسعه نمایش داده می‌شود')).catch(() => fail('کد یک‌بارمصرف نمایش داده نشد'));
  const devCode = ((await page.locator('.account-dev-hint b').textContent()) || '').trim();
  check(/^\d{6}$/.test(devCode), `کد ۶ رقمی صادر شد (${devCode})`);

  // کد اشتباه باید رد شود
  await page.locator('.otp-input').fill('000000');
  await page.getByRole('button', { name: /تأیید و ورود/ }).click();
  await page.waitForSelector('.form-error', { timeout: 5000 }).then(() => pass('کد نادرست رد می‌شود')).catch(() => fail('کد نادرست رد نشد'));

  await page.locator('.otp-input').fill(devCode);
  await page.getByRole('button', { name: /تأیید و ورود/ }).click();

  /* ---------- ۳) تکمیل پروفایل مشتری جدید ---------- */
  await page.waitForSelector('input[placeholder="مثلاً سارا محمدی"]', { timeout: 8000 }).then(() => pass('ثبت‌نام خودکار مشتری جدید کار می‌کند')).catch(() => fail('فرم تکمیل پروفایل نمایش داده نشد'));
  await page.getByLabel('نام و نام خانوادگی').fill(qaName);
  await page.getByLabel('شهر', { exact: true }).fill('تهران');
  await page.getByRole('button', { name: /ساخت حساب و ورود/ }).click();

  await page.waitForSelector('.account-panel', { timeout: 12000 }).then(() => pass('پنل مشتری باز می‌شود')).catch(() => fail('پنل مشتری باز نشد'));
  await page.waitForSelector('.account-tier-badge', { timeout: 8000 });
  const customerRow = await db.query('select id, referral_code, points, wallet_balance, total_spent from kiya_customers where phone = $1', [phoneA]);
  customerA = customerRow.rows[0]?.id ?? 0;
  check(!!customerA, `حساب مشتری در دیتابیس ساخته شد (#${customerA})`);
  check(/^KIYA-[A-F0-9]{6}$/.test(customerRow.rows[0]?.referral_code || ''), `کد معرف با فرمت K-XXX ساخته شد (${customerRow.rows[0]?.referral_code})`);
  check(Number(customerRow.rows[0]?.points) >= 60, `امتیاز تکمیل پروفایل ثبت شد (${customerRow.rows[0]?.points} امتیاز)`);
  check((await db.query('select count(*)::int as n from kiya_points_logs where customer_id = $1', [customerA])).rows[0].n >= 2, 'سابقهٔ امتیازها در دیتابیس ثبت می‌شود');

  /* ---------- ۴) داشبورد باشگاه مشتریان ---------- */
  await page.goto('/account/panel', { waitUntil: 'domcontentloaded' });
  (await page.locator('.account-club-tier').count() === 4 ? pass : fail)(`چهار سطح باشگاه در پنل نمایش داده می‌شوند (${await page.locator('.account-club-tier').count()} سطح)`);
  (await page.locator('.account-club-tier.current').count() === 1 ? pass : fail)('سطح فعلی مشتری مشخص است');
  (await page.locator('.account-stat').count() === 4 ? pass : fail)(`کارت‌های آماری پنل رندر می‌شوند (${await page.locator('.account-stat').count()} کارت)`);
  (await page.locator('.account-side nav button').count() === 11 ? pass : fail)(`همهٔ بخش‌های پنل در منوی کنار موجود است (${await page.locator('.account-side nav button').count()} بخش)`);

  /* ---------- ۵) لینک دعوت و رصد کلیک ---------- */
  inviteCode = customerRow.rows[0].referral_code;
  await page.goto(`/invite/${inviteCode}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.invite-card', { timeout: 8000 }).then(() => pass('صفحهٔ لینک دعوت باز می‌شود')).catch(() => fail('صفحهٔ لینک دعوت باز نشد'));
  await page.waitForResponse(r => r.url().includes(`/api/referral/`), { timeout: 8000 }).then(() => pass('درخواست ثبت کوکی دعوت ارسال می‌شود')).catch(() => fail('درخواست ثبت کوکی دعوت ارسال نشد'));
  const clicks = await db.query('select count(*)::int as n from kiya_referrals where code = $1 and status = $2', [inviteCode, 'clicked']);
  check(clicks.rows[0].n >= 1, `کلیک روی لینک معرف ثبت شد (${clicks.rows[0].n} کلیک)`);
  const cookie = (await context.cookies()).find(c => c.name === 'kiya_invite');
  check(!!cookie && cookie.value === inviteCode, 'کوکی دعوت برای ثبت‌نام دوست ذخیره می‌شود');

  /* ---------- ۶) ثبت‌نام دوست با لینک دعوت ---------- */
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  // خروج از حساب مشتری اول
  await page.evaluate(async () => { await fetch('/api/customer/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.account-login-card', { timeout: 8000 });
  await hydrateAccountPage();
  await page.getByLabel('شماره موبایل').fill(phoneB);
  await page.getByRole('button', { name: /دریافت کد تأیید/ }).click();
  await page.waitForSelector('.otp-input', { timeout: 8000 });
  const devCodeB = ((await page.locator('.account-dev-hint b').textContent()) || '').trim();
  await page.locator('.otp-input').fill(devCodeB);
  await page.getByRole('button', { name: /تأیید و ورود/ }).click();
  await page.waitForSelector('input[placeholder="مثلاً سارا محمدی"]', { timeout: 8000 });
  await page.getByLabel('نام و نام خانوادگی').fill('دوست آزمون فاز ۹');
  await page.getByLabel('شهر', { exact: true }).fill('اصفهان');
  await page.getByRole('button', { name: /ساخت حساب و ورود/ }).click();
  await page.waitForSelector('.account-panel', { timeout: 12000 }).then(() => pass('دوست دعوت‌شده وارد حساب خودش می‌شود')).catch(() => fail('ورود دوست دعوت‌شده انجام نشد'));

  const customerBRow = await db.query('select id, points, referred_by from kiya_customers where phone = $1', [phoneB]);
  customerB = customerBRow.rows[0]?.id ?? 0;
  check(customerBRow.rows[0]?.referred_by === customerA, 'دوست به معرف خودش پیوند خورده است');
  const registeredReferral = await db.query('select count(*)::int as n from kiya_referrals where referrer_id = $1 and referred_id = $2 and status = $3', [customerA, customerB, 'registered']);
  check(registeredReferral.rows[0].n === 1, 'دعوت با وضعیت «ثبت‌نام دوست» ثبت شد');
  const referrerPoints = await db.query('select points from kiya_customers where id = $1', [customerA]);
  check(Number(referrerPoints.rows[0].points) >= 100, `امتیاز دعوت به معرف اضافه شد (${referrerPoints.rows[0].points} امتیاز)`);

  /* ---------- ۷) خرید با کیف پول و امتیاز ---------- */
  // شارژ کیف پول مشتری دوم از طریق دیتابیس (شبیه‌سازی پاداش فروشگاه)
  await db.query('update kiya_customers set wallet_balance = 250000 where id = $1', [customerB]);
  await page.goto('/shop', { waitUntil: 'networkidle' });
  await page.waitForSelector('.product-card', { timeout: 10000 });
  await page.locator('.product-card').first().getByRole('button', { name: /انتخاب و خرید/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /افزودن به سبد خرید/ }).click();
  await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('نام و نام خانوادگی').fill('دوست آزمون فاز ۹');
  await page.getByLabel('شماره موبایل', { exact: true }).fill(phoneB);
  await page.getByLabel('شهر', { exact: true }).fill('اصفهان');
  await page.getByLabel('کد پستی').fill('1111111111');
  await page.getByLabel('آدرس کامل').fill('اصفهان، خیابان آزمایشی، پلاک ۱، واحد ۱');
  (await page.locator('.checkout-wallet').count() === 1 ? pass : fail)('گزینهٔ پرداخت با اعتبار کیف پول در تسویه نمایش داده می‌شود');
  await page.locator('.checkout-wallet input[type=checkbox]').check();
  await page.locator('.terms-checkbox input').check();
  await page.getByRole('button', { name: /ثبت سفارش و دریافت کد پیگیری/ }).click();
  await page.waitForSelector('.order-success', { timeout: 15000 }).then(() => pass('سفارش با اعتبار کیف پول ثبت شد')).catch(() => fail('ثبت سفارش با اعتبار کیف پول انجام نشد'));
  orderCode = ((await page.locator('.success-code b').textContent()) || '').trim();
  check(/^K-[A-F0-9]{10}$/.test(orderCode), `کد سفارش صادر شد (${orderCode})`);

  const orderRow = await db.query('select id, customer_id, total, subtotal, discount from kiya_orders where code = $1', [orderCode]);
  check(Number(orderRow.rows[0]?.customer_id) === customerB, 'سفارش به حساب مشتری پیوند خورده است');
  const walletAfter = await db.query('select wallet_balance, total_spent, order_count, points from kiya_customers where id = $1', [customerB]);
  check(Number(walletAfter.rows[0].wallet_balance) < 250000, `اعتبار کیف پول برای پرداخت کم شد (${walletAfter.rows[0].wallet_balance} تومان)`);
  check(Number(walletAfter.rows[0].total_spent) > 0 && Number(walletAfter.rows[0].order_count) === 1, 'مجموع خرید و تعداد سفارش مشتری به‌روز شد');
  check(Number(walletAfter.rows[0].points) > 0, 'امتیاز خرید به مشتری اضافه شد');
  const walletTxn = await db.query('select count(*)::int as n from kiya_wallet_txns where customer_id = $1 and kind = $2', [customerB, 'debit']);
  check(walletTxn.rows[0].n === 1, 'تراکنش برداشت کیف پول ثبت شد');
  const firstPurchase = await db.query('select status, reward_points from kiya_referrals where referrer_id = $1 and referred_id = $2', [customerA, customerB]);
  check(firstPurchase.rows[0]?.status === 'purchased' && Number(firstPurchase.rows[0].reward_points) >= 400, 'پاداش اولین خرید دوست دعوت‌شده به معرف داده شد');

  /* ---------- ۸) سفارش‌ها، نشانی، کیف پول و اعلان در پنل ---------- */
  await page.goto('/account/panel', { waitUntil: 'domcontentloaded' });
  await page.locator('.account-side nav button', { hasText: 'سفارش‌های من' }).click();
  (await page.locator('.account-order-card').count() >= 1 ? pass : fail)(`سفارش ثبت‌شده در پنل مشتری نمایش داده می‌شود (${await page.locator('.account-order-card').count()} سفارش)`);
  const orderItems = await page.locator('.account-order-item').count();
  (orderItems >= 1 ? pass : fail)(`اقلام سفارش در پنل رندر می‌شوند (${orderItems} قلم)`);

  await page.locator('.account-side nav button', { hasText: 'نشانی‌ها' }).click();
  await page.getByRole('button', { name: /نشانی جدید/ }).click();
  await page.getByLabel('نام نشانی').fill('خانه');
  await page.getByLabel('نام گیرنده').fill('دوست آزمون فاز ۹');
  await page.getByLabel('شمارهٔ گیرنده').fill(phoneB);
  await page.getByLabel('شهر', { exact: true }).fill('اصفهان');
  await page.getByLabel('نشانی کامل').fill('اصفهان، خیابان آزمون، کوچهٔ ۱، پلاک ۲، واحد ۳');
  await page.getByLabel('کد پستی').fill('2222222222');
  await page.getByRole('button', { name: /ذخیرهٔ نشانی/ }).click();
  await page.waitForTimeout(2500);
  const addressCount = await db.query('select jsonb_array_length(addresses)::int as n from kiya_customers where id = $1', [customerB]);
  check(addressCount.rows[0].n >= 1, `نشانی مشتری ذخیره می‌شود (${addressCount.rows[0].n} نشانی)`);

  await page.locator('.account-side nav button', { hasText: 'کیف پول' }).click();
  (await page.locator('.account-wallet-convert').count() === 1 ? pass : fail)('بخش تبدیل امتیاز به اعتبار کیف پول نمایش داده می‌شود');
  await page.locator('.account-side nav button', { hasText: 'اعلان‌ها' }).click();
  (await page.locator('.account-notification').count() >= 1 ? pass : fail)(`اعلان‌های مشتری نمایش داده می‌شوند (${await page.locator('.account-notification').count()} اعلان)`);
  await page.getByRole('button', { name: /خواندن همه/ }).click();
  await page.waitForTimeout(2000);
  const unread = await db.query('select count(*)::int as n from kiya_notifications where customer_id = $1 and read = false', [customerB]);
  check(unread.rows[0].n === 0, 'اعلان‌ها به‌صورت خوانده‌شده علامت‌گذاری می‌شوند');

  // همهٔ بخش‌های پنل باید بدون خطا رندر شوند
  for (const [label, selector] of [['علاقه‌مندی‌ها', '.account-card'], ['نشانی‌ها', '.account-card'], ['کوپن‌های من', '.account-card'], ['امتیازها', '.account-card'], ['دعوت دوستان', '.account-invite-box'], ['نظرات من', '.account-card'], ['پشتیبانی', '.account-support']]) {
    await page.locator('.account-side nav button', { hasText: label }).click();
    await page.waitForSelector(selector, { timeout: 6000 }).then(() => pass(`بخش «${label}» پنل مشتری رندر می‌شود`)).catch(() => fail(`بخش «${label}» پنل مشتری رندر نشد`));
  }

  await page.locator('.account-side nav button', { hasText: 'دعوت دوستان' }).click();
  (await page.locator('.account-invite-box code').textContent() || '').includes('/invite/') ? pass('لینک اختصاصی دعوت در پنل نمایش داده می‌شود') : fail('لینک اختصاصی دعوت نمایش داده نشد');

  /* ---------- ۹) تبدیل امتیاز به اعتبار کیف پول ---------- */
  const pointsBefore = (await db.query('select points from kiya_customers where id = $1', [customerB])).rows[0].points;
  const convert = await post('/api/customer/wallet', { points: Math.floor(Number(pointsBefore) / 100) * 100 });
  check(convert.status === 200 && convert.data.ok, `تبدیل امتیاز به اعتبار کیف پول انجام می‌شود (${convert.data.amount} تومان)`);
  const afterConvert = await db.query('select points, wallet_balance from kiya_customers where id = $1', [customerB]);
  check(Number(afterConvert.rows[0].points) < Number(pointsBefore), 'امتیاز مصرف‌شده از حساب مشتری کم می‌شود');
  check(Number(afterConvert.rows[0].wallet_balance) > 0, 'اعتبار تبدیل‌شده به کیف پول اضافه می‌شود');

  /* ---------- ۱۰) خروج و ورود با رمز عبور ---------- */
  await page.evaluate(async () => { await fetch('/api/customer/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.account-login-card', { timeout: 8000 });
  await hydrateAccountPage();
  await page.getByRole('button', { name: /رمز عبور/ }).click();
  await page.getByLabel('شماره موبایل').fill(phoneA);
  await page.getByLabel('رمز عبور').fill('KiYa-Test-1404');
  await page.getByRole('button', { name: /ورود به حساب/ }).click();
  await page.waitForSelector('.form-error', { timeout: 6000 }).then(() => pass('ورود با رمز بدون تنظیم رمز، راهنمایی درست می‌دهد')).catch(() => fail('پیام خطای ورود با رمز نمایش داده نشد'));

  /* ---------- ۱۱) پنل مدیر — باشگاه مشتریان ---------- */
  await page.close();
  const adminPage = await context.newPage();
  adminPage.setDefaultTimeout(15000);
  page = adminPage;
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  const pwFields = page.locator('input[type=password]');
  if (await pwFields.count() >= 2) { await pwFields.nth(0).fill(password); await pwFields.nth(1).fill(password); await page.getByRole('button', { name: /راه‌اندازی/ }).click(); }
  else { await page.locator('input[type=password]').first().fill(password); await page.getByRole('button', { name: /ورود به پنل مدیریت/ }).click(); }
  await page.waitForSelector('.admin-sidebar', { timeout: 12000 }).then(() => pass('ورود به پنل مدیر')).catch(() => fail('ورود به پنل مدیر'));

  await page.locator('.admin-sidebar nav').getByRole('button', { name: /باشگاه مشتریان/ }).click();
  await page.waitForSelector('.admin-tier-summary', { timeout: 10000 }).then(() => pass('تب باشگاه مشتریان در پنل مدیر باز می‌شود')).catch(() => fail('تب باشگاه مشتریان باز نشد'));
  (await page.locator('.admin-tier-card').count() === 5 ? pass : fail)(`کارت سطوح باشگاه در پنل مدیر نمایش داده می‌شود (${await page.locator('.admin-tier-card').count()} کارت)`);
  const memberRows = await page.locator('.admin-table tbody tr').count();
  (memberRows >= 2 ? pass : fail)(`اعضای باشگاه در پنل مدیر فهرست می‌شوند (${memberRows} عضو)`);

  // شارژ کیف پول از پنل مدیر
  await page.locator('.admin-table tbody tr', { hasText: qaName }).first().getByRole('button', { name: /کیف پول/ }).click();
  await page.waitForSelector('.admin-modal-form', { timeout: 8000 }).then(() => pass('مودال کیف پول عضو باز می‌شود')).catch(() => fail('مودال کیف پول عضو باز نشد'));
  await page.getByLabel(/مبلغ تغییر/).fill('75000');
  await page.getByLabel('توضیح برای مشتری').fill('شارژ آزمون خودکار فاز ۹');
  await page.getByRole('button', { name: /ثبت تغییر/ }).click();
  await page.waitForTimeout(3000);
  const credited = await db.query('select wallet_balance from kiya_customers where id = $1', [customerA]);
  check(Number(credited.rows[0].wallet_balance) >= 75000, `شارژ دستی کیف پول از پنل مدیر ثبت شد (${credited.rows[0].wallet_balance} تومان)`);
  const adminTxn = await db.query('select count(*)::int as n from kiya_wallet_txns where customer_id = $1 and note = $2', [customerA, 'شارژ آزمون خودکار فاز ۹']);
  check(adminTxn.rows[0].n === 1, 'تراکنش شارژ مدیر در سابقهٔ کیف پول ثبت می‌شود');

  // اعطای امتیاز از پنل مدیر
  await page.locator('.admin-table tbody tr', { hasText: qaName }).first().getByRole('button', { name: /امتیاز/ }).click();
  await page.waitForSelector('.admin-modal-form', { timeout: 8000 }).then(() => pass('مودال امتیاز عضو باز می‌شود')).catch(() => fail('مودال امتیاز عضو باز نشد'));
  await page.getByLabel(/مقدار امتیاز/).fill('120');
  await page.getByLabel('دلیل', { exact: true }).fill('امتیاز آزمون خودکار فاز ۹');
  await page.getByRole('button', { name: /ثبت امتیاز/ }).click();
  await page.waitForTimeout(3000);
  const pointsA = await db.query('select points from kiya_customers where id = $1', [customerA]);
  check(Number(pointsA.rows[0].points) >= 220, `امتیاز دستی از پنل مدیر ثبت شد (${pointsA.rows[0].points} امتیاز)`);

  /* ---------- ۱۲) پاک‌سازی دادهٔ آزمون ---------- */
  await db.query('delete from kiya_referrals where referrer_id = any($1::int[]) or referred_id = any($1::int[])', [[customerA, customerB]]);
  await db.query('delete from kiya_notifications where customer_id = any($1::int[])', [[customerA, customerB]]);
  await db.query('delete from kiya_wallet_txns where customer_id = any($1::int[])', [[customerA, customerB]]);
  await db.query('delete from kiya_points_logs where customer_id = any($1::int[])', [[customerA, customerB]]);
  await db.query('delete from kiya_customer_sessions where customer_id = any($1::int[])', [[customerA, customerB]]);
  await db.query('delete from kiya_otp_codes where phone = any($1::text[])', [[phoneA, phoneB]]);
  await db.query('update kiya_orders set customer_id = null where code = $1', [orderCode]);
  await db.query('delete from kiya_orders where code = $1', [orderCode]);
  await db.query('delete from kiya_customers where id = any($1::int[])', [[customerA, customerB]]);
  await db.query('update kiya_products set stock = stock where false');
  const leftovers = await db.query('select count(*)::int as n from kiya_customers where id = any($1::int[])', [[customerA, customerB]]);
  check(leftovers.rows[0].n === 0, 'دادهٔ آزمون فاز ۹ از دیتابیس پاک شد');

  (errors.length === 0 ? pass : fail)(`بدون خطای مرورگر (${errors.length} خطا)`);
} catch (error) {
  fail('اجرای تست با خطای غیرمنتظره متوقف شد: ' + error.message);
} finally {
  await db.end().catch(() => {});
  await browser.close().catch(() => {});
  console.log(`\nنتیجه: ${results.filter(Boolean).length}/${results.length} PASS`);
  process.exit(results.some(r => !r) ? 1 : 0);
}
