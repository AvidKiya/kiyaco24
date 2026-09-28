/* ============================================================
 *  فاز ۸ — Trending + Style Guide + Collections
 *  انواع و توابع مشترک (ایمن برای کلاینت و سرور)
 * ============================================================ */

export { slugify } from "./daily-types";

export type GuideTopic = "sizing" | "knotting" | "pairing" | "metal" | "layering" | "care";

export const guideTopics: { id: GuideTopic; title: string; en: string; hint: string }[] = [
  { id: "sizing", title: "اندازه و سایز", en: "SIZING", hint: "چطور سایز درست را پیدا کنی" },
  { id: "knotting", title: "بستن و استفاده", en: "KNOTTING", hint: "روش‌های درست بستن کمربند" },
  { id: "pairing", title: "هماهنگی با لباس", en: "PAIRING", hint: "ست کردن اکسسوری با کفش و لباس" },
  { id: "metal", title: "طلایی یا نقره‌ای", en: "METAL", hint: "انتخاب فلز مناسب پوست و استایل" },
  { id: "layering", title: "لایه‌لایه کردن", en: "LAYERING", hint: "ترکیب چند اکسسوری بدون شلوغی" },
  { id: "care", title: "نگهداری", en: "CARE", hint: "طول عمر بیشتر برای جزئیات" },
];

export const topicMeta = (id: string) =>
  guideTopics.find(topic => topic.id === id) ?? { title: id, en: id.toUpperCase(), hint: "" };

export type Guide = {
  id: number; slug: string; topic: GuideTopic; title: string; kicker: string; excerpt: string;
  body: string; image: string; author: string; readMinutes: number; publishAt: Date;
  productIds: number[]; position: number; active: boolean; createdAt: Date;
};

export type Collection = {
  id: number; slug: string; name: string; label: string; subtitle: string; description: string;
  image: string; colorHex: string; badge: string; productIds: number[]; featured: boolean;
  position: number; active: boolean; createdAt: Date;
};

/* ============================================================
 *  پارسر سبک متن راهنما — مثل مقالات روزنامه
 *    ## مرحله     → مرحلهٔ HowTo (برای دادهٔ ساخت‌یافته گوگل)
 *    > نکته       → نکتهٔ برجسته
 *    [[product:1|برچسب]] → کارت محصول
 * ============================================================ */

export type GuideBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "subhead"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "product"; productId: number; label: string }
  | { kind: "list"; items: string[] };

const productPattern = /^\[\[product:(\d+)(?:\|([^\]]*))?\]\]$/;

export function parseGuideBody(body: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => { if (paragraph.length) { blocks.push({ kind: "paragraph", text: paragraph.join(" ") }); paragraph = []; } };
  const flushList = () => { if (list.length) { blocks.push({ kind: "list", items: list }); list = []; } };
  const flush = () => { flushParagraph(); flushList(); };

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) { flush(); continue; }

    const product = line.match(productPattern);
    if (product) { flush(); blocks.push({ kind: "product", productId: Number(product[1]), label: product[2]?.trim() ?? "" }); continue; }
    if (line.startsWith("## ")) { flush(); blocks.push({ kind: "subhead", text: line.slice(3).trim() }); continue; }
    if (line.startsWith("> ")) { flush(); blocks.push({ kind: "quote", text: line.slice(2).trim() }); continue; }
    if (line.startsWith("- ")) { flushParagraph(); list.push(line.slice(2).trim()); continue; }

    flushList();
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** مراحل راهنما — برای دادهٔ ساخت‌یافته HowTo */
export function guideSteps(blocks: GuideBlock[]): { name: string; text: string }[] {
  const steps: { name: string; text: string }[] = [];
  let current: { name: string; text: string } | null = null;
  for (const block of blocks) {
    if (block.kind === "subhead") { current = { name: block.text, text: "" }; steps.push(current); continue; }
    if (!current) { current = { name: "آماده‌سازی", text: "" }; steps.push(current); }
    if (block.kind === "paragraph") current.text += (current.text ? " " : "") + block.text;
    else if (block.kind === "quote") current.text += (current.text ? " " : "") + block.text;
    else if (block.kind === "list") current.text += (current.text ? " " : "") + block.items.join(" — ");
  }
  return steps;
}

/** دادهٔ ساخت‌یافته HowTo — برای سئوی راهنما */
export function howToSchema(guide: { title: string; excerpt: string; slug: string; image: string }, steps: { name: string; text: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: guide.title,
    description: guide.excerpt,
    image: guide.image,
    totalTime: "PT3M",
    step: steps.filter(step => step.text).map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      url: `/guide/${guide.slug}#step-${index + 1}`,
    })),
  };
}

/** دادهٔ ساخت‌یافته CollectionPage — برای سئوی کالکشن‌ها */
export function collectionSchema(collection: { name: string; description: string; slug: string }, products: { name: string; slug: string; price: number; image: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: collection.name,
    description: collection.description,
    url: `/collections/${collection.slug}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.name,
        url: `/product/${product.slug}`,
        image: product.image,
        offers: { "@type": "Offer", price: product.price, priceCurrency: "IRR" },
      })),
    },
  };
}
