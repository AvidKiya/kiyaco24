import { pgTable, serial, text, integer, boolean, timestamp, jsonb, uuid, index } from "drizzle-orm/pg-core";

export type ProductColor = { name: string; hex: string };
export type OrderItem = { productId: number; name: string; image: string; quantity: number; price: number; size: string; color: string };

export const products = pgTable("kiya_products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  material: text("material").notNull().default("استیل"),
  price: integer("price").notNull(),
  compareAt: integer("compare_at"),
  stock: integer("stock").notNull().default(0),
  image: text("image").notNull(),
  colors: jsonb("colors").$type<ProductColor[]>().notNull().default([]),
  sizes: jsonb("sizes").$type<string[]>().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  active: boolean("active").notNull().default(true),
  /** فاز ۱۵ — بازنویسی سئو (null = خودکار از نام/توضیح محصول) */
  seo: jsonb("seo").$type<{ title?: string; description?: string } | null>().default(null),
  /** فاز ۱۶ — گالری چندتصویری (آدرس تصاویر اضافه، غیر از تصویر اصلی) */
  gallery: jsonb("gallery").$type<string[]>().notNull().default([]),
  /** فاز ۱۶ — آدرس ویدیوی محصول (mp4/webm؛ خالی = بدون ویدیو) */
  video: text("video").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("kiya_orders", {
  customerId: integer("customer_id"),
  /** حساب مشتری (اگر با حساب کاربری ثبت شده باشد) */
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  requestKey: text("request_key").notNull().unique(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  postalCode: text("postal_code").notNull().default(""),
  items: jsonb("items").$type<OrderItem[]>().notNull(),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  shipping: integer("shipping").notNull().default(0),
  total: integer("total").notNull(),
  coupon: text("coupon"),
  delivery: text("delivery").notNull().default("shipping"),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  /* فاز ۱۴: روش و مرجع پرداخت + رسید کارت‌به‌کارت */
  paymentMethod: text("payment_method").notNull().default(""),
  paymentRef: text("payment_ref").notNull().default(""),
  receiptImage: text("receipt_image").notNull().default(""),
  trackingNumber: text("tracking_number").notNull().default(""),
  note: text("note").notNull().default(""),
  /* ---- فاز ۵: سیستم هدیه ---- */
  giftMessage: text("gift_message").notNull().default(""),
  giftWrap: boolean("gift_wrap").notNull().default(false),
  giftCard: text("gift_card").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("kiya_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").notNull().default("کیا اکسسوری"),
  announcement: text("announcement").notNull().default("یه جزئیات کوچیک، یه تغییر بزرگ!"),
  shippingThreshold: integer("shipping_threshold").notNull().default(1500000),
  shippingCost: integer("shipping_cost").notNull().default(65000),
  instagramUrl: text("instagram_url").notNull().default(""),
  telegramUrl: text("telegram_url").notNull().default(""),
  botUrl: text("bot_url").notNull().default(""),
  supportPhone: text("support_phone").notNull().default(""),
  address: text("address").notNull().default(""),
  heroTitle: text("hero_title").notNull().default("استایل تو،"),
  heroAccent: text("hero_accent").notNull().default("امضای تو."),
  heroDescription: text("hero_description").notNull().default("کمربند و اکسسوری‌هایی که فقط یک جزئیات نیستن؛\nبخشی از شخصیت تو هستن."),
  heroImage: text("hero_image").notNull().default("/images/hero-belt.webp"),
  heroButton: text("hero_button").notNull().default("کالکشن رو ببین"),
  heroLink: text("hero_link").notNull().default("/shop"),
  /** فاز ۱۴: تنظیمات پرداخت (زرین‌پال/کارت‌به‌کارت/پیک) — null = غیرفعال */
  payment: jsonb("payment").$type<{ zarinpalEnabled?: boolean; merchantId?: string; sandbox?: boolean; cardEnabled?: boolean; cardNumber?: string; cardName?: string; courierEnabled?: boolean; courierCost?: number; courierNote?: string } | null>().default(null),
  /** فاز ۱۵ — سئوی سراسری سایت (null = پیش‌فرض داخلی) */
  seo: jsonb("seo").$type<{ metaTitle?: string; metaDescription?: string; ogImage?: string; googleVerification?: string } | null>().default(null),
  /** فاز ۱۳: منوهای هدر و فوتر — قابل مدیریت از پنل؛ null = پیش‌فرض داخلی */
  menus: jsonb("menus").$type<{ header: { label: string; href: string }[]; shopTitle: string; shop: { label: string; href: string }[]; helpTitle: string; help: { label: string; href: string }[] } | null>().default(null),
});

export const media = pgTable("kiya_media", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminUsers = pgTable("kiya_admin", {
  id: integer("id").primaryKey().default(1),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const adminSessions = pgTable("kiya_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
});
export const coupons = pgTable("kiya_coupons", {
  code: text("code").primaryKey(),
  percent: integer("percent").notNull(),
  maxUses: integer("max_uses").notNull().default(100),
  used: integer("used").notNull().default(0),
  active: boolean("active").notNull().default(true),
  /* ---- فاز ۵: کوپن پیشرفته ---- */
  type: text("type").notNull().default("percent"),        // percent | fixed
  minOrder: integer("min_order").notNull().default(0),     // حداقل مبلغ سفارش
  maxDiscount: integer("max_discount").notNull().default(0), // سقف تخفیف (۰ = بی‌نهایت)
  firstOrderOnly: boolean("first_order_only").notNull().default(false),
  categoryIds: jsonb("category_ids").$type<string[]>().notNull().default([]),
  productIds: jsonb("product_ids").$type<number[]>().notNull().default([]),
  expiresAt: timestamp("expires_at"),
  perUserLimit: integer("per_user_limit").notNull().default(0), // سقف استفادهٔ هر مشتری (۰ = بی‌نهایت)
});
export const subscribers = pgTable("kiya_subscribers", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const messages = pgTable("kiya_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  بخش‌های مدیریت‌پذیر ویترین v2 (فاز ۲ نقشهٔ راه)
 * ============================================================ */

/** اسلایدهای بنر اصلی — کاملاً مدیریت‌پذیر از پنل */
export const heroSlides = pgTable("kiya_hero_slides", {
  id: serial("id").primaryKey(),
  eyebrow: text("eyebrow").notNull().default(""),
  title: text("title").notNull().default(""),
  accent: text("accent").notNull().default(""),
  description: text("description").notNull().default(""),
  image: text("image").notNull().default("/images/hero-belt.webp"),
  button: text("button").notNull().default("مشاهده"),
  link: text("link").notNull().default("/shop"),
  label: text("label").notNull().default(""),
  /** فاز ۱۳: تصویر جداگانهٔ موبایل (خالی = همان تصویر اصلی) */
  mobileImage: text("mobile_image").notNull().default(""),
  /** فاز ۱۳: بازهٔ نمایش کمپین — null یعنی همیشه */
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/** فروش ویژهٔ زمان‌دار — کاونت‌داکن از سرور کنترل می‌شود */
export const flashSales = pgTable("kiya_flash_sales", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("فروش ویژهٔ امروز"),
  subtitle: text("subtitle").notNull().default(""),
  productIds: jsonb("product_ids").$type<number[]>().notNull().default([]),
  endsAt: timestamp("ends_at").notNull(),
  active: boolean("active").notNull().default(true),
});

/** ترندهای امروز — رنگ/مد/جنس/استایل با اتصال مستقیم به محصول */
export const trends = pgTable("kiya_trends", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  productIds: jsonb("product_ids").$type<number[]>().notNull().default([]),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/** SHOP THE LOOK — ست کامل با یک کلیک به سبد */
export const looks = pgTable("kiya_looks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  image: text("image").notNull().default("/images/hero-belt.webp"),
  productIds: jsonb("product_ids").$type<number[]>().notNull().default([]),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/** نظرات مشتریان — نیازمند تأیید مدیر */
export const reviews = pgTable("kiya_reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  name: text("name").notNull(),
  /** شماره موبایل نظردهنده — فاز ۹: پیوند نظر به حساب مشتری */
  phone: text("phone").notNull().default(""),
  rating: integer("rating").notNull().default(5),
  text: text("text").notNull().default(""),
  image: text("image").notNull().default(""),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** پرسش و پاسخ محصول — پاسخ توسط مدیر ثبت می‌شود */
export const questions = pgTable("kiya_questions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  name: text("name").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull().default(""),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۵ — گیفت‌کارت (اعتبار هدیه)
 * ============================================================ */
export const giftCards = pgTable("kiya_gift_cards", {
  code: text("code").primaryKey(),
  balance: integer("balance").notNull().default(0),
  initialBalance: integer("initial_balance").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const giftCardUses = pgTable("kiya_gift_card_uses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  phone: text("phone").notNull(),
  amount: integer("amount").notNull().default(0),
  orderCode: text("order_code").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۶ — سیستم B2B عمده (همکاری، لایهٔ قیمت، سفارش عمده)
 * ============================================================ */
export type PartnerOrderItem = { productId: number; name: string; image: string; quantity: number; retailPrice: number; partnerPrice: number; size: string; color: string };

/** لایه‌های قیمت همکار — Retail / Wholesale / VIP Wholesale / Distributor / Special Partner */
export const partnerTiers = pgTable("kiya_partner_tiers", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  discountType: text("discount_type").notNull().default("percent"), // percent | fixed
  discountValue: integer("discount_value").notNull().default(0),    // درصد یا قیمت ثابت هر قلم
  minOrder: integer("min_order").notNull().default(0),              // حداقل مبلغ سفارش برای این لایه
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** حساب‌های همکار — درخواست از لندینگ، تأیید توسط مدیر */
export const partners = pgTable("kiya_partners", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""),
  businessName: text("business_name").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  city: text("city").notNull().default(""),
  landline: text("landline").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  about: text("about").notNull().default(""),
  tierId: integer("tier_id"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | suspended
  note: text("note").notNull().default(""),
  approvedAt: timestamp("approved_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const partnerSessions = pgTable("kiya_partner_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  partnerId: integer("partner_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

/** سفارش‌های عمده — با قیمت همکار و امکان صدور فاکتور */
export const partnerOrders = pgTable("kiya_partner_orders", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  requestKey: text("request_key").notNull().unique(),
  partnerId: integer("partner_id").notNull(),
  items: jsonb("items").$type<PartnerOrderItem[]>().notNull(),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  shipping: integer("shipping").notNull().default(0),
  total: integer("total").notNull(),
  tierName: text("tier_name").notNull().default(""),
  status: text("status").notNull().default("pending"), // pending | confirmed | shipped | delivered | cancelled
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  /* فاز ۱۴: روش و مرجع پرداخت + رسید کارت‌به‌کارت */
  paymentMethod: text("payment_method").notNull().default(""),
  paymentRef: text("payment_ref").notNull().default(""),
  receiptImage: text("receipt_image").notNull().default(""),
  trackingNumber: text("tracking_number").notNull().default(""),
  note: text("note").notNull().default(""),
  invoiceNumber: text("invoice_number").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۷ — Fashion Daily (روزنامهٔ دیجیتال)
 * ============================================================ */

/** سکشن‌های روزنامه — ترتیب نمایش در صفحهٔ امروز */
export type ArticleSection =
  | "main-story" | "trending-now" | "fashion-news" | "accessory-trend"
  | "color-of-day" | "style-inspiration" | "product-spotlight" | "editors-pick";

/** مقالات روزنامه — انتشار روزانه و زمان‌بندی‌شده از پنل */
export const articles = pgTable("kiya_articles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().default(""),
  section: text("section").notNull().default("main-story"),
  title: text("title").notNull(),
  kicker: text("kicker").notNull().default(""),        // نوار بالای تیتر
  excerpt: text("excerpt").notNull().default(""),
  body: text("body").notNull().default(""),
  image: text("image").notNull().default("/images/hero-belt.webp"),
  colorHex: text("color_hex").notNull().default("#D19B44"), // رنگِ روز
  author: text("author").notNull().default("تیم کیا"),
  readMinutes: integer("read_minutes").notNull().default(3),
  editionDate: timestamp("edition_date").notNull().defaultNow(), // تاریخ روزنامه
  publishAt: timestamp("publish_at").notNull().defaultNow(),      // زمان‌بندی انتشار
  productIds: jsonb("product_ids").$type<number[]>().notNull().default([]), // Content → Commerce
  shopLabel: text("shop_label").notNull().default("SHOP THE TREND"),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۸ — Trending + Style Guide + Collections
 * ============================================================ */

/** راهنمای استایل — محتوای آموزشی بهینه برای جست‌وجو (HowTo) */
export const guides = pgTable("kiya_guides", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().default(""),
  topic: text("topic").notNull().default("sizing"),   // sizing | knotting | pairing | metal | layering | care
  title: text("title").notNull(),
  kicker: text("kicker").notNull().default(""),
  excerpt: text("excerpt").notNull().default(""),
  body: text("body").notNull().default(""),
  image: text("image").notNull().default("/images/hero-belt.webp"),
  author: text("author").notNull().default("تیم کیا"),
  readMinutes: integer("read_minutes").notNull().default(3),
  publishAt: timestamp("publish_at").notNull().defaultNow(),
  productIds: jsonb("product_ids").$type<number[]>().notNull().default([]),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** کالکشن‌های داینامیک با لندینگ اختصاصی */
export const collections = pgTable("kiya_collections", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().default(""),
  name: text("name").notNull(),
  label: text("label").notNull().default(""),          // برچسب انگلیسی روی لندینگ
  subtitle: text("subtitle").notNull().default(""),
  description: text("description").notNull().default(""),
  image: text("image").notNull().default("/images/hero-belt.webp"),
  colorHex: text("color_hex").notNull().default("#D19B44"),
  badge: text("badge").notNull().default(""),          // مثلاً «جدید» یا «محدود»
  productIds: jsonb("product_ids").$type<number[]>().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۹ — حساب مشتری + باشگاه مشتریان + سیستم معرف
 * ============================================================ */

export type CustomerAddress = { id: string; label: string; receiver: string; phone: string; city: string; address: string; postalCode: string };

/** حساب مشتری — ورود با رمز یا کد یک‌بارمصرف پیامکی */
export const customers = pgTable("kiya_customers", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull().default(""),
  birthDate: text("birth_date").notNull().default(""),
  city: text("city").notNull().default(""),
  email: text("email").notNull().default(""),
  addresses: jsonb("addresses").$type<CustomerAddress[]>().notNull().default([]),
  walletBalance: integer("wallet_balance").notNull().default(0),
  points: integer("points").notNull().default(0),
  lifetimePoints: integer("lifetime_points").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  orderCount: integer("order_count").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: integer("referred_by"),
  birthdayRewarded: text("birthday_rewarded").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

export const customerSessions = pgTable("kiya_customer_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  customerId: integer("customer_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

/** کدهای یک‌بارمصرف ورود پیامکی */
export const otpCodes = pgTable("kiya_otp_codes", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** سابقهٔ امتیازها — هر تغییر با دلیل ثبت می‌شود */
export const pointsLogs = pgTable("kiya_points_logs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  points: integer("points").notNull(),
  reason: text("reason").notNull().default(""),
  orderCode: text("order_code").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** تراکنش‌های کیف پول مشتری */
export const walletTxns = pgTable("kiya_wallet_txns", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  amount: integer("amount").notNull(),
  kind: text("kind").notNull().default("credit"),   // credit | debit | refund
  note: text("note").notNull().default(""),
  orderCode: text("order_code").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** سیستم معرف — دعوت‌نامه و پاداش */
export const referrals = pgTable("kiya_referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredId: integer("referred_id"),
  code: text("code").notNull(),
  status: text("status").notNull().default("clicked"),  // clicked | registered | purchased | rewarded
  rewardPoints: integer("reward_points").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** اعلان‌های مشتری */
export const notifications = pgTable("kiya_notifications", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  link: text("link").notNull().default(""),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۱۰ — اعلان‌ها و مارکتینگ اتوماسیون
 * ============================================================ */

/** قانون اتوماسیون: چه رویدادی، از کدام کانال، با چه متنی */
export const alertRules = pgTable("kiya_alert_rules", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  trigger: text("trigger").notNull(),
  channels: text("channels").array().notNull().default([]),
  smsBody: text("sms_body").notNull().default(""),
  emailSubject: text("email_subject").notNull().default(""),
  emailBody: text("email_body").notNull().default(""),
  pushBody: text("push_body").notNull().default(""),
  delayMinutes: integer("delay_minutes").notNull().default(0),
  active: boolean("active").notNull().default(true),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** صف پیام‌های خروجی — وضعیت: pending/sent/failed */
export const outbox = pgTable("kiya_outbox", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(),
  recipient: text("recipient").notNull().default(""),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  link: text("link").notNull().default(""),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  provider: text("provider").notNull().default(""),
  error: text("error").notNull().default(""),
  ruleKey: text("rule_key").notNull().default(""),
  customerId: integer("customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
});

/** درخواست اطلاع‌رسانی موجود شدن و کاهش قیمت */
export const stockAlerts = pgTable("kiya_stock_alerts", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  type: text("type").notNull().default("back_in_stock"),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  priceAtRequest: integer("price_at_request").notNull().default(0),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** سبد رهاشده برای اتوماسیون یادآوری */
export const abandonedCarts = pgTable("kiya_abandoned_carts", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().default(""),
  customerId: integer("customer_id"),
  items: jsonb("items").$type<{ productId: number; name: string; image: string; price: number; quantity: number; size: string; color: string }[]>().notNull(),
  total: integer("total").notNull().default(0),
  step: text("step").notNull().default("cart"),
  reminders: integer("reminders").notNull().default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  recoveredAt: timestamp("recovered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** اشتراک Push مرورگر (PWA) */
export const pushSubscriptions = pgTable("kiya_push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull().default(""),
  auth: text("auth").notNull().default(""),
  customerId: integer("customer_id"),
  phone: text("phone").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۱۱: لایهٔ هوش مصنوعی
 * ============================================================ */

/** تنظیمات سرویس AI — یک ردیف؛ قابل مدیریت کامل از پنل (بدون نیاز به کد) */
export const aiSettings = pgTable("kiya_ai_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  /** آدرس پایهٔ سرویس OpenAI-compatible (سرویس ایرانی/واسط/مدل متن‌باز) */
  baseUrl: text("base_url").notNull().default(""),
  apiKey: text("api_key").notNull().default(""),
  model: text("model").notNull().default(""),
  /** دما ×۱۰۰ (مثلاً ۷۰ یعنی 0.7) */
  temperature: integer("temperature").notNull().default(70),
  maxTokens: integer("max_tokens").notNull().default(700),
  /** سقف توکن ماهانه؛ ۰ یعنی بدون سقف — بعد از عبور، پاسخ آفلاین */
  monthlyTokenBudget: integer("monthly_token_budget").notNull().default(0),
  /** روشن/خاموش هر قابلیت: stylist, search, size, recommend, captions, trends */
  features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  assistantName: text("assistant_name").notNull().default("مشاور کیا"),
});

/** گزارش مصرف AI برای پایش هزینهٔ توکن */
export const aiLogs = pgTable("kiya_ai_logs", {
  id: serial("id").primaryKey(),
  feature: text("feature").notNull(),
  source: text("source").notNull().default("fallback"),
  model: text("model").notNull().default(""),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  error: text("error").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** کش پاسخ‌های تکراری برای صرفه‌جویی در هزینهٔ توکن */
export const aiCache = pgTable("kiya_ai_cache", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  feature: text("feature").notNull().default(""),
  response: jsonb("response").notNull(),
  hits: integer("hits").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۱۲: ربات تلگرام
 * ============================================================ */

/** تنظیمات ربات — یک ردیف؛ کاملاً از پنل قابل مدیریت (env فقط جایگزین) */
export const tgSettings = pgTable("kiya_tg_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  botToken: text("bot_token").notNull().default(""),
  botUsername: text("bot_username").notNull().default(""),
  /** شناسهٔ کانال برای انتشار خودکار (مثل ‎@KiyaAccessory یا -100xxxx) */
  channelId: text("channel_id").notNull().default(""),
  /** شناسه‌های چت مدیر (با کاما) برای دستورهای /stats و /broadcast */
  adminChatIds: text("admin_chat_ids").notNull().default(""),
  webhookSecret: text("webhook_secret").notNull().default(""),
  webhookUrl: text("webhook_url").notNull().default(""),
  /** آدرس عمومی سایت برای لینک‌های داخل پیام‌ها */
  siteUrl: text("site_url").notNull().default(""),
  autoPublish: boolean("auto_publish").notNull().default(true),
});

/** نشست هر چت: سبد، مرحلهٔ گفتگو و اطلاعات تماس */
export const tgChats = pgTable("kiya_tg_chats", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull().unique(),
  name: text("name").notNull().default(""),
  username: text("username").notNull().default(""),
  phone: text("phone").notNull().default(""),
  state: jsonb("state").$type<Record<string, unknown>>().notNull().default({}),
  blocked: boolean("blocked").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۱۳: Homepage Builder
 * ============================================================ */

/** سکشن‌های صفحهٔ اصلی — ترتیب/فعال‌سازی بدون کد؛ key های داخلی + سکشن‌های دلخواه */
export const homeSections = pgTable("kiya_home_sections", {
  id: serial("id").primaryKey(),
  /** یکی از سکشن‌های داخلی (hero, trust, categories, ...) یا "custom" */
  key: text("key").notNull().default("custom"),
  title: text("title").notNull().default(""),
  subtitle: text("subtitle").notNull().default(""),
  /** چیدمان سکشن دلخواه: banner | products | split */
  layout: text("layout").notNull().default("banner"),
  config: jsonb("config").$type<{ image?: string; text?: string; cta?: string; link?: string; productIds?: number[]; background?: string }>().notNull().default({}),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۱۴: پرداخت آنلاین و مرجوعی
 * ============================================================ */

/** تراکنش‌های درگاه — تأیید مبلغ همیشه سمت سرور از روی همین جدول */
export const transactions = pgTable("kiya_transactions", {
  id: serial("id").primaryKey(),
  orderCode: text("order_code").notNull(),
  amount: integer("amount").notNull(),
  authority: text("authority").notNull().unique(),
  refId: text("ref_id").notNull().default(""),
  gateway: text("gateway").notNull().default("mock"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
});

/** درخواست‌های مرجوعی: requested → approved/rejected → refunded */
export const returns = pgTable("kiya_returns", {
  id: serial("id").primaryKey(),
  orderCode: text("order_code").notNull(),
  phone: text("phone").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("requested"),
  adminNote: text("admin_note").notNull().default(""),
  refundAmount: integer("refund_amount").notNull().default(0),
  refundMethod: text("refund_method").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ============================================================
 *  فاز ۱۵ — رویدادهای آنالیتیکس (بدون سرویس خارجی، روی همین DB)
 * ============================================================ */
export const events = pgTable("kiya_events", {
  id: serial("id").primaryKey(),
  /** view_product | add_to_cart | begin_checkout | purchase | search | wishlist | view_article | view_guide | view_collection | wholesale_request */
  type: text("type").notNull(),
  /** اسلاگ محصول/مقاله، عبارت جستجو یا کد سفارش */
  ref: text("ref").notNull().default(""),
  /** مبلغ برای purchase (تومان)؛ برای بقیه ۰ */
  value: integer("value").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [index("kiya_events_type_idx").on(table.type, table.createdAt)]);
