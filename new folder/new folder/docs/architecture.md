# 🏗️ معماری فنی پلتفرم ژیوار

## ۱. نمای کلی

```
┌──────────────────────────────────────────────────────────────┐
│                        کلاینت‌ها                              │
│   🌐 وب‌اپ (Next.js PWA)   📱 ربات تلگرام   📣 کانال تلگرام   │
└───────────────┬──────────────────────┬───────────────────────┘
                │                      │
        ┌───────▼───────┐      ┌───────▼───────┐
        │  API Gateway  │      │  Bot Service  │
        │   (REST/JSON) │      │  (bot.js)     │
        └───────┬───────┘      └───────┬───────┘
                │                      │
        ┌───────▼──────────────────────▼───────┐
        │           Core Services              │
        │  ┌─────────┐ ┌─────────┐ ┌────────┐ │
        │  │ Product│ │  Order  │ │  User  │ │
        │  │ Service│ │ Service │ │ Service│ │
        │  └─────────┘ └─────────┘ └────────┘ │
        │  ┌─────────┐ ┌─────────┐ ┌────────┐ │
        │  │ Payment│ │  AI     │ │ Notify │ │
        │  │ (زرین‌پال)│ │Stylist │ │(SMS/TG)│ │
        │  └─────────┘ └─────────┘ └────────┘ │
        └───────┬──────────────────┬──────────┘
                │                  │
        ┌───────▼──────┐   ┌───────▼───────┐   ┌────────────┐
        │  PostgreSQL  │   │    Redis      │   │ Meilisearch│
        │  (داده اصلی) │   │ (کش/نشست/سبد) │   │  (جستجو)   │
        └──────────────┘   └───────────────┘   └────────────┘
```

## ۲. پایگاه داده (PostgreSQL)

```sql
-- ===== کاربران =====
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  phone         VARCHAR(15) UNIQUE NOT NULL,
  name          VARCHAR(100),
  telegram_id   BIGINT UNIQUE,
  email         VARCHAR(150),
  height_cm     INT,                 -- برای پیشنهاد سایز AI
  weight_kg     INT,
  usual_size    VARCHAR(10),
  style_profile JSONB,               -- نتیجه کوییز استایل
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===== دسته‌بندی‌ها =====
CREATE TABLE categories (
  id      VARCHAR(50) PRIMARY KEY,   -- clothing, accessories, lingerie, sets
  name    VARCHAR(100) NOT NULL,
  icon    VARCHAR(10),
  parent_id VARCHAR(50) REFERENCES categories(id)
);

-- ===== محصولات =====
CREATE TABLE products (
  id           BIGSERIAL PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  slug         VARCHAR(220) UNIQUE NOT NULL,
  category_id  VARCHAR(50) REFERENCES categories(id),
  description  TEXT,
  material     VARCHAR(100),
  color        VARCHAR(50),
  price        BIGINT NOT NULL,               -- تومان
  old_price    BIGINT,
  stock        INT DEFAULT 0,
  rating       DECIMAL(2,1) DEFAULT 0,
  review_count INT DEFAULT 0,
  size_chart   JSONB,                          -- جدول اندازه
  images       TEXT[],                         -- URL تصاویر
  tags         TEXT[],                         -- 'جدید','پرفروش'
  ai_metadata  JSONB,                          -- embedding/ترند برای جستجوی تصویری
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_products_category ON products(category_id, is_active);

-- ===== سبد خرید (پایدار در Redis، این جدول برای تحلیل) =====
CREATE TABLE carts (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id),
  items      JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== سفارش‌ها =====
CREATE TABLE orders (
  id           BIGSERIAL PRIMARY KEY,
  code         VARCHAR(20) UNIQUE NOT NULL,    -- ZH-۱۴۰۵...
  user_id      BIGINT REFERENCES users(id),
  source       VARCHAR(20) DEFAULT 'web',      -- web | telegram
  status       VARCHAR(20) DEFAULT 'pending',  -- pending,paid,shipping,delivered,canceled
  items        JSONB NOT NULL,
  subtotal     BIGINT NOT NULL,
  shipping_fee BIGINT DEFAULT 0,
  discount     BIGINT DEFAULT 0,
  total        BIGINT NOT NULL,
  address      JSONB NOT NULL,
  payment_ref  VARCHAR(100),                   -- شناسه تراکنش درگاه
  tracking_code VARCHAR(50),                   -- کد رهگیری پست/پیک
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ===== مرجوعی =====
CREATE TABLE returns (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT REFERENCES orders(id),
  reason     TEXT,
  status     VARCHAR(20) DEFAULT 'requested',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== علاقه‌مندی‌ها =====
CREATE TABLE wishlists (
  user_id    BIGINT REFERENCES users(id),
  product_id BIGINT REFERENCES products(id),
  PRIMARY KEY (user_id, product_id)
);

-- ===== نظرات =====
CREATE TABLE reviews (
  id         BIGSERIAL PRIMARY KEY,
  product_id BIGINT REFERENCES products(id),
  user_id    BIGINT REFERENCES users(id),
  rating     INT CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== کانال/ربات تلگرام =====
CREATE TABLE telegram_subscribers (
  telegram_id BIGINT PRIMARY KEY,
  username    VARCHAR(100),
  joined_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ===== لاگ AI (برای بهبود پرامپت‌ها) =====
CREATE TABLE ai_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT,
  type       VARCHAR(30),       -- stylist, size, outfit, caption
  prompt     TEXT,
  response   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## ۳. API اصلی

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/products?category=&page=&limit=` | لیست محصولات با فیلتر |
| GET | `/api/products/:slug` | جزئیات محصول |
| GET | `/api/products/search?q=` | جستجوی متنی (Meilisearch) |
| POST | `/api/products/visual-search` | جستجوی تصویری (فاز ۴) |
| GET | `/api/products/:id/outfit` | ست پیشنهادی AI |
| POST | `/api/auth/otp` | ارسال کد تأیید پیامکی |
| POST | `/api/auth/verify` | ورود/ثبت‌نام |
| GET/POST | `/api/cart` | سبد خرید (Redis-backed) |
| POST | `/api/orders` | ثبت سفارش |
| GET | `/api/orders?telegramId=` | سفارش‌های کاربر |
| POST | `/api/payment/request` | ساخت لینک پرداخت زرین‌پال |
| POST | `/api/payment/verify` | تأیید تراکنش + تغییر وضعیت سفارش |
| POST | `/api/ai/stylist` | چت مشاور استایل |
| POST | `/api/ai/size` | پیشنهاد سایز |
| POST | `/api/ai/caption` | تولید کپشن (ادمین) |
| GET | `/api/admin/stats` | آمار داشبورد |
| CRUD | `/api/admin/products` | مدیریت محصولات |

## ۴. ملاحظات ایران‌محور

- **پرداخت:** زرین‌پال / آیدی‌پی — همیشه `verify` سمت سرور را چک کن، هرگز به فرانت اعتماد نکن.
- **پیامک:** کاوه‌نگار یا SMS.ir برای OTP و اطلاع‌رسانی سفارش.
- **میزبانی:** سرور داخل ایران برای سرعت پرداخت و API درگاه؛ سرویس AI جداگانه (خارج یا واسط).
- **دامنه:** ثبت `.ir` از طریق ثبت‌کننده‌های معتبر + `icann`备案.
- **SSL:** برای PWA و امنیت پرداخت الزامی است.
- **بهینه‌سازی تصویر:** WebP + اندازه‌های responsive — مهم‌ترین عامل سرعت روی موبایل.

## ۵. امنیت

- محدودسازی نرخ (Rate limit): ۵ درخواست OTP در ساعت، ۲۰ پیام AI در دقیقه
- اعتبارسنجی سمت سرور برای قیمت و موجودی سبد (هرگز قیمت از کلاینت قبول نشود)
- فیلتر محتوای ورودی/خروجی AI
- رمزنگاری داده‌های حساس کاربران (نشانی، تلفن)
- بکاپ خودکار روزانه پایگاه داده
