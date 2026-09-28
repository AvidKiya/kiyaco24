import type { Metadata } from "next";
import { getPublishedGuides, productsByIds } from "@/lib/guides";
import { GuideIndex } from "@/components/guide-collections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "راهنمای استایل | کیا اکسسوری",
  description: "راهنماهای کوتاه و کاربردی: اندازه‌گیری کمربند، بستن درست، هماهنگی با کفش، انتخاب طلا یا نقره و لایه‌لایه کردن زیورآلات.",
};

export default async function GuidePage() {
  const guides = await getPublishedGuides();
  const products = await productsByIds([...new Set(guides.flatMap(guide => guide.productIds))]);
  return <GuideIndex guides={guides} products={products} />;
}
