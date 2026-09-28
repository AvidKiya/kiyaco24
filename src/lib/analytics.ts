import { db } from "@/db";
import { events } from "@/db/schema";
import { sql } from "drizzle-orm";

/* ============================================================
 *  فاز ۱۵ — آنالیتیکس داخلی و هوش تجاری (BI)
 *  همه‌چیز روی همین دیتابیس؛ بدون سرویس خارجی و بدون کوکی ردیابی
 * ============================================================ */

export const eventTypes = ["view_product", "add_to_cart", "begin_checkout", "purchase", "search", "wishlist", "view_article", "view_guide", "view_collection", "wholesale_request"] as const;
export type EventType = (typeof eventTypes)[number];

export async function recordEvent(type: EventType, ref = "", value = 0) {
  await db.insert(events).values({ type, ref: ref.slice(0, 160), value: Number.isSafeInteger(value) && value > 0 ? value : 0 });
}

const eventLabels: Record<string, string> = {
  view_product: "بازدید محصول", add_to_cart: "افزودن به سبد", begin_checkout: "شروع پرداخت", purchase: "خرید",
  search: "جستجو", wishlist: "علاقه‌مندی", view_article: "بازدید مقاله", view_guide: "بازدید راهنما",
  view_collection: "بازدید کالکشن", wholesale_request: "درخواست عمده",
};

/** داشبورد BI — بازهٔ پیش‌فرض ۳۰ روز اخیر */
export async function getBiDashboard(days = 30) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const [revenueRows, funnelRows, topSold, lowSold, topViewed, topSearches, retailRow, wholesaleRow, customerRows, repeatRow, cartRow, eventTotals] = await Promise.all([
    /* درآمد روزانهٔ سفارش‌های پرداخت‌شده */
    db.execute(sql`select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as orders, coalesce(sum(total),0)::bigint as revenue
      from kiya_orders where payment_status='paid' and status<>'cancelled' and created_at >= ${since} group by 1 order by 1`),
    /* قیف فروش از رویدادها */
    db.execute(sql`select type, count(*)::int as c from kiya_events where created_at >= ${since} group by type`),
    /* پرفروش‌ها از آیتم‌های سفارش */
    db.execute(sql`select item->>'name' as name, item->>'productId' as product_id, sum((item->>'quantity')::int)::int as sold, sum(((item->>'quantity')::int)*((item->>'price')::int))::bigint as revenue
      from kiya_orders o, jsonb_array_elements(o.items) item where o.status<>'cancelled' and o.created_at >= ${since} group by 1,2 order by sold desc limit 8`),
    /* کم‌فروش‌ها: محصولات فعال با کمترین فروش (شامل صفر) */
    db.execute(sql`select p.name, p.slug, p.stock, coalesce(s.sold,0)::int as sold from kiya_products p
      left join (select (item->>'productId')::int as pid, sum((item->>'quantity')::int)::int as sold from kiya_orders o, jsonb_array_elements(o.items) item where o.status<>'cancelled' and o.created_at >= ${since} group by 1) s on s.pid = p.id
      where p.active = true order by sold asc, p.id asc limit 6`),
    /* پربازدیدها */
    db.execute(sql`select ref, count(*)::int as views from kiya_events where type='view_product' and created_at >= ${since} group by ref order by views desc limit 8`),
    /* جستجوهای پرتکرار */
    db.execute(sql`select ref, count(*)::int as c from kiya_events where type='search' and ref <> '' and created_at >= ${since} group by ref order by c desc limit 8`),
    /* خرده‌فروشی و عمده */
    db.execute(sql`select count(*)::int as orders, coalesce(sum(total),0)::bigint as revenue, coalesce(avg(total),0)::bigint as aov from kiya_orders where payment_status='paid' and status<>'cancelled' and created_at >= ${since}`),
    db.execute(sql`select count(*)::int as orders, coalesce(sum(total),0)::bigint as revenue from kiya_partner_orders where status<>'cancelled' and created_at >= ${since}`),
    /* ارزش طول عمر مشتری */
    db.execute(sql`select name, phone, total_spent, order_count, wallet_balance from kiya_customers where order_count > 0 order by total_spent desc limit 6`),
    db.execute(sql`select count(*) filter (where order_count > 1)::int as repeat, count(*) filter (where order_count > 0)::int as buyers from kiya_customers`),
    db.execute(sql`select count(*)::int as c from kiya_abandoned_carts where recovered_at is null`),
    db.execute(sql`select type, count(*)::int as c, coalesce(sum(value),0)::bigint as v from kiya_events group by type`),
  ]);

  const funnel: Record<string, number> = {};
  for (const row of funnelRows.rows as { type: string; c: number }[]) funnel[row.type] = row.c;
  const retail = (retailRow.rows[0] || { orders: 0, revenue: 0, aov: 0 }) as { orders: number; revenue: string | number; aov: string | number };
  const wholesale = (wholesaleRow.rows[0] || { orders: 0, revenue: 0 }) as { orders: number; revenue: string | number };
  const repeat = (repeatRow.rows[0] || { repeat: 0, buyers: 0 }) as { repeat: number; buyers: number };
  const views = funnel.view_product || 0;
  const purchases = funnel.purchase || 0;

  return {
    days,
    revenueByDay: (revenueRows.rows as { day: string; orders: number; revenue: string }[]).map(r => ({ day: r.day, orders: r.orders, revenue: Number(r.revenue) })),
    totals: {
      revenue: Number(retail.revenue), orders: Number(retail.orders), aov: Number(retail.aov),
      wholesaleRevenue: Number(wholesale.revenue), wholesaleOrders: Number(wholesale.orders),
      conversion: views > 0 ? Math.round((purchases / views) * 1000) / 10 : 0,
      repeatRate: repeat.buyers > 0 ? Math.round((repeat.repeat / repeat.buyers) * 1000) / 10 : 0,
      openCarts: Number((cartRow.rows[0] as { c: number })?.c || 0),
    },
    funnel: ["view_product", "add_to_cart", "begin_checkout", "purchase"].map(key => ({ key, label: eventLabels[key], count: funnel[key] || 0 })),
    topSold: (topSold.rows as { name: string; product_id: string; sold: number; revenue: string }[]).map(r => ({ name: r.name, sold: r.sold, revenue: Number(r.revenue) })),
    lowSold: (lowSold.rows as { name: string; slug: string; stock: number; sold: number }[]),
    topViewed: (topViewed.rows as { ref: string; views: number }[]),
    topSearches: (topSearches.rows as { ref: string; c: number }[]).map(r => ({ term: r.ref, count: r.c })),
    topCustomers: (customerRows.rows as { name: string; phone: string; total_spent: string; order_count: number; wallet_balance: string }[]).map(r => ({ name: r.name, phone: r.phone, totalSpent: Number(r.total_spent), orderCount: r.order_count })),
    eventTotals: (eventTotals.rows as { type: string; c: number; v: string }[]).map(r => ({ type: r.type, label: eventLabels[r.type] || r.type, count: r.c })),
  };
}
