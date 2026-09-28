import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
await mkdir('.artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '.artifacts/home-desktop.png', fullPage: true });
  await page.screenshot({ path: '.artifacts/home-first-screen.png', fullPage: false });
  console.log('Desktop:', await page.title(), await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, brokenImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src), height: document.documentElement.scrollHeight })));
  await page.getByRole('button', { name: 'تغییر به تم روشن', exact: true }).click();
  await page.screenshot({ path: '.artifacts/home-light.png', fullPage: true });
  await page.getByRole('button', { name: 'تغییر به تم تاریک', exact: true }).click();
  await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '.artifacts/admin-setup.png', fullPage: true });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(base, { waitUntil: 'networkidle' });
  await mobile.evaluate(() => document.fonts.ready);
  await mobile.screenshot({ path: '.artifacts/home-mobile.png', fullPage: true });
  console.log('Mobile:', await mobile.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, width: document.documentElement.scrollWidth, viewport: innerWidth, brokenImages: [...document.images].filter(i => i.naturalWidth === 0).map(i => i.src) })));
  for (const route of ['/shop', '/product/classic-leather-belt', '/track', '/checkout']) {
    await mobile.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) errors.push(`Mobile horizontal overflow: ${route}`);
  }
  console.log('Browser errors:', errors);
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
