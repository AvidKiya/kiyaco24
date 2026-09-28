import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ShopProvider } from "@/components/shop-provider";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "کیا اکسسوری | جزئیات، امضای تو",
  description: "دنیای کمربند، بدلیجات و اکسسوری کیا. انتخاب‌های کوچک برای ساختن یک استایل کاملاً شخصی؛ کمربند، گردنبند، دستبند، انگشتر و ست هدیه.",
  applicationName: "KIYA Accessories",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "KIYA" },
  icons: { icon: "/images/icon-192.png", apple: "/images/icon-192.png" },
  openGraph: { title: "کیا اکسسوری | استایل تو، امضای تو", description: "کمربند و اکسسوری‌هایی که بخشی از شخصیت تو هستن.", locale: "fa_IR", type: "website", siteName: "KIYA" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#121410" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="fa" dir="rtl" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('kiya-theme')==='light'?'light':'dark'}catch(e){}" }} /><link rel="preload" href="/fonts/Vazirmatn.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head><body><ShopProvider>{children}</ShopProvider></body></html>;
}
