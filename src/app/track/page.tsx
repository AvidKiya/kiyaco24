import type { Metadata } from "next";
import Storefront from "@/components/storefront";
import { getStore } from "@/lib/server-store";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "پیگیری سفارش | کیا اکسسوری" };
export default async function TrackPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const [store, params] = await Promise.all([getStore(), searchParams]);
  return <Storefront {...store} mode="track" orderCode={params.code} />;
}
