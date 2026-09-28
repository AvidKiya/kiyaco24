import Link from "next/link";
export default function NotFound() { return <main className="standalone-page"><span className="large-wordmark" dir="ltr">404.</span><h1>این جزئیات رو پیدا نکردیم!</h1><p>شاید محصول جابه‌جا شده یا آدرس صفحه درست نیست.</p><Link href="/shop" className="button button-lime">برگشت به فروشگاه کیا ←</Link></main>; }
