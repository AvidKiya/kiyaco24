import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // اجازهٔ اتصال HMR برای دامنهٔ پیش‌نمایش (فقط در حالت توسعه)
  ...(process.env.NODE_ENV === "development" ? { allowedDevOrigins: [".e2b.app"] } : {}),
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/api/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // فاز ۱۶ — کش مرورگر برای دارایی‌های ایستا (تصاویر یک هفته، فونت یک سال)
      { source: "/images/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};
export default nextConfig;
