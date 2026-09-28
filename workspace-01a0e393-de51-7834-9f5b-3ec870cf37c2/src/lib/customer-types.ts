/* ============================================================
 *  فاز ۹ — حساب مشتری + باشگاه مشتریان + معرف
 *  انواع و قواعد (ایمن برای کلاینت و سرور)
 * ============================================================ */

export type CustomerTier = "bronze" | "silver" | "gold" | "vip";

export type CustomerAddress = {
  id: string; label: string; receiver: string; phone: string; city: string; address: string; postalCode: string;
};

export type Customer = {
  id: number; phone: string; name: string; birthDate: string; city: string; email: string;
  addresses: CustomerAddress[];
  walletBalance: number; points: number; lifetimePoints: number; totalSpent: number;
  orderCount: number; reviewCount: number; referralCode: string; referredBy: number | null;
  createdAt: Date; lastLoginAt: Date | null;
};

/* ============================================================
 *  باشگاه مشتریان — سطوح و پاداش‌ها
 * ============================================================ */

export const clubTiers: {
  id: CustomerTier; name: string; en: string; minSpent: number; color: string;
  perks: string[]; welcomeCoupon: number; pointMultiplier: number;
}[] = [
  {
    id: "bronze", name: "برنزی", en: "BRONZE", minSpent: 0, color: "#a5713f",
    perks: ["عضویت در باشگاه مشتریان کیا", "امتیاز برای هر خرید و هر نظر", "دسترسی به کالکشن‌ها"],
    welcomeCoupon: 0, pointMultiplier: 1,
  },
  {
    id: "silver", name: "نقره‌ای", en: "SILVER", minSpent: 5_000_000, color: "#b8b9b5",
    perks: ["۱۰٪ تخفیف ارتقا", "ضریب ۱.۵ بر امتیازها", "اولویت در پاسخ‌گویی پشتیبانی"],
    welcomeCoupon: 10, pointMultiplier: 1.5,
  },
  {
    id: "gold", name: "طلایی", en: "GOLD", minSpent: 15_000_000, color: "#D19B44",
    perks: ["۱۵٪ تخفیف ارتقا", "ضریب ۲ بر امتیازها", "هدیهٔ تولد", "دسترسی زودهنگام به کالکشن جدید"],
    welcomeCoupon: 15, pointMultiplier: 2,
  },
  {
    id: "vip", name: "ویژه", en: "VIP", minSpent: 40_000_000, color: "#e3bd7d",
    perks: ["۲۰٪ تخفیف ارتقا", "ضریب ۳ بر امتیازها", "ارسال رایگان همیشگی", "مشاورهٔ استایل اختصاصی"],
    welcomeCoupon: 20, pointMultiplier: 3,
  },
];

export const tierMeta = (id: CustomerTier) => clubTiers.find(tier => tier.id === id) ?? clubTiers[0];

/** سطح باشگاه بر اساس مجموع خرید */
export function tierForSpending(totalSpent: number): CustomerTier {
  let tier: CustomerTier = "bronze";
  for (const item of clubTiers) if (totalSpent >= item.minSpent) tier = item.id;
  return tier;
}

/** پیشرفت تا سطح بعدی */
export function tierProgress(totalSpent: number) {
  const current = tierForSpending(totalSpent);
  const index = clubTiers.findIndex(tier => tier.id === current);
  const next = clubTiers[index + 1];
  if (!next) return { current, next: null, percent: 100, remaining: 0 };
  const base = clubTiers[index].minSpent;
  const percent = Math.min(100, Math.round(((totalSpent - base) / (next.minSpent - base)) * 100));
  return { current, next, percent, remaining: Math.max(0, next.minSpent - totalSpent) };
}

/* ============================================================
 *  قواعد امتیاز و پاداش
 * ============================================================ */

export const pointsRules = {
  /** امتیاز به ازای هر تومان خرید */
  perToman: 1 / 10_000,
  /** امتیاز ثبت نظر */
  review: 20,
  /** امتیاز ثبت‌نام با دعوت */
  referralRegister: 100,
  /** امتیاز اولین خرید دعوت‌شده */
  referralPurchase: 400,
  /** امتیاز تکمیل پروفایل */
  profile: 30,
};

/** امتیاز خرید بر اساس ضریب سطح باشگاه */
export function pointsForOrder(total: number, tier: CustomerTier) {
  return Math.round(total * pointsRules.perToman * tierMeta(tier).pointMultiplier);
}

/** تبدیل امتیاز به اعتبار کیف پول — هر ۱۰۰ امتیاز = ۱٬۰۰۰ تومان */
export const pointsToWallet = (points: number) => Math.floor(points / 100) * 1000;

export const money = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
