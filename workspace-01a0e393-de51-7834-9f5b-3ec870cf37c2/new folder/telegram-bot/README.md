# 🤖 ربات تلگرام ژیوار — راهنمای اجرا

## ✨ قابلیت‌ها

| قابلیت | دستور / مسیر |
|---|---|
| منوی اصلی با دکمه‌های شیشه‌ای | `/start` |
| راهنما | `/help` |
| مرور دسته‌بندی‌ها و محصولات | `/products` یا دکمه 🛍️ |
| جستجوی متنی | تایپ مستقیم نام محصول |
| افزودن به سبد، تغییر تعداد، حذف | دکمه‌های شیشه‌ای |
| ثبت سفارش کامل (نام، تلفن، نشانی) | دکمه «✅ ثبت سفارش» |
| پیگیری سفارش | `/orders` |
| مشاوره سایز (قانون سایزبندی + BMI) | `/size` یا دکمه 📏 |
| **چت با مشاور استایل AI** | `/stylist` یا دکمه 🤖 |
| پشتیبانی (فوروارد به ادمین + پاسخ) | `/support` |
| افزودن «کل ست» به سبد | دکمه ✨ ست کامل رو ببین |
| انتشار در کانال (ادمین) | `/broadcast <متن>` |
| انتشار محصول در کانال (ادمین) | `/notify <productId>` |
| پاسخ به کاربر (ادمین) | `/reply_<userId> <متن>` |
| آمار سریع (ادمین) | `/stats` |

## 🚀 اجرا

```bash
# ۱. نصب
npm install

# ۲. تنظیمات
cp .env.example .env
#   → TELEGRAM_BOT_TOKEN از @BotFather بگیر
#   → ADMIN_IDS از @userinfobot بگیر
#   → API_BASE_URL رو به بک‌اند فروشگاه وصل کن

# ۳. اجرا
npm start
```

## 🔌 API مورد نیاز از بک‌اند فروشگاه

ربات این endpoint‌ها را صدا می‌زند (همه JSON):

```
GET  /api/products?category=clothing&page=0&limit=6     → { items:[], total }
GET  /api/products/:id                                   → { id, name, price, oldPrice, discount, stock, rating, reviewCount, description, image }
GET  /api/products/search?q=...                          → { items:[] }
GET  /api/products/:id/outfit                            → { items:[], total }   (AI Outfit Builder)
POST /api/orders                                         → { code, total, paymentUrl }
GET  /api/orders?telegramId=123                          → [{ code, total, status, statusFa }]
GET  /api/admin/stats                                    → { revenue, orders, activeUsers }
```

## 🧠 هوش مصنوعی

فایل `.env` مقادیر زیر را دارد — `AI_BASE_URL` را می‌توانی به هر سرویس **OpenAI-compatible** (از جمله سرویس‌دهنده ایرانی یا واسط) تغییر بدهی:

```env
AI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

پرامپت سیستمی مشاور استایل در `bot.js` (ثابت `STYLIST_SYSTEM`) قرار دارد و در فایل
[`../ai-stylist/prompts.md`](../ai-stylist/prompts.md) نسخه کامل و بهینه‌شده آن آماده است.

## ⚠️ نکات پروداکشن

1. **نشست (Session):** الان in-memory است. با Redis (`ioredis`) جایگزین کن تا بعد از ری‌استارت حفظ شود.
2. **حالت Webhook:** برای پروداکشن `BOT_MODE=webhook` و `WEBHOOK_DOMAIN` را ست کن (نیاز به دامنه با SSL).
3. **پرداخت:** لینک پرداخت (`paymentUrl`) را از درگاه ایرانی (زرین‌پال/آیدی‌پی) بگیر و پس از بازگشت کاربر، وضعیت سفارش را با `verify` به‌روز کن.
4. **نوتیف ناموجود شدن:** یک کرون‌جاب بگذار که موجود شدن محصولات ناموجود را به کانال/کاربران خبر دهد.
5. **محدودیت نرخ:** برای جلوگیری از اسپم، حداکثر ۲۰ پیام در دقیقه به ازای هر کاربر اعمال کن.
