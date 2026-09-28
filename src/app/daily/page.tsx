import type { Metadata } from "next";
import { getStore } from "@/lib/server-store";
import { getDailyEdition } from "@/lib/daily";
import { DailyEdition } from "@/components/fashion-daily";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fashion Daily — روزنامهٔ دیجیتال کیا",
  description: "هر روز یک گزارش تازه از دنیای کمربند، اکسسوری و استایل: ترندهای روز، اخبار مد، رنگ روز و انتخاب سردبیر.",
};

export default async function DailyPage() {
  const [store, edition] = await Promise.all([getStore(), getDailyEdition()]);
  const products = store.products.filter(product => edition.articles.some(article => article.productIds.includes(product.id)));
  return <DailyEdition articles={edition.articles} products={products} />;
}
