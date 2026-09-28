/* ============================================================
 *  Fashion Daily — انواع و پارسر بدنهٔ مقاله
 *  بدون وابستگی به دیتابیس (ایمن برای کلاینت و سرور)
 * ============================================================ */

export type ArticleSection =
  | "main-story" | "trending-now" | "fashion-news" | "accessory-trend"
  | "color-of-day" | "style-inspiration" | "product-spotlight" | "editors-pick";

export type Article = {
  id: number; slug: string; section: ArticleSection; title: string; kicker: string;
  excerpt: string; body: string; image: string; colorHex: string; author: string;
  readMinutes: number; editionDate: Date; publishAt: Date; productIds: number[];
  shopLabel: string; position: number; active: boolean; createdAt: Date;
};

/** سکشن‌های روزنامه — ترتیب نمایش در صفحهٔ امروز */
export const dailySections: { id: ArticleSection; title: string; en: string; hint: string }[] = [
  { id: "main-story", title: "مطلب اصلی", en: "MAIN STORY", hint: "گزارش ویژهٔ امروز" },
  { id: "trending-now", title: "ترندهای امروز", en: "TRENDING NOW", hint: "داغ‌ترین مسیرهای فصل" },
  { id: "fashion-news", title: "اخبار مد", en: "FASHION NEWS", hint: "خبرهای کوتاه دنیای مد" },
  { id: "accessory-trend", title: "ترند اکسسوری", en: "ACCESSORY TREND", hint: "راهنمای انتخاب جزئیات" },
  { id: "color-of-day", title: "رنگ روز", en: "COLOR OF THE DAY", hint: "پالت انتخاب سردبیر" },
  { id: "style-inspiration", title: "الهام استایل", en: "STYLE INSPIRATION", hint: "ست‌های آماده برای الگوبرداری" },
  { id: "product-spotlight", title: "نور روی محصول", en: "PRODUCT SPOTLIGHT", hint: "نگاهی نزدیک به یک جزئیات" },
  { id: "editors-pick", title: "انتخاب سردبیر", en: "EDITOR'S PICK", hint: "پیشنهاد نهایی امروز" },
];

/** نگاشت حروف فارسی و ارقام برای ساخت نشانی لاتین */
const slugLetters: Record<string, string> = {
  "\u0622": "a", "\u0627": "a", "\u0628": "b", "\u067e": "p", "\u062a": "t", "\u062b": "s", "\u062c": "j",
  "\u0686": "ch", "\u062d": "h", "\u062e": "kh", "\u062f": "d", "\u0630": "z", "\u0631": "r", "\u0632": "z",
  "\u0698": "zh", "\u0633": "s", "\u0634": "sh", "\u0635": "s", "\u0636": "z", "\u0637": "t", "\u0638": "z",
  "\u0639": "ae", "\u063a": "gh", "\u0641": "f", "\u0642": "gh", "\u06a9": "k", "\u06af": "g", "\u0644": "l",
  "\u0645": "m", "\u0646": "n", "\u0648": "o", "\u0647": "h", "\u06cc": "i", "\u064a": "i", "\u0629": "e",
  "\u0660": "0", "\u0661": "1", "\u0662": "2", "\u0663": "3", "\u0664": "4", "\u0665": "5", "\u0666": "6",
  "\u0667": "7", "\u0668": "8", "\u0669": "9", "\u06f0": "0", "\u06f1": "1", "\u06f2": "2", "\u06f3": "3",
  "\u06f4": "4", "\u06f5": "5", "\u06f6": "6", "\u06f7": "7", "\u06f8": "8", "\u06f9": "9",
};

/** نشانی لاتین و امن برای URL — از عنوان فارسی هم قابل ساخت است */
export function slugify(value: string) {
  let out = String(value || "").trim().toLowerCase();
  out = out.replace(/[\u064b-\u0652\u0670\u0640\u200c\u200d\ufeff]/g, "");
  out = out.replace(/[\u0600-\u06ff]/g, ch => slugLetters[ch] ?? "");
  out = out.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return out;
}

export const sectionMeta = (id: string) =>
  dailySections.find(section => section.id === id) ?? { title: id, en: id.toUpperCase(), hint: "" };

/* ============================================================
 *  پارسر سبک بدنهٔ مقاله
 *    ## تیتر      → زیرتیتر
 *    > جمله       → نقل‌قول برجسته
 *    [[product:5|برچسب]] → کارت محصول (Content → Commerce)
 *    خط خالی      → جداکنندهٔ پاراگراف
 *    متن          → پاراگراف
 * ============================================================ */

export type BodyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "subhead"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "product"; productId: number; label: string };

const productPattern = /^\[\[product:(\d+)(?:\|([^\]]*))?\]\]$/;

export function parseArticleBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) { flush(); continue; }

    const product = line.match(productPattern);
    if (product) {
      flush();
      blocks.push({ kind: "product", productId: Number(product[1]), label: product[2]?.trim() ?? "" });
      continue;
    }
    if (line.startsWith("## ")) { flush(); blocks.push({ kind: "subhead", text: line.slice(3).trim() }); continue; }
    if (line.startsWith("> ")) { flush(); blocks.push({ kind: "quote", text: line.slice(2).trim() }); continue; }

    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** تاریخ نسخه به شکل خوانا — مثلاً «شنبه ۵ مهر ۱۴۰۵» */
export function editionLabel(date: Date) {
  return new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** شمارهٔ نسخه — بر اساس فاصلهٔ روزها از تاریخ راه‌اندازی روزنامه */
export function editionNumber(date: Date) {
  const start = new Date("2025-01-01T00:00:00+03:30");
  const days = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, days + 1);
}
