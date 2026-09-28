"use client";

/** فاز ۱۵ — بیکن سبک آنالیتیکس؛ خطاها بی‌صدا نادیده گرفته می‌شوند تا تجربهٔ خرید مختل نشود */
const seen = new Set<string>();
export function trackEvent(type: string, ref = "", once = true) {
  try {
    const key = `${type}:${ref}`;
    if (once && seen.has(key)) return;
    seen.add(key);
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ref }), keepalive: true }).catch(() => {});
  } catch { /* ساکت */ }
}
