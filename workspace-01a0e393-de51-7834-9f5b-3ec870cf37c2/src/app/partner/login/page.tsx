import type { Metadata } from "next";
import { PartnerLogin } from "@/components/partner";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ورود همکاران | کیا اکسسوری" };
export default function PartnerLoginPage() { return <PartnerLogin />; }
