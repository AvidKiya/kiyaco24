import type { Metadata } from "next";
import { trackReferralClick } from "@/lib/customer";
import { InviteLanding } from "@/components/account";

export const metadata: Metadata = { title: "دعوت‌نامه", description: "دعوت از یک دوست در باشگاه مشتریان کیا" };
export const dynamic = "force-dynamic";

/* فاز ۹ — صفحهٔ لینک معرف: رصد کلیک سمت سرور + هدایت به ساخت حساب */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const valid = await trackReferralClick(code);
  return <InviteLanding code={code} valid={valid} />;
}
