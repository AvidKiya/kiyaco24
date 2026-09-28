export type ProductColor = { name: string; hex: string };
export type Product = {
  id: number; slug: string; name: string; category: string; description: string;
  material: string; price: number; compareAt: number | null; stock: number;
  image: string; colors: ProductColor[]; sizes: string[]; featured: boolean; active: boolean;
  /** فاز ۱۵ — بازنویسی سئو (null = خودکار) */
  seo?: { title?: string; description?: string } | null;
  /** فاز ۱۶ — تصاویر اضافهٔ گالری و ویدیوی محصول */
  gallery?: string[];
  video?: string;
};
/* فاز ۱۳: منوهای قابل مدیریت — لینک‌های # پنجرهٔ اطلاعات فوتر را باز می‌کنند */
export type MenuLink = { label: string; href: string };
export type SiteMenus = { header: MenuLink[]; shopTitle: string; shop: MenuLink[]; helpTitle: string; help: MenuLink[] };
export const defaultMenus: SiteMenus = {
  header: [
    { label: "خانه", href: "/" },
    { label: "فروشگاه", href: "/shop" },
    { label: "کمربند", href: "/shop?category=belts" },
    { label: "اکسسوری", href: "/shop?category=accessories" },
    { label: "جدیدترین‌ها", href: "/shop?sort=newest" },
    { label: "پیشنهادهای ویژه", href: "/shop?sale=1" },
    { label: "مجلهٔ مد", href: "/daily" },
    { label: "همکاری با ما", href: "/partner" },
  ],
  shopTitle: "یک انتخاب خوب",
  shop: [
    { label: "کمربندهای کیا", href: "/shop?category=belts" },
    { label: "دنیای اکسسوری", href: "/shop?category=accessories" },
    { label: "برای هدیه دادن", href: "/shop?category=sets" },
    { label: "کالکشن‌های کیا", href: "/collections" },
    { label: "راهنمای استایل", href: "/guide" },
    { label: "پیشنهادهای ویژه", href: "/shop?sale=1" },
  ],
  helpTitle: "کنار شماییم",
  help: [
    { label: "ترندهای این فصل", href: "/trending" },
    { label: "مجلهٔ مد کیا", href: "/daily" },
    { label: "پیگیری سفارش", href: "/track" },
    { label: "حساب کاربری و باشگاه مشتریان", href: "/account" },
    { label: "ارسال و تحویل سفارش", href: "#shipping" },
    { label: "شرایط بازگشت کالا", href: "#returns" },
    { label: "داستان کیا", href: "#about" },
    { label: "تماس با ما", href: "#contact" },
  ],
};
/** فاز ۱۴ — تنظیمات پرداخت فروشگاه؛ null = پیش‌فرض (درگاه آزمایشی + کارت غیرفعال) */
export type PaymentSettings = {
  zarinpalEnabled?: boolean; merchantId?: string; sandbox?: boolean;
  cardEnabled?: boolean; cardNumber?: string; cardName?: string;
  courierEnabled?: boolean; courierCost?: number; courierNote?: string;
};
export type ShopSettings = {
  id: number; storeName: string; announcement: string; shippingThreshold: number;
  shippingCost: number; instagramUrl: string; telegramUrl: string; botUrl: string;
  supportPhone: string; address: string;
  heroTitle: string; heroAccent: string; heroDescription: string; heroImage: string; heroButton: string; heroLink: string;
  /** null = منوی پیش‌فرض داخلی */
  menus?: SiteMenus | null;
  payment?: PaymentSettings | null;
  seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string; googleVerification?: string } | null;
};
export const defaultSettings: ShopSettings = {
  id: 1, storeName: "کیا اکسسوری", announcement: "یه جزئیات کوچیک، یه تغییر بزرگ!",
  shippingThreshold: 1500000, shippingCost: 65000, instagramUrl: "", telegramUrl: "",
  botUrl: "", supportPhone: "", address: "",
  heroTitle: "استایل تو،", heroAccent: "امضای تو.",
  heroDescription: "کمربند و اکسسوری‌هایی که فقط یک جزئیات نیستن؛\nبخشی از شخصیت تو هستن.",
  heroImage: "/images/hero-belt.webp", heroButton: "کالکشن رو ببین", heroLink: "/shop",
  menus: null,
};
export const categories = [
  { id: "belts", name: "کمربند", en: "BELTS", image: "belt" },
  { id: "necklaces", name: "گردنبند", en: "NECKLACES", image: "chain" },
  { id: "bracelets", name: "دستبند", en: "BRACELETS", image: "bracelet" },
  { id: "rings", name: "انگشتر", en: "RINGS", image: "ring" },
  { id: "earrings", name: "گوشواره", en: "EARRINGS", image: "earrings" },
  { id: "sets", name: "ست و هدیه", en: "GIFT SETS", image: "gift" },
];
const black = { name: "مشکی", hex: "#252621" };
const silver = { name: "نقره‌ای", hex: "#b8b9b5" };
const gold = { name: "طلایی", hex: "#c5a66a" };
export const seedProducts: Product[] = [
  { id: 1, slug: "classic-leather-belt", name: "کمربند چرم کلاسیک", category: "belts", description: "یک انتخاب همیشه‌درست برای استایل روزمره و رسمی. بافت ظریف چرم در کنار سگک نقره‌ای، جزئیاتی ساده اما تاثیرگذار می‌سازد. برای انتخاب دقیق، دور کمر خود را اندازه بگیرید و راهنمای سایز را ببینید.", material: "چرم طبیعی · سگک فلزی", price: 685000, compareAt: 850000, stock: 18, image: "/images/product-belt.webp", colors: [black, { name: "قهوه‌ای", hex: "#78533b" }], sizes: ["100", "110", "120"], featured: true, active: true },
  { id: 2, slug: "cuban-silver-necklace", name: "گردنبند زنجیری کوبان", category: "necklaces", description: "زنجیر کوبان با حلقه‌های یکدست و درخشش متعادل؛ اکسسوری‌ای برای اضافه‌کردن شخصیت به ساده‌ترین لباس‌ها. به‌تنهایی یا در ترکیب با گردنبندهای ظریف استفاده کنید. برای ماندگاری بیشتر از تماس با عطر و مواد شوینده دور نگه دارید.", material: "استیل ضدزنگ · رنگ نقره‌ای", price: 425000, compareAt: 520000, stock: 24, image: "/images/product-chain.webp", colors: [silver], sizes: ["50", "60"], featured: true, active: true },
  { id: 3, slug: "braided-leather-bracelet", name: "دستبند چرم بافت و استیل", category: "bracelets", description: "ترکیب بافت مشکی چرم و قفل استیل؛ همراهی مینیمال برای ساعت یا دیگر اکسسوری‌های شما. قفل آهنربایی، استفادهٔ روزمره را راحت می‌کند. انتخابی مناسب برای یک هدیهٔ کوچک و به‌یادماندنی.", material: "چرم بافت · قفل استیل", price: 345000, compareAt: null, stock: 22, image: "/images/product-bracelet.webp", colors: [black, silver], sizes: ["19", "21"], featured: true, active: true },
  { id: 4, slug: "minimal-signet-ring", name: "انگشتر سیگنت مینیمال", category: "rings", description: "فرم هندسی ساده با سطح برس‌خورده و لبه‌های صیقلی. انگشتر سیگنت با طراحی بدون نگین، به‌خوبی با استایل‌های روزمره هماهنگ می‌شود. پیش از خرید، اندازهٔ انگشت خود را با جدول سایز مقایسه کنید.", material: "استیل ضدزنگ · پرداخت براق", price: 390000, compareAt: 490000, stock: 15, image: "/images/product-ring.webp", colors: [silver], sizes: ["8", "9", "10", "11"], featured: true, active: true },
  { id: 5, slug: "sculpture-gold-earrings", name: "گوشواره حلقه‌ای آوا", category: "earrings", description: "حلقه‌های طلایی با فرم نرم و حجم متعادل؛ یک جزئیات کوچک برای روشن‌تر شدن استایل. وزن سبک و قفل راحت، این مدل را برای استفادهٔ روزمره مناسب می‌کند.", material: "استیل با آبکاری طلایی", price: 295000, compareAt: null, stock: 20, image: "/images/product-earrings.webp", colors: [gold], sizes: ["فری سایز"], featured: false, active: true },
  { id: 6, slug: "signature-gift-set", name: "ست هدیه سیگنیچر", category: "sets", description: "یک انتخاب فکرشده برای کسی که دوستش دارید. ترکیبی از گردنبند، دستبند و انگشتر هماهنگ در جعبهٔ هدیهٔ مشکی. جزئیاتی که هدیهٔ شما را شخصی‌تر می‌کنند.", material: "ست سه‌تکه استیل · جعبه هدیه", price: 980000, compareAt: 1250000, stock: 9, image: "/images/product-gift.webp", colors: [silver], sizes: ["استاندارد"], featured: false, active: true },
  { id: 7, slug: "signature-leather-belt", name: "کمربند چرم سیگنیچر", category: "belts", description: "کمربندی با بافت برجسته و سگک مینیمال برای استایل‌های رسمی و نیمه‌رسمی. طراحی کاربردی و ظاهر ساده، آن را به یکی از آیتم‌های همیشگی کمد شما تبدیل می‌کند.", material: "چرم طبیعی · سگک نقره‌ای", price: 795000, compareAt: null, stock: 8, image: "/images/product-belt.webp", colors: [black], sizes: ["105", "115", "125"], featured: false, active: true },
  { id: 8, slug: "everyday-chain", name: "گردنبند زنجیری اِوری‌دی", category: "necklaces", description: "زنجیری ساده و همیشه قابل‌استفاده برای استایل هر روز شما. طراحی یکدست، درخشش کم و طول قابل‌انتخاب برای ترکیب با انواع یقه‌ها.", material: "استیل ضدزنگ", price: 310000, compareAt: null, stock: 12, image: "/images/product-chain.webp", colors: [silver], sizes: ["45", "50"], featured: false, active: true },
];
export const money = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
export const digits = (value: string) => value.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
export const categoryName = (id: string) => categories.find(c => c.id === id)?.name ?? id;
export const orderStatuses: Record<string, string> = { pending: "در انتظار تأیید", confirmed: "تأیید شده", packing: "در حال آماده‌سازی", shipped: "ارسال شده", delivered: "تحویل شده", cancelled: "لغو شده" };
export const discountPercent = (p: Product) => p.compareAt && p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
