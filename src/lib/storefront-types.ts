/* ============================================================
 *  انواع و توابع مشترک ویترین — بدون وابستگی به دیتابیس
 *  (ایمن برای استفاده در کلاینت و سرور)
 * ============================================================ */

export type HeroSlide = {
  id: number; eyebrow: string; title: string; accent: string; description: string;
  image: string; button: string; link: string; label: string; position: number; active: boolean;
  /** فاز ۱۳: کمپین زمان‌دار + تصویر موبایل */
  mobileImage: string; startsAt: Date | null; endsAt: Date | null;
};

export type FlashSale = {
  id: number; title: string; subtitle: string; productIds: number[];
  endsAt: Date; active: boolean;
};

export type Trend = {
  id: number; title: string; subtitle: string; productIds: number[]; position: number; active: boolean;
};

export type Look = {
  id: number; title: string; description: string; image: string; productIds: number[]; position: number; active: boolean;
};

export type Review = {
  id: number; productId: number; name: string; rating: number; text: string;
  image: string; approved: boolean; createdAt: Date;
};

export type Question = {
  id: number; productId: number; name: string; question: string; answer: string;
  approved: boolean; createdAt: Date;
};

/** فاز ۱۳: سکشن صفحهٔ اصلی — داخلی یا دلخواه */
export type HomeSection = {
  id: number; key: string; title: string; subtitle: string; layout: string;
  config: { image?: string; text?: string; cta?: string; link?: string; productIds?: number[]; background?: string };
  position: number; active: boolean;
};

/** سکشن‌های داخلی صفحهٔ اصلی و برچسب فارسی‌شان */
export const builtinSections: { key: string; name: string; hint: string }[] = [
  { key: "hero", name: "بنر اصلی (اسلایدر)", hint: "اسلایدهای بنر از تب «ترند · دراپ · ست» مدیریت می‌شوند" },
  { key: "trust", name: "نوار اعتماد", hint: "ارسال، بازگشت، کیفیت، پشتیبانی" },
  { key: "categories", name: "دسته‌بندی‌ها", hint: "کارت‌های شش دستهٔ فروشگاه" },
  { key: "trending", name: "ترند امروز", hint: "محتوای آن از تب «ترند · دراپ · ست» می‌آید" },
  { key: "featured", name: "انتخاب‌های دوست‌داشتنی", hint: "منتخب‌ها / جدیدترین‌ها / تخفیف‌دارها" },
  { key: "flash", name: "فروش ویژهٔ زمان‌دار", hint: "در صورت فعال‌بودن فلش‌سل نمایش داده می‌شود" },
  { key: "editorial", name: "بنرهای دوتایی (کمربند + هدیه)", hint: "دو بنر ثابت وسط صفحه" },
  { key: "newdrop", name: "دراپ جدید", hint: "جدیدترین محصولات" },
  { key: "looks", name: "ست‌های پیشنهادی (Shop the Look)", hint: "از تب «ترند · دراپ · ست»" },
  { key: "stylenote", name: "نکتهٔ نگه‌داری", hint: "راهنمای مراقبت از اکسسوری" },
  { key: "newsletter", name: "خبرنامه", hint: "فرم عضویت ایمیلی" },
];

export type StorefrontExtras = {
  slides: HeroSlide[];
  /** فاز ۱۳: سکشن‌های فعال صفحهٔ اصلی به‌ترتیب */
  homeSections: HomeSection[];
  flash: FlashSale | null;
  flashProducts: number[];
  trends: Trend[];
  looks: Look[];
  reviewsByProduct: Record<number, Review[]>;
  questionsByProduct: Record<number, Question[]>;
  /** زمان سرور — برای کاونت‌داکن کنترل‌شده (نه تایمر نمایشی) */
  serverNow: number;
};

/** خلاصهٔ امتیاز نظرات یک محصول */
export function reviewSummary(reviews: Review[] | undefined) {
  if (!reviews?.length) return { count: 0, average: 0 };
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { count: reviews.length, average: Math.round((total / reviews.length) * 10) / 10 };
}
