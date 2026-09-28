import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { partnerTiers, partners } from "@/db/schema";
import { digits } from "@/lib/catalog";

export type PartnerTierRow = {
  id: number;
  key: string;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrder: number;
  description: string;
  position: number;
  active: boolean;
};

/** لایه‌های پیش‌فرض — اگر مدیر هیچ‌وقت لایه نساخته باشد هم سیستم کار می‌کند. */
export const defaultPartnerTiers: PartnerTierRow[] = [
  { id: 0, key: "retail", name: "خرده‌فروشی", discountType: "percent", discountValue: 0, minOrder: 0, description: "قیمت ویترین؛ بدون تخفیف همکاری.", position: 0, active: true },
  { id: 0, key: "wholesale", name: "عمده", discountType: "percent", discountValue: 15, minOrder: 5000000, description: "خرید عمدهٔ استاندارد با ۱۵٪ تخفیف.", position: 1, active: true },
  { id: 0, key: "vip", name: "عمدهٔ ویژه (VIP)", discountType: "percent", discountValue: 25, minOrder: 15000000, description: "برای خریداران ثابت با ۲۵٪ تخفیف.", position: 2, active: true },
  { id: 0, key: "distributor", name: "توزیع‌کننده", discountType: "percent", discountValue: 32, minOrder: 40000000, description: "نمایندگی شهر/استان با ۳۲٪ تخفیف.", position: 3, active: true },
  { id: 0, key: "special", name: "همکار ویژه", discountType: "percent", discountValue: 40, minOrder: 0, description: "قیمت اختصاصی توافقی برای همکاران ویژه.", position: 4, active: true },
];

export type TieredPrice = { unitPrice: number; discountPercent: number; tier: PartnerTierRow | null };

/** تبدیل ردیف دیتابیس لایه به تایپ ایمن (discountType را محدود می‌کند) */
export function normalizeTier(row: { id: number; key: string; name: string; discountType: string; discountValue: number; minOrder: number; description: string; position: number; active: boolean } | null | undefined): PartnerTierRow | null {
  if (!row) return null;
  return { ...row, discountType: row.discountType === "fixed" ? "fixed" : "percent" };
}

/** همهٔ لایه‌های فعال به‌ترتیب نمایش */
export async function getPartnerTiers(): Promise<PartnerTierRow[]> {
  try {
    const rows = await db.select().from(partnerTiers).where(eq(partnerTiers.active, true)).orderBy(partnerTiers.position);
    if (rows.length) return rows.map(normalizeTier) as PartnerTierRow[];
  } catch { /* اگر جدول آماده نبود، پیش‌فرض‌ها برمی‌گردند */ }
  return defaultPartnerTiers;
}

/** قیمت یک محصول برای یک لایهٔ مشخص */
export function tierPrice(retailPrice: number, tier: PartnerTierRow | null | undefined): TieredPrice {
  if (!tier || tier.discountValue <= 0) return { unitPrice: retailPrice, discountPercent: 0, tier: tier ?? null };
  if (tier.discountType === "fixed") {
    // قیمت ثابت: مقدار وارد‌شده قیمت نهایی هر قلم است
    const unit = Math.max(0, Math.min(tier.discountValue, retailPrice));
    return { unitPrice: unit, discountPercent: retailPrice ? Math.round(((retailPrice - unit) / retailPrice) * 100) : 0, tier };
  }
  const percent = Math.max(0, Math.min(90, tier.discountValue));
  const unit = Math.round((retailPrice * (100 - percent)) / 100);
  return { unitPrice: unit, discountPercent: percent, tier };
}

/** قیمت‌گذاری کامل کاتالوگ برای یک لایه */
export function priceCatalog<T extends { id: number; price: number }>(catalog: T[], tier: PartnerTierRow | null): (T & { partnerPrice: number; partnerDiscount: number })[] {
  return catalog.map(product => {
    const priced = tierPrice(product.price, tier);
    return { ...product, partnerPrice: priced.unitPrice, partnerDiscount: priced.discountPercent };
  });
}

export function tierMinOrder(tier: PartnerTierRow | null): number {
  return tier?.minOrder ?? 0;
}

/** آیا مجموع سبد از حداقل سفارش این لایه عبور کرده؟ */
export function meetsTierMinimum(subtotal: number, tier: PartnerTierRow | null): boolean {
  return subtotal >= tierMinOrder(tier);
}

/** برآورد تخفیف کل سبد بر اساس لایه */
export function tierSavings(lines: { price: number; quantity: number }[], tier: PartnerTierRow | null): { retail: number; partner: number; saving: number } {
  let retail = 0;
  let partner = 0;
  for (const line of lines) {
    const priced = tierPrice(line.price, tier);
    retail += line.price * line.quantity;
    partner += priced.unitPrice * line.quantity;
  }
  return { retail, partner, saving: retail - partner };
}

/** کد پیگیری سفارش عمده */
export function partnerOrderCode(): string {
  return `PB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** شمارهٔ فاکتور برای سفارش تأییدشده */
export function invoiceNumberFor(code: string): string {
  return `INV-${code.replace(/[^A-Z0-9]/gi, "")}`;
}

/** نرمال‌سازی شمارهٔ موبایل همکار */
export function partnerPhone(input: unknown): string {
  const value = digits(String(input ?? "")).replace(/^98/, "0").replace(/^9/, "09");
  return /^09\d{9}$/.test(value) ? value : "";
}

/** برچسب فارسی وضعیت همکار */
export function partnerStatusLabel(status: string): string {
  return ({ pending: "در انتظار بررسی", approved: "تأیید‌شده", rejected: "رد‌شده", suspended: "مسدود" } as Record<string, string>)[status] ?? status;
}

/** برچسب فارسی وضعیت سفارش عمده */
export function partnerOrderStatusLabel(status: string): string {
  return ({ pending: "در انتظار تأیید", confirmed: "تأیید شده", shipped: "ارسال شده", delivered: "تحویل شده", cancelled: "لغو شده" } as Record<string, string>)[status] ?? status;
}

/** شمارش سفارش‌های تأییدشدهٔ یک همکار (برای آمار پنل) */
export async function partnerOrderStats(partnerId: number): Promise<{ count: number; total: number; lastAt: string | null }> {
  try {
    const { partnerOrders } = await import("@/db/schema");
    const rows = await db.select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${partnerOrders.total}), 0)::int`,
      lastAt: sql<string | null>`max(${partnerOrders.createdAt})`,
    }).from(partnerOrders).where(and(eq(partnerOrders.partnerId, partnerId), eq(partnerOrders.status, "confirmed")));
    const row = rows[0];
    return { count: Number(row?.count ?? 0), total: Number(row?.total ?? 0), lastAt: row?.lastAt ? new Date(row.lastAt).toISOString() : null };
  } catch { return { count: 0, total: 0, lastAt: null }; }
}

/** لایهٔ پیش‌فرض برای همکار تازه (لایهٔ «خرده‌فروشی» یا اولین لایهٔ فعال) */
export async function defaultTierForNewPartner(): Promise<PartnerTierRow | null> {
  const tiers = await getPartnerTiers();
  return tiers.find(t => t.key === "retail") ?? tiers[0] ?? null;
}

/** بررسی اینکه شمارهٔ موبایل قبلاً درخواست داده یا نه */
export async function partnerExists(phone: string): Promise<boolean> {
  try {
    const rows = await db.select({ id: partners.id }).from(partners).where(eq(partners.phone, phone));
    return rows.length > 0;
  } catch { return false; }
}
