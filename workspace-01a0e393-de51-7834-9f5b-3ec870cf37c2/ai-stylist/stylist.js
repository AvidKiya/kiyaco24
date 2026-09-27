/**
 * ============================================================
 *  ژیوار | AI Stylist Service
 *  سرویس هوش مصنوعی: مشاور استایل، پیشنهاد سایز،
 *  سازنده ست خودکار و تولید کپشن
 * ============================================================
 *  سازگار با هر API از نوع OpenAI-compatible
 *  (AI_BASE_URL را می‌توانی به سرویس‌دهنده ایرانی یا واسط تغییر بدهی)
 */

require('dotenv').config();

const {
  AI_API_KEY,
  AI_BASE_URL = 'https://api.openai.com/v1',
  AI_MODEL = 'gpt-4o-mini',
} = process.env;

if (!AI_API_KEY) {
  console.warn('⚠️  AI_API_KEY تنظیم نشده — سرویس AI غیرفعال است.');
}

/* ============================================================
 *  هسته: فراخوانی مدل
 * ============================================================ */
async function chat({ system, messages, maxTokens = 700, temperature = 0.7, json = false }) {
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`AI API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/* ============================================================
 *  ۱. مشاور استایل (Stylist Chatbot)
 * ============================================================ */
const STYLIST_SYSTEM = `
تو «ژیوار» هستی، مشاور استایل شخصی یک فروشگاه آنلاین پوشاک، اکسسوری و لباس زیر
برای خانم‌های ایرانی. همیشه فارسی، صمیمی، گرم و حرفه‌ای جواب بده — مثل یک دوست
استایلیست، نه مثل ربات.

دستورالعمل‌ها:
۱. وقتی کاربر مناسبت یا بودجه داد، ۲ تا ۳ «ست کامل» پیشنهاد بده
   (لباس اصلی + اکسسوری + کیف/کفش + لایه بیرونی در صورت نیاز).
۲. قیمت‌ها را به تومان و با فرمت فارسی بنویس.
۳. هر پیشنهاد را با یک جمله توضیح بده که «چرا» به این کاربر می‌اد.
۴. اگر اندازه یا سایز مهم است، قد و وزن یا سایز معمول کاربر را بپرس.
۵. اگر کاربر گفت «ارزون‌تر» یا «شبیه این»، گزینه‌های جایگزین بده.
۶. هرگز محصولی پیشنهاد نده که در کاتالوگ زیر موجود نیست.
۷. کوتاه و کاربردی باش؛ حداکثر ۱۵ خط.
۸. در پایان، یک سوال کوتاه بپرس تا گفتگو ادامه پیدا کند.

کاتالوگ موجود:
{{CATALOG}}
`.trim();

/**
 * @param {string} userMessage پیام کاربر
 * @param {Array}  history      تاریخچه گفتگو [{role, content}]
 * @param {Array}  catalog      محصولات موجود [{id, name, price, category, stock}]
 */
async function askStylist(userMessage, history = [], catalog = []) {
  const catalogText = catalog.length
    ? catalog.map(p => `- ${p.name} | ${p.category} | ${fmtToman(p.price)} | موجودی: ${p.stock}`).join('\n')
    : '(کاتالوگ در دسترس نیست — فقط مشاوره عمومی بده و از پیشنهاد محصول مشخص خودداری کن)';

  const reply = await chat({
    system: STYLIST_SYSTEM.replace('{{CATALOG}}', catalogText),
    messages: [...history.slice(-8), { role: 'user', content: userMessage }],
    maxTokens: 800,
    temperature: 0.8,
  });
  return reply;
}

/* ============================================================
 *  ۲. پیشنهاد سایز هوشمند
 * ============================================================ */
const SIZE_SYSTEM = `
تو متخصص سایزبندی پوشاک در فروشگاه ژیوار هستی.
بر اساس قد، وزن و سایز معمول کاربر و جدول اندازه محصول، سایز دقیق پیشنهاد بده.
خروجی را دقیقاً در این فرمت بده:

📏 سایز پیشنهادی: [سایز]
✅ میزان تطابق: [درصد]٪
💡 نکته: [یک جمله کاربردی]

قواعد:
- برای پارچه کشدار (جرسیه، بافت): یک سایز کوچک‌تر پیشنهاد بده.
- برای کرپ، ساتن و پارچه‌های غیرکشدار: سایز بزرگ‌تر امن‌تر است.
- اگر کاربر بین دو سایز بود، دقیقاً بگو کدام و چرا.
`.trim();

/**
 * @param {{height?:number, weight?:number, usualSize?:string}} user
 * @param {{name:string, sizeChart:object}} product
 */
async function suggestSize(user, product) {
  const reply = await chat({
    system: SIZE_SYSTEM,
    messages: [{
      role: 'user',
      content:
        `محصول: ${product.name}\n` +
        `جدول اندازه: ${JSON.stringify(product.sizeChart)}\n` +
        `کاربر: قد ${user.height ?? '?'}، وزن ${user.weight ?? '?'}، سایز معمول ${user.usualSize ?? 'نامشخص'}`,
    }],
    maxTokens: 300,
    temperature: 0.3,   // دقت بالاتر = دمای پایین‌تر
  });
  return reply;
}

/* ============================================================
 *  ۳. سازنده ست خودکار (Outfit Builder)
 * ============================================================ */
const OUTFIT_SYSTEM = `
تو استایلیست ارشد ژیوار هستی. محصول اصلی را می‌بینی.
از کاتالوگ داده‌شده، ۴ قلم مکمل پیشنهاد بده:
- یک اکسسوری (گوشواره/گردنبند)
- یک کیف یا کفش
- یک لایه بیرونی یا شال
- یک قلم اختیاری بر اساس رنگ متناسب

خروجی حتماً JSON معتبر با این ساختار:
{
  "items": [{"id": "...", "name": "...", "price": 0, "reason": "یک جمله"}],
  "total": 0,
  "note": "یک جمله درباره کل ست"
}
فقط شناسه‌هایی را بده که در کاتالوگ داده‌شده وجود دارند.
`.trim();

async function buildOutfit(product, catalog) {
  const catalogText = catalog.map(p => `- id:${p.id} | ${p.name} | ${p.category} | ${p.price}`).join('\n');
  const raw = await chat({
    system: OUTFIT_SYSTEM,
    messages: [{
      role: 'user',
      content:
        `محصول اصلی: id:${product.id} | ${product.name} | ${product.category} | ${product.price}\n\n` +
        `کاتالوگ موجود:\n${catalogText}`,
    }],
    maxTokens: 700,
    temperature: 0.5,
    json: true,
  });
  try {
    return JSON.parse(raw);
  } catch {
    return { items: [], total: 0, note: 'امکان ساخت ست ناموفق بود.' };
  }
}

/* ============================================================
 *  ۴. تحلیل ترند
 * ============================================================ */
async function analyzeTrends({ sales, searches, polls }) {
  return chat({
    system: 'تو تحلیلگر ترند مد در بازار ایران هستی. خروجی: ۳ ترند رشد، ۲ ترند افت، ۳ پیشنهاد خرید، ۳ ایده محتوا. همه اعداد با فرمت فارسی و تومان.',
    messages: [{
      role: 'user',
      content: `فروش ۳۰ روز گذشته:\n${JSON.stringify(sales, null, 2)}\n\nجستجوهای سایت:\n${JSON.stringify(searches, null, 2)}\n\nنظرسنجی کانال:\n${JSON.stringify(polls, null, 2)}`,
    }],
    maxTokens: 900,
  });
}

/* ============================================================
 *  ۵. تولید کپشن و توضیح محصول
 * ============================================================ */
async function generateCaption(product) {
  return chat({
    system: 'برای محصول داده‌شده سه نسخه کپشن بنویس: ۱) اینستاگرام (ایموجی + هشتگ فارسی) ۲) کانال تلگرام (کوتاه، با دعوت به خرید از @ZhevarBot) ۳) صفحه محصول (فروشندگی، ۳ خطی).',
    messages: [{
      role: 'user',
      content: `نام: ${product.name}\nجنس: ${product.material ?? '-'}\nرنگ: ${product.color ?? '-'}\nقیمت: ${fmtToman(product.price)}\nمناسب برای: ${product.occasion ?? '-'}`,
    }],
    maxTokens: 600,
  });
}

/* ============================================================
 *  ۶. چت‌بات پشتیبانی
 * ============================================================ */
const SUPPORT_SYSTEM = `
تو دستیار پشتیبانی ژیوار هستی. سوالات متداول: سایز، ارسال، مرجوعی، پرداخت.
اگر جواب را نمی‌دانی، صادقانه بگو و به پشتیبانی انسانی ارجاع بده.
هرگز زمان ارسال یا سیاست مرجوعی را حدس نزن — فقط از سیاست‌های رسمی زیر استفاده کن:
- ارسال تهران: ۲۴ ساعته، سایر شهرها: ۲ تا ۴ روز کاری
- ارسال رایگان بالای ۵۰۰٬۰۰۰ تومان
- مرجوعی: ۷ روز، رایگان، با پلمبان بودن
- پرداخت: درگاه زرین‌پال و آیدی‌پی
`.trim();

async function askSupport(question) {
  return chat({
    system: SUPPORT_SYSTEM,
    messages: [{ role: 'user', content: question }],
    maxTokens: 400,
    temperature: 0.4,
  });
}

/* ============================================================
 *  کمکی
 * ============================================================ */
function fmtToman(n) {
  return Number(n).toLocaleString('fa-IR') + ' تومان';
}

/* ============================================================
 *  Express Router نمونه (اختیاری)
 * ============================================================ */
function stylistRouter(router) {
  router.post('/stylist', async (req, res) => {
    try {
      const { message, history = [], catalog = [] } = req.body;
      res.json({ reply: await askStylist(message, history, catalog) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/size', async (req, res) => {
    try {
      const { user, product } = req.body;
      res.json({ reply: await suggestSize(user, product) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/outfit', async (req, res) => {
    try {
      const { product, catalog } = req.body;
      res.json(await buildOutfit(product, catalog));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/support', async (req, res) => {
    try {
      const { question } = req.body;
      res.json({ reply: await askSupport(question) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = {
  chat,
  askStylist,
  suggestSize,
  buildOutfit,
  analyzeTrends,
  generateCaption,
  askSupport,
  stylistRouter,
};
