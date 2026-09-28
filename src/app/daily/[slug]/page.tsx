import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/server-store";
import { getArticleBySlug, getDailyEdition } from "@/lib/daily";
import { ArticleView } from "@/components/fashion-daily";
import { articleJsonLd, jsonLdScript, absolute } from "@/lib/seo";
import { TrackEvent } from "@/components/track-event";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await getArticleBySlug(slug);
  if (!found) return { title: "مطلب پیدا نشد | Fashion Daily" };
  return {
    title: `${found.article.title} | Fashion Daily`,
    description: found.article.excerpt,
    alternates: { canonical: absolute(`/daily/${found.article.slug}`) },
    openGraph: { title: found.article.title, description: found.article.excerpt, images: [absolute(found.article.image)], type: "article", locale: "fa_IR" },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, found] = await Promise.all([getStore(), getArticleBySlug(slug)]);
  if (!found) notFound();

  const { article } = found;
  const edition = await getDailyEdition();
  const sameSection = edition.articles.filter(item => item.id !== article.id && item.section === article.section).slice(0, 4);
  const related = sameSection.length ? sameSection : edition.articles.filter(item => item.id !== article.id).slice(0, 4);

  // محصولات مطلب از فهرست کامل فروشگاه خوانده می‌شود تا قیمت و موجودی همیشه تازه باشد
  const shopProducts = store.products.filter(product => article.productIds.includes(product.id));

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd({ title: article.title, excerpt: article.excerpt, image: article.image, slug: article.slug, publishAt: article.publishAt, section: article.section })) }} />
    <TrackEvent type="view_article" refValue={article.slug} />
    <ArticleView article={article} products={shopProducts} related={related} />
  </>;
}
