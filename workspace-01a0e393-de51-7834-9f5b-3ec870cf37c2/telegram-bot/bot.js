/**
 * ============================================================
 *  ژیوار | Zhevar — Telegram Bot
 *  ربات فروشگاهی: کاتالوگ، سبد خرید، سفارش، پیگیری،
 *  مشاوره سایز و مشاور استایل با هوش مصنوعی
 * ============================================================
 *  اجرا:  npm install  →  کپی .env.example به .env  →  npm start
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const {
  TELEGRAM_BOT_TOKEN,
  ADMIN_IDS = '',
  CHANNEL_ID = '@ZhevarStyle',
  API_BASE_URL = 'http://localhost:4000/api',
  AI_API_KEY,
  AI_BASE_URL = 'https://api.openai.com/v1',
  AI_MODEL = 'gpt-4o-mini',
  BOT_MODE = 'polling',
  WEBHOOK_DOMAIN,
  PORT = 3000,
} = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN تنظیم نشده. فایل .env رو بررسی کن.');
  process.exit(1);
}

const ADMINS = ADMIN_IDS.split(',').map(s => s.trim()).filter(Boolean);
const isAdmin = id => ADMINS.includes(String(id));

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: BOT_MODE === 'polling',
  ...(BOT_MODE === 'webhook' ? {} : {}),
});

/* ============================================================
 *  ۱. نشست کاربران (Session)
 *  در پروداکشن: Map رو با Redis جایگزین کن
 * ============================================================ */
const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      state: 'idle',        // idle | browsing | checkout | stylist | support | size
      cart: [],             // [{ id, name, price, qty }]
      category: null,
      page: 0,
      orderDraft: {},       // اطلاعات در حال تکمیل سفارش
      lastProduct: null,
    });
  }
  return sessions.get(userId);
}

function resetState(s) { s.state = 'idle'; s.orderDraft = {}; }

/* ============================================================
 *  ۲. کلاینت API بک‌اند فروشگاه
 * ============================================================ */
async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

const toman = n => Number(n).toLocaleString('fa-IR') + ' تومان';

/* ============================================================
 *  ۳. کلاینت هوش مصنوعی (OpenAI-compatible)
 *  AI_BASE_URL رو می‌تونی به سرویس‌دهنده ایرانی یا واسط تغییر بدی
 * ============================================================ */
async function askAI(messages, { maxTokens = 600 } = {}) {
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({ model: AI_MODEL, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? 'متأسفانه الان نمی‌تونم جواب بدم. 🙏';
}

const STYLIST_SYSTEM = `
تو «ژیوار» هستی، مشاور استایل شخصی یک فروشگاه آنلاین پوشاک، اکسسوری و لباس زیر برای خانم‌ها ایرانی.
قوانین:
- همیشه فارسی، صمیمی، گرم و حرفه‌ای جواب بده (مثل یه دوست استایلیست).
- وقتی کاربر مناسبت یا بودجه می‌ده، ۲ تا ۳ «ست کامل» پیشنهاد بده (لباس + اکسسوری + کیف/کفش).
- قیمت‌ها رو به تومان و با فرمت فارسی بنویس.
- اگر اندازه یا سایز مهم بود، از کاربر قد و وزن یا سایز معمولش رو بپرس.
- هر پیشنهاد رو با یک جمله توضیح بده که چرا بهش می‌اد.
- کوتاه و کاربردی باش؛ حداکثر ۱۵ خط.
`.trim();

/* ============================================================
 *  ۴. کیبوردها
 * ============================================================ */
const K = {
  main: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛍️ خرید و دسته‌بندی‌ها', callback_data: 'cats' }],
        [{ text: '🤖 مشاور استایل هوشمند', callback_data: 'stylist' }],
        [{ text: '📏 مشاوره سایز', callback_data: 'size' }, { text: '📦 سفارش‌های من', callback_data: 'orders' }],
        [{ text: '🛒 سبد خرید', callback_data: 'cart' }, { text: '💬 پشتیبانی', callback_data: 'support' }],
        [{ text: '📣 کانال ژیوار', url: 'https://t.me/ZhevarStyle' }],
      ],
    },
  },
  categories: cats => ({
    reply_markup: {
      inline_keyboard: [
        ...cats.map(c => [{ text: `${c.icon} ${c.name} (${c.count})`, callback_data: `cat_${c.id}` }]),
        [{ text: '⭐ ست‌های آماده', callback_data: 'cat_sets' }, { text: '🔥 پرفروش‌ها', callback_data: 'cat_best' }],
        [{ text: '↩️ منوی اصلی', callback_data: 'home' }],
      ],
    },
  }),
  products: (list, catId, page, totalPages) => ({
    reply_markup: {
      inline_keyboard: [
        ...list.map(p => [{ text: `${p.name} — ${toman(p.price)}`, callback_data: `p_${p.id}` }]),
        [{
          text: `${page > 0 ? '◀️ قبلی' : ' '}`,
          callback_data: `page_${catId}_${page - 1}`,
        }, {
          text: `${page < totalPages - 1 ? 'بعدی ▶️' : ' '}`,
          callback_data: `page_${catId}_${page + 1}`,
        }],
        [{ text: '↩️ دسته‌بندی‌ها', callback_data: 'cats' }, { text: '🛒 سبد خرید', callback_data: 'cart' }],
      ],
    },
  }),
  product: p => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛒 افزودن به سبد', callback_data: `add_${p.id}` }],
        [{ text: '📏 مشاوره سایز این محصول', callback_data: `size_${p.id}` }],
        [{ text: '✨ ست کامل رو ببین', callback_data: `outfit_${p.id}` }],
        [{ text: '↩️ بازگشت', callback_data: 'cats' }],
      ],
    },
  }),
  cart: items => ({
    reply_markup: {
      inline_keyboard: [
        ...items.map(i => [
          { text: `➖`, callback_data: `qty_-_${i.id}` },
          { text: `${i.qty} × ${i.name}`, callback_data: 'noop' },
          { text: '➕', callback_data: `qty_+_${i.id}` },
        ]),
        ...(items.length ? [
          [{ text: '✅ ثبت سفارش', callback_data: 'checkout' }],
          [{ text: '🗑️ خالی کردن سبد', callback_data: 'cart_clear' }],
        ] : []),
        [{ text: '↩️ منوی اصلی', callback_data: 'home' }],
      ],
    },
  }),
  backHome: { reply_markup: { inline_keyboard: [[{ text: '↩️ منوی اصلی', callback_data: 'home' }]] } },
  exitChat: { reply_markup: { keyboard: [[{ text: '↩️ خروج از مشاوره' }]], resize_keyboard: true } },
};

/* ============================================================
 *  ۵. هندلرهای اصلی
 * ============================================================ */

// --- شروع ---
bot.onText(/^\/start/, async msg => {
  const s = getSession(msg.from.id);
  resetState(s);
  await bot.sendMessage(
    msg.chat.id,
    `سلام ${msg.from.first_name ? 'خانوم ' + msg.from.first_name : 'عزیز'}! 👋✨\n\n` +
    `به *ژیوار* خوش اومدی — استایلیست شخصی آنلاین تو.\n\n` +
    `🛍️ خرید پوشاک، اکسسوری و لباس زیر\n` +
    `🤖 مشاور استایل با هوش مصنوعی\n` +
    `📏 پیشنهاد سایز دقیق\n` +
    `📦 پیگیری سفارش\n\n` +
    `یه گزینه رو انتخاب کن 👇`,
    { parse_mode: 'Markdown', ...K.main }
  );
});

bot.onText(/^\/help/, msg => {
  bot.sendMessage(msg.chat.id,
    '📋 *راهنمای ربات ژیوار*\n\n' +
    '/start — منوی اصلی\n' +
    '/products — دسته‌بندی محصولات\n' +
    '/orders — پیگیری سفارش‌ها\n' +
    '/size — مشاوره سایز\n' +
    '/stylist — چت با مشاور هوشمند\n' +
    '/cart — سبد خرید\n' +
    '/support — ارتباط با پشتیبانی',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/^\/products/, msg => showCategories(msg.chat.id));
bot.onText(/^\/cart/, msg => showCart(msg.chat.id, msg.from.id));
bot.onText(/^\/orders/, msg => showOrders(msg.chat.id, msg.from.id));

// --- دسته‌بندی‌ها ---
async function showCategories(chatId) {
  const cats = [
    { id: 'clothing', name: 'پوشاک', icon: '👗', count: 860 },
    { id: 'accessories', name: 'اکسسوری', icon: '👜', count: 540 },
    { id: 'lingerie', name: 'لباس زیر', icon: '🩱', count: 320 },
    { id: 'sets', name: 'ست‌های آماده', icon: '✨', count: 120 },
  ];
  await bot.sendMessage(chatId, '🗂 کدوم دسته رو ببینی؟', K.categories(cats));
}

// --- محصولات یک دسته ---
async function showProducts(chatId, userId, catId, page = 0) {
  const perPage = 6;
  try {
    const data = await api(`/products?category=${catId}&page=${page}&limit=${perPage}`);
    const list = data.items;
    const totalPages = Math.ceil(data.total / perPage) || 1;
    await bot.sendMessage(chatId, `🛍️ محصولات دسته «${catId}» — صفحه ${page + 1} از ${totalPages}`,
      K.products(list, catId, page, totalPages));
  } catch (e) {
    bot.sendMessage(chatId, '⚠️ دریافت محصولات ناموفق بود. لطفاً بعداً تلاش کن.');
  }
}

// --- کارت محصول ---
async function showProduct(chatId, userId, productId) {
  try {
    const p = await api(`/products/${productId}`);
    const s = getSession(userId);
    s.lastProduct = p;
    const caption =
      `*${p.name}*\n\n` +
      `💰 قیمت: ${toman(p.price)}${p.oldPrice ? `\n❌ قیمت قبل: ${toman(p.oldPrice)} (${p.discount}٪ تخفیف)` : ''}\n` +
      `📦 موجودی: ${p.stock > 0 ? p.stock + ' عدد' : 'ناموجود'}\n` +
      `⭐ امتیاز: ${p.rating}/۵ (${p.reviewCount} نظر)\n\n` +
      `${p.description?.slice(0, 300) ?? ''}`;
    if (p.image) {
      await bot.sendPhoto(chatId, p.image, { caption, parse_mode: 'Markdown', ...K.product(p) });
    } else {
      await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', ...K.product(p) });
    }
  } catch (e) {
    bot.sendMessage(chatId, '⚠️ محصول پیدا نشد.');
  }
}

// --- سبد خرید ---
async function showCart(chatId, userId) {
  const s = getSession(userId);
  if (!s.cart.length) {
    return bot.sendMessage(chatId, '🛒 سبد خریدت خالیه.\n\nاز «🛍️ خرید و دسته‌بندی‌ها» یه چیزی انتخاب کن!', K.main);
  }
  const total = s.cart.reduce((t, i) => t + i.price * i.qty, 0);
  let text = '🛒 *سبد خرید تو:*\n\n';
  s.cart.forEach(i => { text += `• ${i.name} — ${i.qty} × ${toman(i.price)}\n`; });
  text += `\n💳 *جمع کل: ${toman(total)}*`;
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...K.cart(s.cart) });
}

// --- سفارش‌ها ---
async function showOrders(chatId, userId) {
  try {
    const orders = await api(`/orders?telegramId=${userId}`);
    if (!orders.length) return bot.sendMessage(chatId, '📦 هنوز سفارشی ثبت نکرده‌ای.', K.backHome);
    let text = '📦 *سفارش‌های من:*\n\n';
    orders.forEach(o => {
      const emoji = { pending: '⏳', paid: '✅', shipping: '🚚', delivered: '🎁', canceled: '❌' }[o.status] || '📫';
      text += `${emoji} سفارش #${o.code} — ${toman(o.total)}\n   وضعیت: ${o.statusFa}\n\n`;
    });
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...K.backHome });
  } catch (e) {
    bot.sendMessage(chatId, '⚠️ دریافت سفارش‌ها ناموفق بود.', K.backHome);
  }
}

/* ============================================================
 *  ۶. مشاور استایل (AI)
 * ============================================================ */
async function startStylist(chatId, userId) {
  const s = getSession(userId);
  s.state = 'stylist';
  s.chatHistory = [{ role: 'system', content: STYLIST_SYSTEM }];
  await bot.sendMessage(chatId,
    '✨ *مشاور استایل ژیوار*\n\n' +
    'بهم بگو:\n• برای چه مناسبتی لباس می‌خوای؟ (مهمونی، کاری، روزمره...)\n' +
    '• بودجه‌ات چقدره؟\n• سلیقه‌ات چیه؟ (مینیمال، شیک، راحت...)\n\n' +
    'من ۲-۳ ست کامل برات پیشنهاد می‌دم. برای خروج «↩️ خروج از مشاوره» رو بزن.',
    { parse_mode: 'Markdown', ...K.exitChat }
  );
}

/* ============================================================
 *  ۷. مشاوره سایز
 * ============================================================ */
async function startSizeAdvisor(chatId, userId) {
  const s = getSession(userId);
  s.state = 'size';
  await bot.sendMessage(chatId,
    '📏 *مشاوره سایز*\n\n' +
    'قد و وزن یا اندازه‌هات رو بفرست، مثل:\n' +
    '«قد ۱۶۸، وزن ۵۸، سایز معمول M»\n\n' +
    'من سایز دقیق رو پیشنهاد می‌دم.',
    { parse_mode: 'Markdown', ...K.exitChat }
  );
}

/* ============================================================
 *  ۸. روتر پیام‌های متنی (بر اساس state)
 * ============================================================ */
bot.on('message', async msg => {
  if (msg.text?.startsWith('/')) return;          // دستورات جداگانه مدیریت می‌شوند
  if (!msg.text) return;                          // عکس/استیکر و ... فعلاً نادیده
  const s = getSession(msg.from.id);
  const chatId = msg.chat.id;

  // خروج از حالت‌های مکالمه‌ای
  if (msg.text === '↩️ خروج از مشاوره' || msg.text === '↩️ خروج از پشتیبانی') {
    resetState(s);
    return bot.sendMessage(chatId, 'بازگشت به منوی اصلی 👇', K.main);
  }

  switch (s.state) {
    /* ---- چت با مشاور AI ---- */
    case 'stylist': {
      await bot.sendChatAction(chatId, 'typing');
      try {
        s.chatHistory.push({ role: 'user', content: msg.text });
        const reply = await askAI(s.chatHistory);
        s.chatHistory.push({ role: 'assistant', content: reply });
        // تاریخچه رو کوتاه نگه دار
        if (s.chatHistory.length > 12) s.chatHistory = s.chatHistory.slice(-11);
        await bot.sendMessage(chatId, reply, K.exitChat);
      } catch (e) {
        await bot.sendMessage(chatId, '⚠️ سرویس هوش مصنوعی در دسترس نیست. چند لحظه بعد تلاش کن.', K.exitChat);
      }
      break;
    }

    /* ---- مشاوره سایز ---- */
    case 'size': {
      const answer = await suggestSize(msg.text);
      await bot.sendMessage(chatId, answer, K.exitChat);
      break;
    }

    /* ---- پشتیبانی ---- */
    case 'support': {
      // فوروارد به ادمین‌ها
      for (const adminId of ADMINS) {
        try {
          await bot.forwardMessage(adminId, chatId, msg.message_id);
          await bot.sendMessage(adminId, `💬 پیام پشتیبانی از @${msg.from.username || msg.from.id}\nشناسه: ${msg.from.id}\n\nپاسخ: /reply_${msg.from.id}`);
        } catch (_) {}
      }
      await bot.sendMessage(chatId, '✅ پیامت به پشتیبانی ژیوار رسید. کاریتیم، حداکثر تا ۱۵ دقیقه جواب می‌دیم ⏱️', K.exitChat);
      break;
    }

    /* ---- تکمیل سفارش ---- */
    case 'checkout': {
      await handleCheckoutStep(chatId, msg.from.id, msg.text);
      break;
    }

    default:
      // جستجوی متنی آزاد
      if (msg.text.length >= 2) {
        try {
          const res = await api(`/products/search?q=${encodeURIComponent(msg.text)}`);
          if (res.items?.length) {
            await bot.sendMessage(chatId, `🔍 نتیجه جستجو برای «${msg.text}»:`,
              K.products(res.items.slice(0, 6), 'search', 0, 1));
          } else {
            await bot.sendMessage(chatId, 'چیزی پیدا نکردم 🤔\nعبارت دیگه‌ای امتحان کن یا از منوی اصلی استفاده کن.', K.main);
          }
        } catch (e) {
          await bot.sendMessage(chatId, 'یه گزینه از منوی اصلی رو انتخاب کن 👇', K.main);
        }
      }
  }
});

/* ============================================================
 *  ۹. منطق سایز و تسویه حساب
 * ============================================================ */
async function suggestSize(text) {
  const cm = text.match(/(\d{3})/);                       // قد
  const kg = text.match(/(\d{2})\s*(?:kg|کیلو|کیلوگرم)/i) || text.match(/(\d{2})\s/); // وزن
  const hasM = /\bM\b|مدیوم|میانه/.test(text);
  const hasL = /\bL\b|لارج|بزرگ/.test(text);
  const hasS = /\bS\b|اسمال|کوچک/.test(text);

  if (hasM || hasL || hasS) {
    return `📏 بر اساس سایز معمول «${hasM ? 'M' : hasL ? 'L' : 'S'}» که گفتی، *سایز ${hasM ? 'M' : hasL ? 'L' : 'S'}* رو پیشنهاد می‌کنم.\n\n💡 نکته: برای پارچه‌های کشدار یک سایز کوچک‌تر، و برای کرپ و بافت یک سایز بزرگ‌تر بگیر.`;
  }
  if (cm && kg) {
    const h = +cm[1], w = +kg[1];
    const bmi = w / ((h / 100) ** 2);
    const size = bmi < 19 ? 'S' : bmi < 24 ? 'M' : bmi < 28 ? 'L' : 'XL';
    return `📏 با قد ${h} و وزن ${w}:\n\n✅ سایز پیشنهادی من: *${size}*\n\n💡 اگه بین دو سایزی هستی، برای پیراهن‌های دست‌دوز بزرگ‌تر رو بگیر.`;
  }
  return '📏 لطفاً قد و وزنت رو بفرست مثل: «قد ۱۶۸ وزن ۵۸» یا سایز معمولت رو بگو مثل «M».';
}

async function handleCheckoutStep(chatId, userId, text) {
  const s = getSession(userId);
  const d = s.orderDraft;

  if (!d.name) { d.name = text; return bot.sendMessage(chatId, '📞 شماره موبایلت رو بفرست:'); }
  if (!d.phone) { d.phone = text; return bot.sendMessage(chatId, '🏙️ استان و شهرت رو بفرست:'); }
  if (!d.city) { d.city = text; return bot.sendMessage(chatId, '📍 نشانی کامل (خیابان، پلاک، کد پستی):'); }
  if (!d.address) {
    d.address = text;
    const total = s.cart.reduce((t, i) => t + i.price * i.qty, 0);
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: {
          telegramId: userId,
          customer: { name: d.name, phone: d.phone, city: d.city, address: d.address },
          items: s.cart.map(i => ({ productId: i.id, qty: i.qty })),
          source: 'telegram',
        },
      });
      s.cart = [];
      resetState(s);
      await bot.sendMessage(chatId,
        `🎉 *سفارش ثبت شد!*\n\n🔢 کد پیگیری: #${order.code}\n💰 مبلغ: ${toman(order.total)}\n\n` +
        `لینک پرداخت برات ارسال می‌شه... 💳\nوضعیت رو anytime با /orders ببین.`,
        { parse_mode: 'Markdown', ...K.main }
      );
      if (order.paymentUrl) await bot.sendMessage(chatId, `💳 [پرداخت آنلاین](${order.paymentUrl})`, { parse_mode: 'Markdown' });
    } catch (e) {
      await bot.sendMessage(chatId, '⚠️ ثبت سفارش ناموفق بود. لطفاً با پشتیبانی تماس بگیر.', K.main);
      resetState(s);
    }
  }
}

/* ============================================================
 *  ۱۰. روتر دکمه‌های شیشه‌ای (Callback)
 * ============================================================ */
bot.on('callback_query', async q => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;
  const s = getSession(userId);
  const data = q.data;
  await bot.answerCallbackQuery(q.id).catch(() => {});

  if (data === 'noop') return;

  if (data === 'home') { resetState(s); return bot.sendMessage(chatId, 'منوی اصلی 👇', K.main); }
  if (data === 'cats') return showCategories(chatId);
  if (data === 'cart') return showCart(chatId, userId);
  if (data === 'orders') return showOrders(chatId, userId);
  if (data === 'stylist') return startStylist(chatId, userId);
  if (data === 'size') return startSizeAdvisor(chatId, userId);

  if (data === 'support') {
    s.state = 'support';
    return bot.sendMessage(chatId, '💬 پیامت رو بنویس؛ دستیار انسانی ژیوار جواب می‌ده.', K.exitChat);
  }

  if (data.startsWith('cat_')) return showProducts(chatId, userId, data.slice(4), 0);
  if (data.startsWith('page_')) {
    const [, catId, page] = data.split('_');
    return showProducts(chatId, userId, catId, +page);
  }
  if (data.startsWith('p_')) return showProduct(chatId, userId, data.slice(2));

  if (data.startsWith('add_')) {
    const p = await api(`/products/${data.slice(4)}`);
    const exist = s.cart.find(i => i.id === p.id);
    exist ? exist.qty++ : s.cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
    await bot.answerCallbackQuery(q.id, { text: '✅ به سبد اضافه شد' });
    return showCart(chatId, userId);
  }

  if (data.startsWith('qty_')) {
    const [, sign, id] = data.split('_');
    const item = s.cart.find(i => String(i.id) === id);
    if (item) {
      item.qty += sign === '+' ? 1 : -1;
      if (item.qty <= 0) s.cart = s.cart.filter(i => String(i.id) !== id);
    }
    return showCart(chatId, userId);
  }

  if (data === 'cart_clear') { s.cart = []; return showCart(chatId, userId); }

  if (data === 'checkout') {
    if (!s.cart.length) return bot.sendMessage(chatId, 'سبدت خالیه 🙃', K.main);
    s.state = 'checkout'; s.orderDraft = {};
    return bot.sendMessage(chatId, '✅ بگذار سفارشت رو ثبت کنیم.\n\n👤 نام و نام خانوادگی؟');
  }

  if (data.startsWith('size_')) {
    s.state = 'size';
    return bot.sendMessage(chatId, '📏 قد و وزن یا سایز معمولت رو بفرست تا سایز دقیق رو پیشنهاد بدم.', K.exitChat);
  }

  if (data.startsWith('outfit_')) {
    await bot.answerCallbackQuery(q.id, { text: '✨ در حال آماده‌سازی ست...' });
    try {
      const outfit = await api(`/products/${data.slice(7)}/outfit`);   // AI Outfit Builder در بک‌اند
      let text = '✨ *ست کامل پیشنهادی مشاور هوشمند:*\n\n';
      outfit.items.forEach((o, i) => { text += `${i + 1}. ${o.name} — ${toman(o.price)}\n`; });
      text += `\n💳 جمع ست: ${toman(outfit.total)}`;
      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛒 افزودن کل ست به سبد', callback_data: `add_outfit_${data.slice(7)}` }],
            [{ text: '↩️ بازگشت', callback_data: 'cats' }],
          ],
        },
      });
    } catch (e) {
      await bot.sendMessage(chatId, '⚠️ آماده‌سازی ست ناموفق بود.');
    }
  }

  if (data.startsWith('add_outfit_')) {
    const outfit = await api(`/products/${data.slice(11)}/outfit`);
    outfit.items.forEach(o => {
      const exist = s.cart.find(i => i.id === o.id);
      exist ? exist.qty++ : s.cart.push({ id: o.id, name: o.name, price: o.price, qty: 1 });
    });
    await bot.answerCallbackQuery(q.id, { text: '✨ کل ست به سبد اضافه شد' });
    return showCart(chatId, userId);
  }
});

/* ============================================================
 *  ۱۱. دستورات ادمین
 * ============================================================ */

// ارسال پیام به کانال: /broadcast متن پیام
bot.onText(/^\/broadcast (.+)/s, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  try {
    await bot.sendMessage(CHANNEL_ID, match[1]);
    await bot.sendMessage(msg.chat.id, '✅ پیام در کانال منتشر شد.');
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `❌ خطا در انتشار: ${e.message}`);
  }
});

// اطلاع‌رسانی موجود شدن محصول به کانال: /notify <productId>
bot.onText(/^\/notify (\w+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  try {
    const p = await api(`/products/${match[1]}`);
    const caption =
      `🔥 *${p.name}*\n\n💰 ${toman(p.price)}\n\n` +
      `برای خرید سریع از ربات استفاده کن 👇\n@ZhevarBot`;
    await bot.sendPhoto(CHANNEL_ID, p.image, { caption, parse_mode: 'Markdown' });
    await bot.sendMessage(msg.chat.id, '✅ محصول در کانال منتشر شد.');
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `❌ خطا: ${e.message}`);
  }
});

// پاسخ به کاربر: /reply_<userId> متن
bot.onText(/^\/reply_(\d+) (.+)/s, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  try {
    await bot.sendMessage(match[1], `💬 پاسخ پشتیبانی ژیوار:\n\n${match[2]}`);
    await bot.sendMessage(msg.chat.id, '✅ پاسخ ارسال شد.');
  } catch (e) {
    await bot.sendMessage(msg.chat.id, '❌ ارسال ناموفق بود.');
  }
});

// آمار سریع: /stats
bot.onText(/^\/stats/, async msg => {
  if (!isAdmin(msg.from.id)) return;
  try {
    const st = await api('/admin/stats');
    await bot.sendMessage(msg.chat.id,
      `📊 *آمار امروز*\n\n💰 فروش: ${toman(st.revenue)}\n📦 سفارش‌ها: ${st.orders}\n👥 کاربران فعال: ${st.activeUsers}`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    await bot.sendMessage(msg.chat.id, '⚠️ دریافت آمار ناموفق بود.');
  }
});

/* ============================================================
 *  ۱۲. خطاها و راه‌اندازی
 * ============================================================ */
bot.on('polling_error', e => console.error(' polling_error:', e.message));
bot.on('error', e => console.error(' bot error:', e.message));

// پاکسازی نشست‌های قدیمی (هر ۶ ساعت)
setInterval(() => {
  sessions.forEach((v, k) => { if (v.state === 'idle' && Date.now() - (v.touchedAt || 0) > 24 * 3600e3) sessions.delete(k); });
}, 6 * 3600e3);

console.log('🤖 ربات ژیوار راه‌اندازی شد...');
if (BOT_MODE === 'polling') {
  console.log('📡 حالت polling فعال — منتظر پیام‌ها...');
} else {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });
  app.get('/', (_, res) => res.send('Zhevar Bot is running ✅'));
  app.listen(PORT, async () => {
    await bot.setWebhook(`${WEBHOOK_DOMAIN}/bot${TELEGRAM_BOT_TOKEN}`);
    console.log(`🔗 Webhook فعال روی ${WEBHOOK_DOMAIN}`);
  });
}
