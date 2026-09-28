import type { Metadata } from "next";
import { getStore } from "@/lib/server-store";
import { getPartnerTiers } from "@/lib/partner";
import { PartnerLanding } from "@/components/partner";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "همکاری عمده با کیا | کیا اکسسوری", description: "قیمت لایه‌ای عمده، حداقل سفارش مشخص، سبد سفارش سریع و فاکتور رسمی برای فروشندگان و بوتیک‌ها." };

export default async function PartnerPage() {
  const [store, tiers] = await Promise.all([getStore(), getPartnerTiers()]);
  return <PartnerLanding products={store.products} tiers={tiers} />;
}
