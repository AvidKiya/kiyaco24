import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Storefront from "@/components/storefront";
import { getStore } from "@/lib/server-store";
import { getStorefrontExtras } from "@/lib/storefront-data";
import { productJsonLd, jsonLdScript, absolute } from "@/lib/seo";
import { categories } from "@/lib/catalog";
import { TrackEvent } from "@/components/track-event";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore(); const product = store.products.find(p => p.slug === slug);
  if (!product) return { title: "محصول پیدا نشد | کیا", robots: { index: false } };
  /* فاز ۱۵ — بازنویسی سئو از پنل + canonical + OG کامل */
  const title = product.seo?.title || `خرید ${product.name} | کیا اکسسوری`;
  const description = (product.seo?.description || product.description).slice(0, 160);
  return {
    title, description,
    alternates: { canonical: absolute(`/product/${product.slug}`) },
    openGraph: { title, description, images: [absolute(product.image)], type: "website", locale: "fa_IR", url: absolute(`/product/${product.slug}`) },
    twitter: { card: "summary_large_image", title, description, images: [absolute(product.image)] },
  };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, store, extras] = await Promise.all([params, getStore(), getStorefrontExtras()]);
  const product = store.products.find(p => p.slug === slug);
  if (!product) notFound();
  const categoryName = categories.find(c => c.id === product.category)?.name || "اکسسوری";
  const graphs = productJsonLd(product, categoryName, extras.reviewsByProduct?.[product.id] || [], extras.questionsByProduct?.[product.id] || []);
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(graphs) }} />
    <TrackEvent type="view_product" refValue={product.slug} />
    <Storefront {...store} extras={extras} mode="product" product={product} />
  </>;
}
