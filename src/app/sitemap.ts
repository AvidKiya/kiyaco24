import type { MetadataRoute } from "next";
import { getActiveTrends, getPublishedGuides, getActiveCollections, productsByIds } from "@/lib/guides";
import { getDailyEdition } from "@/lib/daily";
import { getStore } from "@/lib/server-store";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const [store, trends, guides, collections, edition] = await Promise.all([
    getStore(), getActiveTrends(), getPublishedGuides(), getActiveCollections(), getDailyEdition(),
  ]);

  const productIds = [...new Set([...trends.flatMap(t => t.productIds), ...guides.flatMap(g => g.productIds), ...collections.flatMap(c => c.productIds)])];
  const products = await productsByIds(productIds);

  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/daily`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/trending`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/guide`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/collections`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/account`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/partner`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  for (const product of store.products.filter(p => p.active)) {
    entries.push({ url: `${base}/product/${product.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.8 });
  }
  for (const guide of guides) {
    entries.push({ url: `${base}/guide/${guide.slug}`, lastModified: guide.publishAt, changeFrequency: "monthly", priority: 0.6 });
  }
  for (const collection of collections) {
    entries.push({ url: `${base}/collections/${collection.slug}`, lastModified: collection.createdAt, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const article of edition.articles) {
    entries.push({ url: `${base}/daily/${article.slug}`, lastModified: article.publishAt, changeFrequency: "monthly", priority: 0.5 });
  }
  for (const product of products) {
    if (!entries.some(entry => entry.url.endsWith(`/product/${product.slug}`))) {
      entries.push({ url: `${base}/product/${product.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
    }
  }
  return entries;
}
