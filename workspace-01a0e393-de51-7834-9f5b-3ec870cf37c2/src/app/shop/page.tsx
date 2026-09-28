import type { Metadata } from "next";
import Storefront from "@/components/storefront";
import { getStore } from "@/lib/server-store";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "فروشگاه | کمربند و اکسسوری کیا", description: "کمربند، گردنبند، دستبند، انگشتر و ست‌های هدیه؛ جزئیات استایل خودت را در کیا پیدا کن." };
export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [store, params] = await Promise.all([getStore(), searchParams]);
  const get = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined;
  return <Storefront {...store} mode="catalog" category={get("category")} query={get("q")} sort={get("sort")} sale={get("sale") === "1"} />;
}
