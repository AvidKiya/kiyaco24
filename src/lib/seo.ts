import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Product } from "@/lib/catalog";

/* ============================================================
 *  فاز ۱۵ — سئو: متادیتا، canonical و Schema.org (JSON-LD)
 * ============================================================ */

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const absolute = (path: string) => (path.startsWith("http") ? path : `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`);

export type SiteSeo = { metaTitle: string; metaDescription: string; ogImage: string; googleVerification: string; storeName: string };

export async function getSiteSeo(): Promise<SiteSeo> {
  const [row] = await db.select({ seo: settings.seo, storeName: settings.storeName }).from(settings).where(eq(settings.id, 1));
  const seo = row?.seo || {};
  return {
    metaTitle: seo.metaTitle || "کیا اکسسوری | جزئیات، امضای تو",
    metaDescription: seo.metaDescription || "دنیای کمربند، بدلیجات و اکسسوری کیا. انتخاب‌های کوچک برای ساختن یک استایل کاملاً شخصی؛ کمربند، گردنبند، دستبند، انگشتر و ست هدیه.",
    ogImage: seo.ogImage || "/images/hero-belt.webp",
    googleVerification: seo.googleVerification || "",
    storeName: row?.storeName || "کیا اکسسوری",
  };
}

/** اسکیمای Organization + WebSite با SearchAction (صفحهٔ اصلی) */
export function organizationJsonLd(site: SiteSeo, extra: { instagramUrl?: string; telegramUrl?: string; supportPhone?: string } = {}) {
  const sameAs = [extra.instagramUrl, extra.telegramUrl].filter(Boolean);
  return [
    { "@context": "https://schema.org", "@type": "Organization", name: site.storeName, url: siteUrl(), logo: absolute("/images/icon-192.png"), ...(sameAs.length ? { sameAs } : {}), ...(extra.supportPhone ? { contactPoint: { "@type": "ContactPoint", telephone: extra.supportPhone, contactType: "customer service", availableLanguage: "fa" } } : {}) },
    { "@context": "https://schema.org", "@type": "WebSite", name: site.storeName, url: siteUrl(), inLanguage: "fa-IR", potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/shop?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
  ];
}

/** اسکیمای Product + Breadcrumb + FAQ (صفحهٔ محصول) */
export function productJsonLd(product: Product, categoryName: string, reviews: { name: string; rating: number; text: string; createdAt: string | Date }[] = [], questions: { question: string; answer: string }[] = []) {
  const graphs: Record<string, unknown>[] = [];
  const productSchema: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "Product",
    name: product.name, description: (product.seo?.description || product.description).slice(0, 300),
    image: [absolute(product.image), ...(product.gallery || []).map(g => absolute(g))], sku: product.slug, url: absolute(`/product/${product.slug}`),
    material: product.material, brand: { "@type": "Brand", name: "KIYA" },
    offers: {
      "@type": "Offer", url: absolute(`/product/${product.slug}`),
      /* قیمت‌ها در سایت به تومان است؛ در اسکیما به ریال (واحد رسمی IRR) */
      price: product.price * 10, priceCurrency: "IRR",
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  if (reviews.length) {
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    productSchema.aggregateRating = { "@type": "AggregateRating", ratingValue: Math.round((total / reviews.length) * 10) / 10, reviewCount: reviews.length, bestRating: 5, worstRating: 1 };
    productSchema.review = reviews.slice(0, 5).map(r => ({ "@type": "Review", author: { "@type": "Person", name: r.name }, reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 }, reviewBody: r.text.slice(0, 300), datePublished: new Date(r.createdAt).toISOString().slice(0, 10) }));
  }
  graphs.push(productSchema);
  graphs.push({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "خانه", item: siteUrl() },
      { "@type": "ListItem", position: 2, name: "فروشگاه", item: `${siteUrl()}/shop` },
      { "@type": "ListItem", position: 3, name: categoryName, item: `${siteUrl()}/shop?category=${product.category}` },
      { "@type": "ListItem", position: 4, name: product.name, item: absolute(`/product/${product.slug}`) },
    ],
  });
  const answered = questions.filter(q => q.answer);
  if (answered.length) graphs.push({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: answered.slice(0, 8).map(q => ({ "@type": "Question", name: q.question.slice(0, 200), acceptedAnswer: { "@type": "Answer", text: q.answer.slice(0, 500) } })),
  });
  return graphs;
}

/** اسکیمای Article (Fashion Daily و راهنماها) */
export function articleJsonLd(input: { title: string; excerpt: string; image: string; slug: string; publishAt: string | Date; section?: string; base?: string }) {
  return {
    "@context": "https://schema.org", "@type": "Article",
    headline: input.title.slice(0, 110), description: input.excerpt.slice(0, 300),
    image: [absolute(input.image)], inLanguage: "fa-IR",
    datePublished: new Date(input.publishAt).toISOString(),
    author: { "@type": "Organization", name: "KIYA" }, publisher: { "@type": "Organization", name: "KIYA", logo: { "@type": "ImageObject", url: absolute("/images/icon-192.png") } },
    mainEntityOfPage: absolute(`${input.base || "/daily"}/${input.slug}`),
    ...(input.section ? { articleSection: input.section } : {}),
  };
}

/** رندر امن JSON-LD داخل تگ script */
export const jsonLdScript = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
