import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollectionBySlug, getActiveCollections, productsByIds } from "@/lib/guides";
import { getStore } from "@/lib/server-store";
import { CollectionLanding } from "@/components/guide-collections";
import { collectionSchema } from "@/lib/guide-types";
import { TrackEvent } from "@/components/track-event";
import { absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "کالکشن پیدا نشد | کیا اکسسوری" };
  return {
    title: `${collection.name} | کالکشن کیا`,
    description: collection.description || collection.subtitle,
    alternates: { canonical: absolute(`/collections/${collection.slug}`) },
    openGraph: { title: collection.name, description: collection.subtitle, images: [collection.image] },
  };
}

export default async function CollectionLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [collection, allCollections] = await Promise.all([getCollectionBySlug(slug), getActiveCollections()]);
  if (!collection) notFound();

  const [store, byIds] = await Promise.all([getStore(), productsByIds(collection.productIds)]);
  const shopProducts = store.products.filter(product => collection.productIds.includes(product.id));
  const products = shopProducts.length ? shopProducts : byIds;
  const related = allCollections.filter(item => item.id !== collection.id).slice(0, 3);
  const schema = collectionSchema(collection, products);

  return (
    <>
      <TrackEvent type="view_collection" refValue={collection.slug} />
      <CollectionLanding collection={collection} products={products} related={related} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </>
  );
}
