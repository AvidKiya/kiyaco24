import "server-only";
import { db } from "@/db";
import { products, settings, coupons, partnerTiers } from "@/db/schema";
import { seedProducts, defaultSettings, type Product, type ShopSettings } from "./catalog";
import { asc, eq } from "drizzle-orm";

let initialization: Promise<void> | null = null;
export async function ensureStore() {
  if (!initialization) {
    initialization = db.transaction(async tx => {
      const inserted = await tx.insert(settings).values(defaultSettings).onConflictDoNothing().returning();
      if (inserted.length) {
        await tx.insert(products).values(seedProducts.map(({ id: _id, ...product }) => product)).onConflictDoNothing();
        await tx.insert(coupons).values({ code: "WELCOME10", percent: 10, maxUses: 100 }).onConflictDoNothing();
        // لایه‌های پیش‌فرض همکاری عمده (فاز ۶) — مدیر می‌تواند از پنل تغییرشان دهد
        await tx.insert(partnerTiers).values([
          { key: "retail", name: "خرده‌فروشی", discountType: "percent", discountValue: 0, minOrder: 0, description: "قیمت ویترین؛ بدون تخفیف همکاری.", position: 0, active: true },
          { key: "wholesale", name: "عمده", discountType: "percent", discountValue: 15, minOrder: 5000000, description: "خرید عمدهٔ استاندارد با ۱۵٪ تخفیف.", position: 1, active: true },
          { key: "vip", name: "عمدهٔ ویژه (VIP)", discountType: "percent", discountValue: 25, minOrder: 15000000, description: "برای خریداران ثابت با ۲۵٪ تخفیف.", position: 2, active: true },
          { key: "distributor", name: "توزیع‌کننده", discountType: "percent", discountValue: 32, minOrder: 40000000, description: "نمایندگی شهر/استان با ۳۲٪ تخفیف.", position: 3, active: true },
          { key: "special", name: "همکار ویژه", discountType: "percent", discountValue: 40, minOrder: 0, description: "قیمت اختصاصی توافقی برای همکاران ویژه.", position: 4, active: true },
        ]).onConflictDoNothing();
      }
    }).catch(error => { initialization = null; throw error; });
  }
  await initialization;
}

export async function getStore(): Promise<{ products: Product[]; settings: ShopSettings }> {
  await ensureStore();
  const [catalog, preferences] = await Promise.all([
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.id)),
    db.select().from(settings).where(eq(settings.id, 1)),
  ]);
  const prefs = preferences[0] ?? defaultSettings;
  // فاز ۱۴ — مرچنت‌کد فقط سمت سرور لازم است؛ به HTML فروشگاه نشت نکند
  return { products: catalog.map(({ createdAt: _createdAt, ...product }) => product), settings: prefs.payment ? { ...prefs, payment: { ...prefs.payment, merchantId: "" } } : prefs };
}

export function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
    return new URL(origin).host === host;
  } catch { return false; }
}

const limits = new Map<string, { count: number; until: number }>();
export function allowRequest(key: string, maximum = 12, windowMs = 60000) {
  const now = Date.now();
  if (limits.size > 2000) for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  const entry = limits.get(key);
  if (!entry || entry.until < now) { limits.set(key, { count: 1, until: now + windowMs }); return true; }
  if (entry.count >= maximum) return false;
  entry.count++; return true;
}
export function clientIp(request: Request) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"; }
export function apiError(error: unknown, fallback = "مشکلی در ارتباط پیش آمد. دوباره تلاش کنید.") {
  console.error("Store request failed:", error instanceof Error ? error.message : "unknown error");
  return Response.json({ error: fallback }, { status: 500 });
}
