import Link from "next/link";

export const metadata = { title: "درگاه پرداخت آزمایشی — کیا" };

/** درگاه آزمایشی داخلی: تا زمانی که مرچنت زرین‌پال ثبت نشده، چرخهٔ پرداخت را کامل شبیه‌سازی می‌کند */
export default async function MockGatewayPage({ searchParams }: { searchParams: Promise<{ authority?: string; order?: string }> }) {
  const params = await searchParams;
  const authority = String(params.authority || "");
  const order = String(params.order || "");
  const callback = (status: string) => `/api/payment/callback?order=${encodeURIComponent(order)}&Authority=${encodeURIComponent(authority)}&Status=${status}`;
  return (
    <main dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#101012", padding: 24 }}>
      <div style={{ maxWidth: 420, width: "100%", background: "#18181c", border: "1px solid #2a2a30", borderRadius: 20, padding: 32, textAlign: "center", color: "#e8e4da" }}>
        <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 16, background: "rgba(209,155,68,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🏦</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>درگاه پرداخت آزمایشی</h1>
        <p style={{ fontSize: 13, color: "#9a958a", lineHeight: 2, marginBottom: 6 }}>این صفحه شبیه‌ساز درگاه است. با ثبت مرچنت زرین‌پال در پنل مدیریت، مشتری به درگاه واقعی هدایت می‌شود.</p>
        <div style={{ background: "#101014", borderRadius: 12, padding: "12px 16px", margin: "16px 0", fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#9a958a" }}>سفارش</span><b>{order || "—"}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#9a958a" }}>شناسه تراکنش</span><b style={{ fontSize: 11, direction: "ltr" }}>{authority.slice(0, 18) || "—"}…</b></div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <a href={callback("OK")} style={{ display: "block", background: "#D19B44", color: "#101012", borderRadius: 12, padding: "12px 0", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>پرداخت موفق ✓</a>
          <a href={callback("NOK")} style={{ display: "block", background: "transparent", color: "#c8c3b8", border: "1px solid #2a2a30", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>انصراف از پرداخت ✕</a>
        </div>
        <Link href="/track" style={{ display: "inline-block", marginTop: 18, fontSize: 12, color: "#9a958a" }}>بازگشت به رهگیری سفارش</Link>
      </div>
    </main>
  );
}
