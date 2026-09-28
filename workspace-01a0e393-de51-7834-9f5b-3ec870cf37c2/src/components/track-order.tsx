"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Package, Search, Check, Truck, ClipboardCheck, Box, Copy, CreditCard, Banknote, RotateCcw, Upload } from "lucide-react";
import { money, orderStatuses } from "@/lib/catalog";
import { useShop } from "./shop-provider";

type TrackedOrder = { code: string; status: string; total: number; trackingNumber: string; createdAt: string; delivery: string; paymentStatus: string; paymentMethod: string; paymentRef: string; receiptImage: string; items: { name: string; image: string; quantity: number; price: number; size: string; color: string }[] };
type TrackedReturn = { id: number; status: string; reason: string; adminNote: string; refundAmount: number; refundMethod: string; createdAt: string };
type PaymentInfo = { gatewayEnabled: boolean; cardEnabled: boolean; cardNumber: string; cardName: string; canPay: boolean; canReturn: boolean };
const returnStatuses: Record<string, string> = { requested: "در انتظار بررسی", approved: "تأیید شد — منتظر دریافت کالا", rejected: "رد شد", refunded: "وجه بازگردانده شد" };

export function TrackOrder({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [returnsList, setReturnsList] = useState<TrackedReturn[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState("");
  const [paying, setPaying] = useState(false);
  const [reference, setReference] = useState("");
  const [receiptData, setReceiptData] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnBusy, setReturnBusy] = useState(false);
  const { toast } = useShop();

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("payment");
    if (result === "success") setBanner("success");
    else if (result === "failed") setBanner("failed");
    else if (result === "retry") setBanner("retry");
  }, []);

  async function load(codeValue: string, phoneValue: string) {
    const response = await fetch("/api/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: codeValue, phone: phoneValue }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    setOrder(data.order); setPayment(data.payment || null); setReturnsList(data.returns || []);
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true); setOrder(null);
    try { await load(code, phone); } catch (e) { setError(e instanceof Error ? e.message : "اتصال برقرار نشد. دوباره تلاش کنید."); } finally { setLoading(false); }
  }
  async function startPayment() {
    setPaying(true);
    try {
      const response = await fetch("/api/payment/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, phone }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e) { toast(e instanceof Error ? e.message : "اتصال به درگاه برقرار نشد.", "error"); setPaying(false); }
  }
  function pickReceipt(file: File | undefined) {
    if (!file) return setReceiptData("");
    if (file.size > 400 * 1024) { toast("حجم تصویر رسید باید کمتر از ۴۰۰ کیلوبایت باشد.", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setReceiptData(String(reader.result || ""));
    reader.readAsDataURL(file);
  }
  async function submitReceipt(event: FormEvent) {
    event.preventDefault(); setReceiptBusy(true);
    try {
      const response = await fetch("/api/payment/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, phone, reference, image: receiptData || undefined }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      toast(data.message); setReference(""); setReceiptData(""); await load(code, phone);
    } catch (e) { toast(e instanceof Error ? e.message : "ثبت رسید ناموفق بود.", "error"); } finally { setReceiptBusy(false); }
  }
  async function submitReturn(event: FormEvent) {
    event.preventDefault(); setReturnBusy(true);
    try {
      const response = await fetch("/api/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, phone, reason: returnReason }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      toast(data.message); setReturnReason(""); await load(code, phone);
    } catch (e) { toast(e instanceof Error ? e.message : "ثبت مرجوعی ناموفق بود.", "error"); } finally { setReturnBusy(false); }
  }

  const steps = [{ status: "pending", title: "ثبت سفارش", icon: ClipboardCheck }, { status: "confirmed", title: "تأیید فروشگاه", icon: Check }, { status: "packing", title: "آماده‌سازی", icon: Box }, { status: "shipped", title: "ارسال سفارش", icon: Truck }, { status: "delivered", title: "تحویل", icon: Package }];
  return <div className="tracking-content">
    {banner === "success" && <p className="form-success" role="status">پرداخت شما با موفقیت انجام شد. برای دیدن جزئیات، سفارش را رهگیری کنید. ✓</p>}
    {banner === "failed" && <p className="form-error" role="alert">پرداخت انجام نشد یا لغو شد. می‌توانید دوباره تلاش کنید؛ اگر مبلغی کسر شده باشد تا ۷۲ ساعت به حساب شما برمی‌گردد.</p>}
    {banner === "retry" && <p className="form-error" role="alert">نتیجهٔ پرداخت هنوز از درگاه تأیید نشده است. چند دقیقهٔ دیگر سفارش را رهگیری کنید؛ اگر مبلغ کسر شده باشد به‌صورت خودکار تأیید یا برگشت داده می‌شود.</p>}
    <p className="muted">برای دیدن وضعیت سفارشت، کد سفارش و شماره موبایلی که با آن خرید کردی را وارد کن.</p>
    <form className="form-stack" onSubmit={submit}><label>کد سفارش<input required dir="ltr" autoComplete="off" placeholder="K-XXXXXXXXXX" value={code} onChange={e => setCode(e.target.value)} /></label><label>شماره موبایل<input required type="tel" dir="ltr" autoComplete="tel" placeholder="09xxxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-lime" disabled={loading}><Search size={18} />{loading ? "در حال بررسی..." : "پیگیری سفارش"}</button></form>
    {order && <div className="tracked-order"><div className="tracked-heading"><strong dir="ltr">{order.code}</strong><span className={`status-badge status-${order.status}`}>{orderStatuses[order.status]}</span></div><p className="muted">ثبت در {new Date(order.createdAt).toLocaleDateString("fa-IR")}</p>
      {order.status !== "cancelled" && <div className="order-progress">{steps.map((step, index) => <div key={step.status} className={index <= steps.findIndex(s => s.status === order.status) ? "done" : ""}><span><step.icon size={18} /></span><small>{step.title}</small></div>)}</div>}
      <div className="tracking-items">{order.items.map((item, i) => <div key={i}><img src={item.image} alt={item.name} width="55" height="55" /><span><strong>{item.name}</strong><small>{item.color} · سایز {item.size} · {money(item.quantity)} عدد</small></span><b>{money(item.price * item.quantity)} <small>تومان</small></b></div>)}</div>
      <div className="summary-line"><span>مبلغ سفارش</span><strong>{money(order.total)} تومان</strong></div>
      <div className="summary-line muted"><span>وضعیت پرداخت</span><span>{order.paymentStatus === "paid" ? `پرداخت‌شده${order.paymentRef ? ` · مرجع ${order.paymentRef}` : ""}` : order.paymentMethod === "card" ? "رسید کارت‌به‌کارت ثبت شده — در انتظار تأیید فروشگاه" : "در انتظار پرداخت"}</span></div>
      {order.trackingNumber && <div className="tracking-code"><span>کد رهگیری ارسال</span><b dir="ltr">{order.trackingNumber}</b><button className="icon-button" aria-label="کپی کد رهگیری" onClick={async () => { try { await navigator.clipboard.writeText(order.trackingNumber); toast("کد رهگیری کپی شد."); } catch { toast("امکان کپی خودکار نیست؛ کد را انتخاب و کپی کنید.", "error"); } }}><Copy size={17} /></button></div>}

      {payment?.canPay && <div className="track-payment">
        {payment.gatewayEnabled && <button className="button button-lime" disabled={paying} onClick={startPayment}><CreditCard size={18} />{paying ? "در حال اتصال به درگاه..." : `پرداخت آنلاین ${money(order.total)} تومان`}</button>}
        {payment.cardEnabled && payment.cardNumber && <details className="track-card-pay"><summary><Banknote size={16} /> پرداخت کارت‌به‌کارت</summary>
          <div className="track-card-info"><p>مبلغ <b>{money(order.total)} تومان</b> را به کارت زیر واریز کن و شماره پیگیری را ثبت کن:</p><div className="tracking-code"><span>{payment.cardName || "کیا اکسسوری"}</span><b dir="ltr">{payment.cardNumber}</b><button className="icon-button" aria-label="کپی شماره کارت" onClick={async () => { try { await navigator.clipboard.writeText(payment.cardNumber.replace(/\D/g, "")); toast("شماره کارت کپی شد."); } catch { toast("امکان کپی خودکار نیست.", "error"); } }}><Copy size={17} /></button></div></div>
          <form className="form-stack" onSubmit={submitReceipt}>
            <label>شماره پیگیری واریز<input required dir="ltr" minLength={4} placeholder="مثلاً 123456" value={reference} onChange={e => setReference(e.target.value)} /></label>
            <label className="track-receipt-upload"><span><Upload size={15} /> تصویر رسید (اختیاری — حداکثر ۴۰۰KB)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => pickReceipt(e.target.files?.[0])} />{receiptData && <small className="muted">تصویر انتخاب شد ✓</small>}</label>
            <button className="button button-outline" disabled={receiptBusy}>{receiptBusy ? "در حال ثبت..." : "ثبت رسید پرداخت"}</button>
          </form>
        </details>}
      </div>}

      {(payment?.canReturn || returnsList.length > 0) && <div className="track-returns">
        {returnsList.map(item => <div key={item.id} className="track-return-item"><div className="tracked-heading"><strong><RotateCcw size={15} /> مرجوعی #{item.id}</strong><span className={`status-badge status-${item.status === "refunded" ? "delivered" : item.status === "rejected" ? "cancelled" : "pending"}`}>{returnStatuses[item.status] || item.status}</span></div><p className="muted">{item.reason}</p>{item.adminNote && <p className="muted">پاسخ فروشگاه: {item.adminNote}</p>}{item.status === "refunded" && item.refundAmount > 0 && <p className="muted">مبلغ {money(item.refundAmount)} تومان به {item.refundMethod === "wallet" ? "کیف پول شما" : "حساب شما"} بازگردانده شد.</p>}</div>)}
        {payment?.canReturn && <details className="track-card-pay"><summary><RotateCcw size={16} /> درخواست مرجوعی (تا ۷ روز پس از تحویل)</summary>
          <form className="form-stack" onSubmit={submitReturn}>
            <label>دلیل مرجوعی<textarea required minLength={10} rows={3} placeholder="مثلاً: سایز کمربند برایم بزرگ است و سایز پایین‌تر می‌خواهم." value={returnReason} onChange={e => setReturnReason(e.target.value)} /></label>
            <p className="muted">طبق سیاست فروشگاه، مرجوعی تا ۷ روز و با پلمب سالم پذیرفته می‌شود.</p>
            <button className="button button-outline" disabled={returnBusy}>{returnBusy ? "در حال ثبت..." : "ثبت درخواست مرجوعی"}</button>
          </form>
        </details>}
      </div>}
    </div>}
  </div>;
}
