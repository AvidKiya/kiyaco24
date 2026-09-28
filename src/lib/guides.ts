import "server-only";
import { db } from "@/db";
import { guides, collections, products, trends } from "@/db/schema";
import { and, asc, desc, eq, lte, inArray } from "drizzle-orm";

import type { Guide, GuideTopic, Collection } from "./guide-types";
import { guideTopics } from "./guide-types";

export { guideTopics } from "./guide-types";
export type { Guide, Collection, GuideTopic } from "./guide-types";

/* ============================================================
 *  دادهٔ پیش‌فرض — راهنماهای استایل کیا
 * ============================================================ */

const defaultGuides = [
  {
    slug: "belt-size-guide",
    topic: "sizing",
    title: "راهنمای سایز کمربند: چطور اندازهٔ درست را پیدا کنیم",
    kicker: "راهنمای سایز",
    excerpt: "دو روش ساده برای اندازه‌گیری کمربند در خانه، به‌همراه جدول تبدیل سایز و اشتباهی که خیلی‌ها مرتکب می‌شوند.",
    body: `## روش اول: اندازه‌گیری با کمربند فعلی
کمربندی که الان راحت می‌بندید را روی میز صاف بگذارید. از لبهٔ داخلی سگک تا سوراخی که معمولاً استفاده می‌کنید را با خط‌کش اندازه بگیرید. عدد به دست آمده بر حسب سانتی‌متر، سایز شماست.

- اگر کمربند شما پنج سوراخ دارد، معمولاً وسط third سوراخ را انتخاب کنید
- اندازه را بر حسب سانتی‌متر ثبت کنید، نه اینچ
- دو بار اندازه بگیرید تا مطمئن شوید

## روش دوم: اندازه‌گیری دور کمر
یک نخ نرم دور کمر خود بپیچید — دقیقاً روی همان جایی که کمربند می‌نشینید. نخ را خط بزنید و کنار خط‌کش بگیرید. دور کمر به دست آمده معمولاً ۱۰ تا ۱۵ سانتی‌متر بیشتر از سایز کمربند است.

> قاعدهٔ ساده: دور کمر منهای ۱۰ تا ۱۵ سانتی‌متر = سایز کمربند.

## جدول تبدیل تقریبی
- دور کمر ۹۰ تا ۱۰۰ → سایز ۹۰ تا ۹۵
- دور کمر ۱۰۰ تا ۱۱۰ → سایز ۱۰۰ تا ۱۰۵
- دور کمر ۱۱۰ تا ۱۲۰ → سایز ۱۱۰ تا ۱۱۵

## اشتباه رایج
زیاد بزرگ خریدن با این امید که «بعداً جا بیفتد» کارساز نیست؛ کمربند بزرگ همیشه شل‌تر دیده می‌شود. اگر بین دو سایز هستید، سایز کوچک‌تر را انتخاب کنید؛ چرم در ماه‌های اول کمی نرم می‌شود.

[[product:1|کمربند چرم کلاسیک]]
[[product:7|کمربند چرم سیگنیچر]]`,
    image: "/images/product-belt.webp",
    author: "تیم کیا",
    readMinutes: 4,
    productIds: [1, 7],
    position: 0,
  },
  {
    slug: "how-to-tie-a-belt",
    topic: "knotting",
    title: "چطور کمربند را درست ببندیم",
    kicker: "آموزش گام‌به‌گام",
    excerpt: "بستن کمربند بیشتر از یک مهارت روزمره نیست؛ فرم درست سگک و انتهای کمربند، کل استایل را مرتب نشان می‌دهد.",
    body: `## گام اول: اندازه‌گیری مجدد پیش از بستن
پیش از خرید یک بار اندازه بگیرید تا کمربند را در سوراخ مناسب ببندید. کمربند خیلی کوتاه یا خیلی بلند، هر دو استایل را بی‌ترتیب نشان می‌دهند.

## گام دوم: سوراخ درست را انتخاب کنید
از سوراخ وسطی شروع کنید. اگر کمربند بعد از بستن خیلی شل بود، یک سوراخ کوچک‌تر بروید؛ اگر فشار می‌آورد، یک سوراخ بزرگ‌تر.

## گام سوم: انتهای کمربند را کنترل کنید
انتهای کمربند نباید خیلی بلند باشد. اگر انتهای کمربند از بند شلوار بیرون زد، احتمالاً کمربند شما بلندتر از نیاز است.

> قاعدهٔ عملی: انتهای کمربند حداکثر به اندازهٔ یک کف دست از بند شلوار بیرون بیاید.

## گام چهارم: فرم سگک را حفظ کنید
سگک باید افقی و هماهنگ با مرکز بند شلوار بنشیند. سگک کج، کوچک‌ترین بی‌نظمی را هم در استایل رسمی نشان می‌دهد.

## گام پنجم: بازبینی نهایی
آخرین بررسی: ایستادن و نگاه کردن از دور. اگر کمربند محسوس است، احتمالاً یا اندازه‌اش درست نیست یا با رنگ لباس هماهنگ نیست.

[[product:7|کمربند چرم سیگنیچر]]`,
    image: "/images/product-belt.webp",
    author: "تیم کیا",
    readMinutes: 3,
    productIds: [7],
    position: 1,
  },
  {
    slug: "belt-and-shoes-pairing",
    topic: "pairing",
    title: "هماهنگی کمربند با کفش و لباس",
    kicker: "ست کردن",
    excerpt: "قاعدهٔ رنگ، ضخامت کمربند و انتخاب درست برای استایل رسمی، نیمه‌رسمی و غیررسمی.",
    body: `## قاعدهٔ رنگ: کمربند را از کفش بگیرید
ساده‌ترین راه یکپارچه دیده‌شدن استایل، هماهنگ‌کردن رنگ کمربند و کفش است. کفش تیره با کمربند تیره؛ کفش کرم یا طلایی با آبکاری طلایی.

## قاعدهٔ ضخامت: باریک برای رسمی، پهن‌تر برای غیررسمی
کمربند باریک استایل رسمی‌تر و باریک‌تر می‌سازد؛ کمربند پهن‌تر برای استایل روزمره و کژوال مناسب است. عرض کمربند را با عرض بند شلوار هماهنگ کنید.

## استایل رسمی
برای استایل رسمی، کمربند چرم مشکی یا قهوه‌ای تیره با سگک فلزی کوچک انتخاب کنید؛ رنگ کمربند و کفش یکی باشد و براق نباشد.

## استایل روزمره
در استایل روزمره آزادی بیشتری دارید: چرم طبیعی با بافت خام، کنار کفش سفید یا کتانی، انتخاب خوبی است.

[[product:1|کمربند چرم کلاسیک]]
[[product:7|کمربند چرم سیگنیچر]]

## استایل غیررسمی با جین
با جین، کمربند چرم ضخیم‌تر با سگک برنجی یا مات بهتر از سگک‌های صیقل عمل می‌کند. رنگ کمربند می‌تواند یک پله روشن‌تر یا تیره‌تر از کفش باشد.`,
    image: "/images/product-belt.webp",
    author: "تحریریه",
    readMinutes: 4,
    productIds: [1, 7],
    position: 2,
  },
  {
    slug: "gold-or-silver",
    topic: "metal",
    title: "طلایی بزنیم یا نقره‌ای؟",
    kicker: "انتخاب فلز",
    excerpt: "راهنمای انتخاب فلز بر اساس رنگ پوست، استایل لباس و مناسبت — به‌همراه قاعدهٔ مهم اینکه هرگز این دو را با هم نزدیک نکنید.",
    body: `## رنگ پوست را نگاه کنید
پوست‌های گرم (زیرطحی زیتونی یا طلایی) با فلز طلایی گرم هماهنگ‌ترند. پوست‌های خنثی تا سرد (زیرطحی صورتی یا роз) با نقره‌ای بهتر دیده می‌شوند. اگر بین این دو بودید، هر دو را تست کنید؛ نور روز بهترین داوری است.

## استایل لباس را بررسی کنید
لباس‌های خنثی با هر دو فلز کار می‌کنند. اگر لباس شما تصاویر طلایی یا دکمه‌های طلایی دارد، فلز طلایی انتخاب امن‌تری است.

## قاعدهٔ مهم: فلزها را با هم قاتی نکنید
ترکیب طلا و نقره در یک استایل ممکن است، اما به تمرhez نیاز دارد. برای شروع، یک فلز را انتخاب کنید و همهٔ اکسسوری‌ها را در همان خانوادهٔ رنگی نگه دارید.

[[product:5|گوشواره حلقه‌ای آوا]]
[[product:4|انگشتر سیگنت مینیمال]]

## برای هدیه دادن
اگر مطمئن نیستید طرف Hafez طلایی است یا نقره‌ای، رنگ نقره‌ای معمولاً امن‌تر عمل می‌کند؛ چون با بیشتر ترکیب‌های رنگی سازگار است.`,
    image: "/images/hero-jewelry.webp",
    author: "سردبیر کیا",
    readMinutes: 3,
    productIds: [5, 4],
    position: 3,
  },
  {
    slug: "layering-accessories",
    topic: "layering",
    title: "لایه‌لایه کردن اکسسوری‌ها بدون شلوغی",
    kicker: "ترکیب",
    excerpt: "چند قاعدهٔ ساده برای ترکیب گردنبند، دستبند و انگشتر؛ از تک‌جزئیات تا استایل برجسته.",
    body: `## قاعدهٔ سه جزئیات
برای استایل روزمره، سه جزئیات کافی است: یک گردنبند، یک دستبند و یک انگشتر. بیشتر از این، بدون برنامهٔ مشخص، استایل را شلوغ می‌کند.

## طول‌ها را متفاوت کنید
اگر چند گردنبند می‌پوشید، طول‌ها باید متفاوت باشند تا هر یک دیده شود. زنجیرهٔ کوتاه‌تر به گردن، زنجیرهٔ بلندتر روی لباس.

## یک جزئیات برجسته داشته باشید
در هر استایل، یک جزئیات باید چشم را بگیرد — یک گوشوارهٔ طلایی یا یک زنجیرهٔ ضخیم. بقیهٔ جزئیات ساده و کم‌حجم باشند.

[[product:2|گردنبند زنجیری کوبان]]
[[product:3|دستبند چرم بافت و استیل]]
[[product:4|انگشتر سیگنت مینیمال]]

## قاعدهٔ آخر: قبل از بیرون رفتن یک جزئیات کم کنید
اگر مطمئن نیستید، یک جزئیات برداشته کنید. کمتر انتخاب‌کردن هم یک تصمیم استایل است.`,
    image: "/images/product-chain.webp",
    author: "تیم محتوا",
    readMinutes: 3,
    productIds: [2, 3, 4],
    position: 4,
  },
  {
    slug: "accessory-care",
    topic: "care",
    title: "نگهداری از کمربند و اکسسوری برای عمر بیشتر",
    kicker: "نگهداری",
    excerpt: "چند عادت کوچیک که عمر چرم و فلز را چند برابر می‌کند؛ از عطر و رطوبت تا روش صحیح تمیزکردن.",
    body: `## چرم را از رطوبت مستقیم دور نگه دارید
چرم طبیعی با آب مواجه نشود. اگر خیس شد، با یک پارچهٔ نرم و خشک لمس کنید و در جای خنک و دور از حرارت مستقیم خشک کنید؛ هیچ‌وقت از سخاننده یا خشک‌کن استفاده نکنید.

## فلز را از عطر و مواد شوینده دور نگه دارید
عطر، اسپری مو و مواد شوینده، درخشش استیل و آبکاری را کم می‌کنند. قانون ساده: اول عطر و اسپری، بعد اکسسوری.

## کمربند را آویزان نگه دارید
کمربند را تا نکنید یا در کشو خم نگذارید؛ آویزان کردن یا لوله‌ای کردن، فرم چرم را حفظ می‌کند.

[[product:1|کمربند چرم کلاسیک]]

## مرتب نگه داشتن استیل
برای استیل، یک پارچهٔ نرم و خشک کافی است. برای لکه‌های سخت‌تر، کمی آب و صابون ملایم؛ بعد کاملاً خشک کنید.

> نگهداری درست، تفاوت «یک فصل» و «چند سال» است.`,
    image: "/images/product-bracelet.webp",
    author: "تحریریه",
    readMinutes: 3,
    productIds: [1, 3],
    position: 5,
  },
];

const defaultCollections = [
  {
    slug: "autumn-warm",
    name: "کالکشن پاییز گرم",
    label: "AUTUMN WARM",
    subtitle: "طلایی مات و چرم طبیعی برای روزهای خنک",
    description: "رنگ‌های گرم پاییز، آبکاری طلایی مات و بافت خام چرم؛ ترکیبی برای روزهایی که نور کم است اما استایل باید برجسته باشد.",
    image: "/images/hero-jewelry.webp",
    colorHex: "#D19B44",
    badge: "جدید",
    productIds: [5, 1, 7],
    featured: true,
    position: 0,
  },
  {
    slug: "minimal-everyday",
    name: "مینیمال هر روز",
    label: "MINIMAL EVERYDAY",
    subtitle: "جزئیات کوچک، تأثیر ماندگار",
    description: "انتخاب‌های مینیمال برای کسی که کمتر را بیشتر دوست دارد: فرم ساده، رنگ یکدست و جزئیاتی که هیچ‌وقت از مد نمی‌افتند.",
    image: "/images/product-ring.webp",
    colorHex: "#b8b9b5",
    badge: "",
    productIds: [4, 8, 3],
    featured: true,
    position: 1,
  },
  {
    slug: "party-night",
    name: "مهمانی و شب",
    label: "PARTY NIGHT",
    subtitle: "درخشش کنترل‌شده برای شب‌ها",
    description: "برای شب‌هایی که می‌خواهید دیده شوید: زنجیرهٔ ضخیم، گوشوارهٔ برجسته و جزئیاتی که زیر نور مهمانی بهتر دیده می‌شوند.",
    image: "/images/product-chain.webp",
    colorHex: "#e3bd7d",
    badge: "محدود",
    productIds: [2, 5, 6],
    featured: true,
    position: 2,
  },
  {
    slug: "office-formal",
    name: "اداری و رسمی",
    label: "OFFICE FORMAL",
    subtitle: "رسمی، نه کلاسیک",
    description: "ست رسمی برای محیط کار: کمربند باریک تیره، سگک کوچک و اکسسوری‌های کم‌حجم که حرفه‌ای دیده می‌شوند.",
    image: "/images/product-belt.webp",
    colorHex: "#252621",
    badge: "",
    productIds: [1, 7, 4],
    featured: false,
    position: 3,
  },
  {
    slug: "street-style",
    name: "استریت و روزمره",
    label: "STREET STYLE",
    subtitle: "راحت، برجسته، بدون تظاهر",
    description: "ترکیب روزمره برای پیاده‌روی در شهر: چرم بافت، زنجیرهٔ ساده و جزئیاتی که با هر لباسی سازگارند.",
    image: "/images/product-bracelet.webp",
    colorHex: "#717967",
    badge: "",
    productIds: [3, 8, 2],
    featured: false,
    position: 4,
  },
  {
    slug: "gold-edit",
    name: "کالکشن طلایی",
    label: "THE GOLD EDIT",
    subtitle: "همه‌چیز با آبکاری طلایی گرم",
    description: "اگر فقط یک رنگ را دوست داری، طلایی مات را انتخاب کن؛ گرم، پایدار و نزدیک به پوست.",
    image: "/images/product-earrings.webp",
    colorHex: "#D19B44",
    badge: "",
    productIds: [5, 6],
    featured: true,
    position: 5,
  },
  {
    slug: "black-matte",
    name: "مشکیِ مات",
    label: "BLACK MATTE",
    subtitle: "تیره، یکدست، همیشه درست",
    description: "استایل تمام‌مشکی با جزئیات مات؛ انتخابی برای روزهایی که می‌خواهید ساده و قوی دیده شوید.",
    image: "/images/hero-belt.webp",
    colorHex: "#252621",
    badge: "",
    productIds: [1, 3, 4],
    featured: false,
    position: 6,
  },
];

/* ============================================================
 *  بارگذاری
 * ============================================================ */

export async function ensureGuides() {
  const [guideCount, collectionCount] = await Promise.all([
    db.select({ id: guides.id }).from(guides).limit(1),
    db.select({ id: collections.id }).from(collections).limit(1),
  ]);
  if (!guideCount.length) await db.insert(guides).values(defaultGuides);
  if (!collectionCount.length) await db.insert(collections).values(defaultCollections);
}

/** همهٔ راهنماهای منتشرشده — به ترتیب موضوع و جایگاه */
export async function getPublishedGuides() {
  await ensureGuides();
  const now = new Date();
  const list = db
    .select()
    .from(guides)
    .where(and(eq(guides.active, true), lte(guides.publishAt, now)))
    .orderBy(asc(guides.position), desc(guides.id));
  return (await list).map(guide => ({ ...guide, topic: guide.topic as GuideTopic }));
}

export async function getGuideBySlug(slug: string) {
  await ensureGuides();
  const now = new Date();
  const [guide] = await db
    .select()
    .from(guides)
    .where(and(eq(guides.slug, slug), eq(guides.active, true), lte(guides.publishAt, now)))
    .limit(1);
  if (!guide) return null;
  return { ...guide, topic: guide.topic as GuideTopic };
}

/** کالکشن‌های فعال — برای لندینگ و ویترین */
export async function getActiveCollections(featuredOnly = false) {
  await ensureGuides();
  return db
    .select()
    .from(collections)
    .where(featuredOnly ? and(eq(collections.active, true), eq(collections.featured, true)) : eq(collections.active, true))
    .orderBy(asc(collections.position), desc(collections.id));
}

export async function getCollectionBySlug(slug: string) {
  await ensureGuides();
  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.slug, slug), eq(collections.active, true)))
    .limit(1);
  return collection ?? null;
}

/** همهٔ راهنماها و کالکشن‌ها برای پنل مدیر */
export async function getAllForAdmin() {
  await ensureGuides();
  const [allGuides, allCollections] = await Promise.all([
    db.select().from(guides).orderBy(asc(guides.position), desc(guides.id)),
    db.select().from(collections).orderBy(asc(collections.position), desc(collections.id)),
  ]);
  return { guides: allGuides, collections: allCollections };
}

/** ترندهای فعال برای صفحهٔ ترندینگ */
export async function getActiveTrends() {
  return db.select().from(trends).where(eq(trends.active, true)).orderBy(asc(trends.position));
}

/** محصولات چند کالکشن/ترند به‌صورت یکجا */
export async function productsByIds(ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(products).where(inArray(products.id, ids));
}
