import type { Metadata } from "next";
import { getStore } from "@/lib/server-store";
import { getActiveTrends, productsByIds } from "@/lib/guides";
import { TrendingHub } from "@/components/guide-collections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ترندهای این فصل | کیا اکسسوری",
  description: "داغ‌ترین ترندهای استایل این فصل، انتخاب‌شده توسط تیم کیا و آمادهٔ خرید با یک کلیک.",
};

export default async function TrendingPage() {
  const [trends, store] = await Promise.all([getActiveTrends(), getStore()]);
  const ids = [...new Set(trends.flatMap(trend => trend.productIds))];
  const products = await productsByIds(ids);
  const all = store.products.filter(product => ids.includes(product.id));
  return <TrendingHub trends={trends} products={all.length ? all : products} />;
}
