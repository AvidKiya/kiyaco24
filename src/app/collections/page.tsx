import type { Metadata } from "next";
import { getActiveCollections, productsByIds } from "@/lib/guides";
import { CollectionsIndex } from "@/components/guide-collections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "کالکشن‌های کیا | کیا اکسسوری",
  description: "کالکشن‌های داینامیک کیا: پاییز گرم، مینیمال هر روز، مهمانی و شب، اداری و رسمی، استریت، طلایی و مشکیِ مات.",
};

export default async function CollectionsPage() {
  const collections = await getActiveCollections();
  const products = await productsByIds([...new Set(collections.flatMap(collection => collection.productIds))]);
  return <CollectionsIndex collections={collections} products={products} />;
}
