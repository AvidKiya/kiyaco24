import type { Metadata } from "next";
import Checkout from "@/components/checkout";
import { getStore } from "@/lib/server-store";
import { getCurrentCustomer } from "@/lib/customer";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ثبت سفارش | کیا اکسسوری", robots: { index: false, follow: false } };
export default async function CheckoutPage() {
  const [store, customer] = await Promise.all([getStore(), getCurrentCustomer()]);
  return <Checkout {...store} wallet={customer ? { balance: customer.walletBalance, name: customer.name, city: customer.city } : null} />;
}
