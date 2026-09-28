import "server-only";
import { db } from "@/db";
import { articles, products } from "@/db/schema";
import { and, asc, desc, eq, lte, inArray } from "drizzle-orm";

import type { Article, ArticleSection } from "./daily-types";
import { dailySections, sectionMeta } from "./daily-types";

export { dailySections, sectionMeta } from "./daily-types";
export type { Article, ArticleSection } from "./daily-types";

/* ============================================================
 *  دادهٔ پیش‌فرض — نسخهٔ اول روزنامه
 * ============================================================ */

const defaultArticles = [
  {
    slug: "warm-gold-this-autumn",
    section: "main-story",
    title: "طلایی گرم، آبکاری‌ای که این پاییز را روشن می‌کند",
    kicker: "گزارش ویژهٔ امروز",
    excerpt: "این فصل، آبکاری طلایی مات از حالت «موقت» درآمده و به یکی از پایدارترین انتخاب‌های کمد تبدیل شده است؛ چیزی که هم با چرم طبیعی و هم با مشکیِ ساده هماهنگ می‌شود.",
    body: `## چی آبکاری را جدی می‌کند
طلاییِ این فصل آن تزئینیِ براق گذشته نیست؛ آبکاری مات و گرم است که کنار چرم طبیعی ایستاده می‌کند و به رنگ پوست نزدیک می‌شود. همین نزدیکی باعث می‌شود روی اکسسوری‌های کوچک — یک گوشواره حلقه‌ای یا یک زنجیرهٔ ظریف — بیشترین تأثیر را بگذارد.

> «جزئیات کوچک، وقتی رنگ درستی داشته باشند، کل استایل را عوض می‌کنند.»

## چرا با چرم جواب می‌دهد
بافت خام چرم در کنار فلز طلاییِ مات، کنتراست ملایمی می‌سازد: یک طرف خام و ماندگار، یک طرف گرم و براق. ترکیب این دو، به کمربند یا دستبند اجازه می‌دهد از «اکسسوریِ هر روز» به «جزئیات امضا» تبدیل شوند.

[[product:5|گوشواره حلقه‌ای آوا]]

## چگونه بپوشیم
برای روزهای معمولی، یک گوشوارهٔ طلایی کوچک به‌عنوان تک‌جزئیات کافی است؛ برای استایل عصرگاهی، زنجیرهٔ کوبانی را روی یقهٔ بسته بپوشید تا زاویهٔ صورت باز شود. قانون ساده: اگر یک جزئیات طلایی دارید، بقیهٔ استایل را ساده نگه دارید.

[[product:6|ست هدیهٔ سیگنیچر]]

پیشنهاد ما برای شروع، آبکاری طلاییِ مات است؛ ساده‌تر برای ترکیب، پایدارتر در استفاده و گرم‌تر در کنار پوست.`,
    image: "/images/hero-jewelry.webp",
    colorHex: "#D19B44",
    author: "سردبیر کیا",
    readMinutes: 4,
    productIds: [5, 6],
    shopLabel: "SHOP THE GOLD EDIT",
    position: 0,
  },
  {
    slug: "chunky-chain-layering",
    section: "trending-now",
    title: "زنجیرهٔ ضخیم، لایه‌لایه",
    kicker: "داغ‌ترین ترند امروز",
    excerpt: "لایه‌لایه کردن زنجیره‌ها دیگر فقط محدود به طلا نیست؛ استیل با حلقه‌های یکدست، نسخهٔ روزمرهٔ همین ترند است.",
    body: `## ترند چیست
زنجیرهٔ ضخیم با حلقه‌های یکدست، بلندترین عمر را در تاریخ اکسسوری داشته است. این فصل دوباره برگشته، اما در نسخهٔ سبک‌تر: استیل ضدزنگ با درخشش متعادل که هم روی یانهٔ تی‌شرت و هم روی یقهٔ بسته جواب می‌دهد.

[[product:2|گردنبند زنجیری کوبان]]

## راهنمای لایه‌لایه کردن
سه قاعدهٔ ساده کافی است: طول‌ها را متفاوت انتخاب کنید، ضخامت‌ها را یکی در میان نگه دارید و اگر یکی از زنجیره‌ها گوشهٔ تیز دارد، آن را بیرونی بگذارید. نتیجه، عمقی است بدون شلوغی.

[[product:8|گردنبند زنجیری اِوری‌دی]]

## نکتهٔ نگهداری
از تماس استیل با عطر و مواد شوینده دوری کنید؛ همین نکتهٔ کوچک، درخشش زنجیره را برای ماه‌ها حفظ می‌کند.`,
    image: "/images/product-chain.webp",
    colorHex: "#b8b9b5",
    author: "تیم محتوا",
    readMinutes: 3,
    productIds: [2, 8],
    position: 1,
  },
  {
    slug: "natural-leather-news",
    section: "fashion-news",
    title: "چرم طبیعی؛ انتخاب ماندگارتر از فصل",
    kicker: "خبر کوتاه",
    excerpt: "تقاضای چرم خام و پردازش‌نشده رشد کرده؛ بافت نامنظم دیگر عیب نیست، نشانهٔ اصالت مواد است.",
    body: `## چه خبر است
بازار اکسسوری امسال شاهد جابه‌جایی آرام از سطح‌های کاملاً صیقلی به سمت بافت خام است. چرمی که رگه‌ها و بافت طبیعی‌اش دیده می‌شود، دیگر «ناقص» نامگذاری نمی‌شود؛ بلکه نشانهٔ پردازش کمتر و عمر بیشتر است.

[[product:1|کمربند چرم کلاسیک]]

## برای خریدار یعنی چه
یک کمربند چرم طبیعی با مراقبت ساده، سال‌ها شکل خود را نگه می‌دارد. برای انتخاب درست، دور کمر خود را اندازه بگیرید و یک سایز بزرگ‌تر از ابتدای خرید کنید؛ چرم در ماه‌های اول کمی نرم می‌شود.

[[product:7|کمربند چرم سیگنیچر]]

نکتهٔ نگهداری: از خشک‌کن خودداری کنید و کمربند را در جای خنک و دور از رطوبت مستقیم نگه دارید.`,
    image: "/images/product-belt.webp",
    colorHex: "#78533b",
    author: "تحریریه",
    readMinutes: 2,
    productIds: [1, 7],
    position: 2,
  },
  {
    slug: "one-belt-three-styles",
    section: "accessory-trend",
    title: "یک کمربند، سه استایل",
    kicker: "راهنمای سریع",
    excerpt: "کمربند کم‌ارتفاع‌ترین اکسسوری است که بیشترین تأثیر را روی نسبت اندام می‌گذارد. سه راه ساده برای استفادهٔ درست از آن.",
    body: `## قاعدهٔ اول: عرض سگک را با بند شلوار هماهنگ کنید
سگک باریک‌تر، استایل رسمی‌تر و باریک‌تر نشان می‌دهد؛ سگک پهن‌تر، استایل غیررسمی و برجسته‌تر. ساده‌ترین راه درست شدن، هماهنگ‌کردن عرض این دو است.

## قاعدهٔ دوم: رنگ را از کفش بگیرید
اگر کفش‌تان تیره است، کمربند تیره انتخاب کنید؛ اگر کفش طلایی یا کرم رنگ است، آبکاری طلایی کمربند بهترین همراه است. این تطبیق، استایل را یکپارچه نشان می‌دهد.

[[product:1|کمربند چرم کلاسیک]]

## قاعدهٔ سوم: کمربند را به‌عنوان جزئیات امضا ببینید
وقتی بقیهٔ استایل ساده است، یک کمربند با سگک مشخص می‌تواند تنها جزئیات برجسته باشد. همین سادگی، تفاوت «لباس پوشیدن» و «استایل داشتن» است.

[[product:7|کمربند چرم سیگنیچر]]`,
    image: "/images/product-belt.webp",
    colorHex: "#252621",
    author: "تیم کیا",
    readMinutes: 3,
    productIds: [1, 7],
    position: 3,
  },
  {
    slug: "color-of-the-day-matte-gold",
    section: "color-of-day",
    title: "رنگ امروز: طلایی مات",
    kicker: "پالت سردبیر",
    excerpt: "طلایی مات گرم، پایدار و نزدیک به پوست؛ رنگی که هم روزمره جواب می‌دهد و هم شب‌ها برجسته است.",
    body: `## چرا این رنگ
طلایی مات نه مانند طلای براق توجه را می‌رباید و نه مانند نقره‌ای خنثی می‌ماند؛ در میانهٔ گرمی ایستاده و به هر رنگ پوستی نزدیک می‌شود. برای کسی که اولین اکسسوری رنگی‌اش را می‌خرد، امن‌ترین انتخاب است.

[[product:5|گوشواره حلقه‌ای آوا]]

## با چه ترکیب شود
با مشکی مات، قهوه‌ای چرم و کرم. اگر today's outfit شما خنثی است، یک جزئیات طلاییِ مات کافی است تا کل استایل جهت بگیرد.

[[product:6|ست هدیهٔ سیگنیچر]]`,
    image: "/images/hero-jewelry.webp",
    colorHex: "#D19B44",
    author: "سردبیر کیا",
    readMinutes: 2,
    productIds: [5, 6],
    position: 4,
  },
  {
    slug: "everyday-three-piece-set",
    section: "style-inspiration",
    title: "ست روزمره: سه قطعه، ده استایل",
    kicker: "الهام",
    excerpt: "با سه جزئیات کوچک — یک زنجیره، یک سیگنت و یک دستبند — می‌توانید هفته را بدون تکرار استایل پیش ببرید.",
    body: `## ست پایه
انتخاب پایه ساده است: یک زنجیرهٔ ظریف، یک انگشتر سیگت مینیمال و یک دستبند. هر سه باید در یک خانوادهٔ رنگی باشند؛ نقره‌ای با نقره‌ای یا طلایی با طلایی.

[[product:2|گردنبند زنجیری کوبان]]

## ده استایل چطور ممکن است
این سه قطعه را می‌توانید ترکیب کردید: زنجیره روی یقهٔ باز، سیگنت در دست غالب، دستبند کنار ساعت. تغییر کوچک — مثل جابه‌جایی دستبند به مچ مقابل — استایل را تازه می‌کند.

[[product:4|انگشتر سیگنت مینیمال]]
[[product:3|دستبند چرم بافت و استیل]]

## قاعدهٔ آخر
اگر روزی مطمئن نبودید، یک جزئیات کمتر بزنید؛ کمتر انتخاب‌کردن هم یک تصمیم استایل است.`,
    image: "/images/product-bracelet.webp",
    colorHex: "#b8b9b5",
    author: "تیم محتوا",
    readMinutes: 3,
    productIds: [2, 4, 3],
    position: 5,
  },
  {
    slug: "signet-ring-close-up",
    section: "product-spotlight",
    title: "نگاهی نزدیک: سیگنت مینیمال",
    kicker: "نور روی محصول",
    excerpt: "فرم هندسی ساده، سطح برس‌خورده و لبه‌های صیقلی؛ سیگتی که هم روزمره است و هم رسمی.",
    body: `## طراحی
سیگتِ بدون نگین، فرمی خالص دارد: یک صفحهٔ هندسی با سطح برس‌خورده و لبهٔ صیقلی. همین تضاد سطح، باعث می‌شود انگشتر در نور کم هم دیده شود.

[[product:4|انگشتر سیگنت مینیمال]]

## اندازه‌گیری
اندازهٔ انگشت در طول روز تغییر می‌کند؛ عصر اندازه بگیرید و اگر بین دو سایز هستید، سایز بزرگ‌تر را انتخاب کنید. انگشتری که رد می‌شود هیچ‌وقت پوشیده نمی‌شود.

## ست با چه چیزی
با یک زنجیرهٔ ظریف و یک دستبند باریک؛ سه جزئیات کوچک، استایل مینیمال کامل می‌سازند.`,
    image: "/images/product-ring.webp",
    colorHex: "#b8b9b5",
    author: "تحریریه",
    readMinutes: 2,
    productIds: [4],
    position: 6,
  },
  {
    slug: "editors-pick-gift-set",
    section: "editors-pick",
    title: "انتخاب سردبیر برای هدیه",
    kicker: "پایان امروز",
    excerpt: "اگر هدیه می‌خواهید بدهید و مطمئن نیستید چه چیزی درست است، ست آمادهٔ سیگنیچر کم‌ریسک‌ترین انتخاب است.",
    body: `## چرا ست
انتخاب تکه‌تکه سخت است؛ ست آمادهٔ هماهنگ، تصمیم را ساده می‌کند و جعبهٔ هدیه، تجربهٔ باز کردن را کامل می‌کند. برای کسی که سلیقه‌اش را نمی‌دانید، ست امن‌ترین مسیر است.

[[product:6|ست هدیهٔ سیگنیچر]]

## برای چه مناسبت‌هایی
سالگرد، تولد، یا حتی «فقط بخاطرت». یک جزئیات کوچک با بسته‌بندی فکرشده، بیشتر از مقداری که هزینه می‌شود، حس خوب می‌دهد.

## نکتهٔ آخر
اگر تاریخ مهمی نزدیک است، دو هفته زودتر سفارش دهید؛ زمان کافی برای بسته‌بندی و ارسال.`,
    image: "/images/product-gift.webp",
    colorHex: "#D19B44",
    author: "سردبیر کیا",
    readMinutes: 2,
    productIds: [6],
    position: 7,
  },
];

/* ============================================================
 *  بارگذاری
 * ============================================================ */

export async function ensureDaily() {
  const existing = await db.select({ id: articles.id }).from(articles).limit(1);
  if (existing.length) return;
  await db.insert(articles).values(defaultArticles);
}

/** مقاله‌های منتشرشده — بر اساس تاریخ نسخه و ترتیب دسته */
export async function getDailyEdition() {
  await ensureDaily();
  const now = new Date();

  const published = await db
    .select()
    .from(articles)
    .where(and(eq(articles.active, true), lte(articles.publishAt, now)))
    .orderBy(desc(articles.editionDate), asc(articles.position));

  const grouped: Record<string, Article[]> = {};
  for (const article of published) (grouped[article.section] ||= []).push(article as Article);

  const productIds = [...new Set(published.flatMap(article => article.productIds))];
  const productRows = productIds.length
    ? await db.select().from(products).where(inArray(products.id, productIds))
    : [];
  const productMap = new Map(productRows.map(product => [product.id, product]));

  return { articles: published as Article[], grouped, productMap, serverNow: now.getTime() };
}

/** یک مقاله برای صفحهٔ اختصاصی — همراه محصولات مرتبط */
export async function getArticleBySlug(slug: string) {
  await ensureDaily();
  const now = new Date();

  const [article] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.slug, slug), eq(articles.active, true), lte(articles.publishAt, now)))
    .limit(1);
  if (!article) return null;

  const productRows = article.productIds.length
    ? await db.select().from(products).where(inArray(products.id, article.productIds))
    : [];

  return { article: { ...article, section: article.section as ArticleSection }, products: productRows };
}

/** همهٔ مقالات برای پنل مدیر (بدون فیلتر انتشار) */
export async function getAllArticlesForAdmin() {
  await ensureDaily();
  return db.select().from(articles).orderBy(asc(articles.position), desc(articles.id));
}
