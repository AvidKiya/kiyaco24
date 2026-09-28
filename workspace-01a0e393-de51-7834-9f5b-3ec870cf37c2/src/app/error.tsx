"use client";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="standalone-page"><TriangleAlert size={44} color="#d19b44" /><h1>یه وقفهٔ کوتاه پیش اومد.</h1><p>ارتباط با فروشگاه برقرار نشد. سبد خریدت روی دستگاهت محفوظ است.</p><button className="button button-lime" onClick={reset}><RefreshCw size={18} />دوباره تلاش کن</button><Link className="text-link" href="/">بازگشت به صفحهٔ اصلی</Link></main>;
}
