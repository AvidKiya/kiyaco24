import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentCustomer } from "@/lib/customer";
import { AccountLogin } from "@/components/account";

export const metadata: Metadata = { title: "حساب کاربری", description: "ورود یا ثبت‌نام در باشگاه مشتریان کیا" };

/* فاز ۹ — صفحهٔ ورود مشتری */
export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (customer) redirect("/account/panel");
  return <AccountLogin />;
}
