import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuideBySlug, getPublishedGuides, productsByIds } from "@/lib/guides";
import { getStore } from "@/lib/server-store";
import { GuideView } from "@/components/guide-collections";
import { guideSteps, parseGuideBody, howToSchema, topicMeta } from "@/lib/guide-types";
import { TrackEvent } from "@/components/track-event";
import { absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return { title: "راهنما پیدا نشد | کیا اکسسوری" };
  return {
    title: `${guide.title} | راهنمای استایل کیا`,
    description: guide.excerpt,
    alternates: { canonical: absolute(`/guide/${guide.slug}`) },
    keywords: [topicMeta(guide.topic).title, "راهنمای استایل", "کیا اکسسوری"],
    openGraph: { title: guide.title, description: guide.excerpt, images: [guide.image], type: "article" },
  };
}

export default async function GuideArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [guide, allGuides] = await Promise.all([getGuideBySlug(slug), getPublishedGuides()]);
  if (!guide) notFound();

  const steps = guideSteps(parseGuideBody(guide.body));
  const related = allGuides.filter(item => item.id !== guide.id && item.topic === guide.topic).slice(0, 4);
  const fallback = related.length ? related : allGuides.filter(item => item.id !== guide.id).slice(0, 4);
  const [store, byIds] = await Promise.all([getStore(), productsByIds(guide.productIds)]);
  const shopProducts = store.products.filter(product => guide.productIds.includes(product.id));
  const products = shopProducts.length ? shopProducts : byIds;

  return (
    <>
      <TrackEvent type="view_guide" refValue={guide.slug} />
      <GuideView guide={guide} products={products} related={fallback} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema(guide, steps)) }} />
    </>
  );
}
