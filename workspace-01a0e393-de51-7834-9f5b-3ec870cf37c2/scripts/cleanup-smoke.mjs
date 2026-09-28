// Run with: node --experimental-strip-types scripts/cleanup-smoke.mjs
// Removes only the explicitly recorded test data, through the application's Drizzle client.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { eq, and, inArray, sql } from 'drizzle-orm';
const { db, pool } = await import('../src/db/index.ts');
const { products, orders, coupons, subscribers, messages, media, adminUsers, adminSessions, settings } = await import('../src/db/schema.ts');
try {
  const records = JSON.parse(await readFile('.artifacts/test-records.json', 'utf8'));
  const testPhone = '09000000000';
  if (records.phone !== testPhone) throw new Error('Unexpected test marker; refusing cleanup.');
  await db.transaction(async tx => {
    const testOrders = await tx.select().from(orders).where(and(eq(orders.phone, testPhone), eq(orders.customerName, 'آزمون خودکار کیا'))).for('update');
    for (const order of testOrders) {
      if (order.status !== 'cancelled') {
        for (const item of [...order.items].sort((a, b) => a.productId - b.productId)) await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}` }).where(eq(products.id, item.productId));
        if (order.coupon) await tx.update(coupons).set({ used: sql`greatest(0, ${coupons.used} - 1)` }).where(eq(coupons.code, order.coupon));
      }
      await tx.delete(orders).where(eq(orders.id, order.id));
    }
    const slugs = (records.productSlugs || []).filter(slug => /^qa-product-\d+$/.test(slug));
    if (slugs.length) await tx.delete(products).where(inArray(products.slug, slugs));
    if (records.mediaIds?.length) await tx.delete(media).where(inArray(media.id, records.mediaIds));
    await tx.delete(coupons).where(eq(coupons.code, 'QA10'));
    await tx.delete(subscribers).where(eq(subscribers.phone, testPhone));
    await tx.delete(messages).where(and(eq(messages.phone, testPhone), eq(messages.name, 'پیام آزمون خودکار')));
    if (records.createdAdmin) {
      const [admin] = await tx.select().from(adminUsers).where(eq(adminUsers.id, 1));
      if (admin) {
        const password = await readFile('/home/user/.kiya-qa-password', 'utf8');
        const [salt, hash] = admin.passwordHash.split(':');
        if (!timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 64))) throw new Error('Administrator credentials changed outside the test; refusing to remove account.');
        await tx.delete(adminSessions);
        await tx.delete(adminUsers).where(eq(adminUsers.id, 1));
      }
    }
    if (records.originalHeroTitle) {
      const [config] = await tx.select().from(settings).where(eq(settings.id, 1));
      if (config.heroTitle === 'جزئیات خاص،') await tx.update(settings).set({ heroTitle: records.originalHeroTitle }).where(eq(settings.id, 1));
    }
  });
  console.log('Recorded test orders, uploads, products, subscriber and message removed; stock restored.');
  console.log(records.createdAdmin ? 'Temporary test administrator removed. First-run setup is available for the owner.' : 'Existing administrator preserved.');
} finally { await pool.end(); }
