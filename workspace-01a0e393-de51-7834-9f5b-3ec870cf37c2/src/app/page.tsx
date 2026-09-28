import type { Metadata } from "next";
import Storefront from "@/components/storefront";
import { getStore } from "@/lib/server-store";
import { getStorefrontExtras } from "@/lib/storefront-data";
import { getSiteSeo, organizationJsonLd, jsonLdScript, siteUrl, absolute } from "@/lib/seo";
export const dynamic = "force-dynamic";
/* فاز ۱۵ — متادیتای سراسری قابل مدیریت از پنل + تأیید مالکیت گوگل */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSeo();
  return {
    title: site.metaTitle, description: site.metaDescription,
    alternates: { canonical: siteUrl() },
    openGraph: { title: site.metaTitle, description: site.metaDescription, images: [absolute(site.ogImage)], type: "website", locale: "fa_IR", url: siteUrl() },
    ...(site.googleVerification ? { verification: { google: site.googleVerification } } : {}),
  };
}
export default async function HomePage() {
  const [store, extras, site] = await Promise.all([getStore(), getStorefrontExtras(), getSiteSeo()]);
  const graphs = organizationJsonLd(site, { instagramUrl: store.settings.instagramUrl, telegramUrl: store.settings.telegramUrl, supportPhone: store.settings.supportPhone });
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(graphs) }} />
    <Storefront {...store} extras={extras} />
  </>;
}
