import "server-only";
import { db } from "@/db";
import { heroSlides, flashSales, trends, looks, reviews, questions, products, homeSections } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";

import type { HeroSlide, FlashSale, Trend, Look, Review, Question, StorefrontExtras, HomeSection } from "./storefront-types";
export type { HeroSlide, FlashSale, Trend, Look, Review, Question, StorefrontExtras } from "./storefront-types";
export { reviewSummary } from "./storefront-types";

/* ============================================================
 *  دادهٔ پیش‌فرض برای بار اول
 * ============================================================ */

const defaultSlides = [
  { eyebrow: "کالکشن جدید کیا", title: "استایل تو،", accent: "امضای تو.", description: "کمربند و اکسسوری‌هایی که فقط یک جزئیات نیستن؛\nبخشی از شخصیت تو هستن.", image: "/images/hero-belt.webp", button: "کالکشن رو ببین", link: "/shop", label: "THE SIGNATURE COLLECTION", position: 0, active: true },
  { eyebrow: "انتخاب خاص‌پسندها", title: "جزئیات کمتر،", accent: "تأثیر بیشتر.", description: "ساده، ماندگار و درست شبیه تو؛\nاکسسوری‌هایی برای هر روز، نه فقط یک روز.", image: "/images/hero-jewelry.webp", button: "اکسسوری‌ها رو ببین", link: "/shop?category=accessories", label: "THE EVERYDAY EDIT", position: 1, active: true },
  { eyebrow: "یک هدیه، هزار حرف", title: "برای کسی که", accent: "خاصه برات.", description: "یه انتخاب کوچیک، با کلی حس خوب؛\nهدیه‌هایی که از یاد نمی‌رن.", image: "/images/hero-belt.webp", button: "هدیه‌ات رو پیدا کن", link: "/shop?category=sets", label: "A LITTLE SOMETHING SPECIAL", position: 2, active: true },
];

const defaultTrends = [
  { title: "طلاییِ امروز", subtitle: "آبکاری طلایی گرم، داغ‌ترین رنگ این فصل", productIds: [5, 6], position: 0, active: true },
  { title: "زنجیرهٔ ضخیم", subtitle: "لایه‌های کوبانی برای استایل برجسته", productIds: [2, 8], position: 1, active: true },
  { title: "چرم طبیعی", subtitle: "بافت خام و ماندگار برای هر روز", productIds: [1, 7, 3], position: 2, active: true },
  { title: "مینیمال سیگنت", subtitle: "فرم ساده، تأثیر بلند", productIds: [4], position: 3, active: true },
];

const defaultLooks = [
  { title: "THE BLACK LOOK", description: "هماهنگ، ساده و همیشه درست: چرم مشکی، استیل مات و یک زنجیرهٔ ظریف.", image: "/images/hero-belt.webp", productIds: [1, 3, 2], position: 0, active: true },
  { title: "THE GIFT EDIT", description: "برای کسی که خاصه: ست هدیه و یک گوشوارهٔ طلایی.", image: "/images/hero-jewelry.webp", productIds: [6, 5], position: 1, active: true },
];

/* ============================================================
 *  بارگذاری بخش‌ها
 * ============================================================ */

/** فاز ۱۳: چیدمان پیش‌فرض صفحهٔ اصلی — دقیقاً همان ترتیب قبلی */
const defaultHomeSections = ["hero", "trust", "categories", "trending", "featured", "flash", "editorial", "newdrop", "looks", "stylenote", "newsletter"]
  .map((key, position) => ({ key, position, active: true, title: "", subtitle: "", layout: "banner", config: {} }));

export async function ensureStorefront() {
  const [slideCount, trendCount, lookCount, sectionCount] = await Promise.all([
    db.select({ id: heroSlides.id }).from(heroSlides).limit(1),
    db.select({ id: trends.id }).from(trends).limit(1),
    db.select({ id: looks.id }).from(looks).limit(1),
    db.select({ id: homeSections.id }).from(homeSections).limit(1),
  ]);
  if (!slideCount.length) await db.insert(heroSlides).values(defaultSlides);
  if (!trendCount.length) await db.insert(trends).values(defaultTrends);
  if (!lookCount.length) await db.insert(looks).values(defaultLooks);
  if (!sectionCount.length) await db.insert(homeSections).values(defaultHomeSections);
}

export async function getStorefrontExtras(): Promise<StorefrontExtras> {
  await ensureStorefront();

  const [allSlides, allFlash, allTrends, allLooks, allReviews, allQuestions, allSections] = await Promise.all([
    db.select().from(heroSlides).where(eq(heroSlides.active, true)).orderBy(asc(heroSlides.position)),
    db.select().from(flashSales).where(eq(flashSales.active, true)).orderBy(desc(flashSales.endsAt)).limit(1),
    db.select().from(trends).where(eq(trends.active, true)).orderBy(asc(trends.position)),
    db.select().from(looks).where(eq(looks.active, true)).orderBy(asc(looks.position)),
    db.select().from(reviews).where(eq(reviews.approved, true)).orderBy(desc(reviews.createdAt)).limit(200),
    db.select().from(questions).where(eq(questions.approved, true)).orderBy(desc(questions.createdAt)).limit(200),
    db.select().from(homeSections).where(eq(homeSections.active, true)).orderBy(asc(homeSections.position), asc(homeSections.id)),
  ]);

  const now = new Date();
  // فروش ویژهٔ فعال = آن‌هایی که زمانشان نگذشته
  const liveFlash = allFlash.find(sale => new Date(sale.endsAt).getTime() > now.getTime()) ?? null;

  const reviewsByProduct: Record<number, Review[]> = {};
  for (const review of allReviews) {
    (reviewsByProduct[review.productId] ||= []).push(review);
  }
  const questionsByProduct: Record<number, Question[]> = {};
  for (const question of allQuestions) {
    if (!question.answer) continue; // بدون پاسخ نمایش داده نشود
    (questionsByProduct[question.productId] ||= []).push(question);
  }

  // فاز ۱۳: بنر کمپینی فقط داخل بازهٔ شروع/پایان نمایش داده می‌شود
  const liveSlides = allSlides.filter(slide =>
    (!slide.startsAt || new Date(slide.startsAt).getTime() <= now.getTime()) &&
    (!slide.endsAt || new Date(slide.endsAt).getTime() > now.getTime()));

  return {
    slides: liveSlides,
    homeSections: allSections as HomeSection[],
    flash: liveFlash,
    flashProducts: liveFlash?.productIds ?? [],
    trends: allTrends,
    looks: allLooks,
    reviewsByProduct,
    questionsByProduct,
    serverNow: now.getTime(),
  };
}

