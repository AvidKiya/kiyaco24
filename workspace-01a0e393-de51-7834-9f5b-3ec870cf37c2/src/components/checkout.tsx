"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ShoppingBag, ShieldCheck, Truck, Check, Copy, X, Info, Trash2, LoaderCircle, Gift, Wallet } from "lucide-react";
import { type Product, type ShopSettings, money } from "@/lib/catalog";
import { StoreShell } from "./store-shell";
import { useShop } from "./shop-provider";
import { EmptyState } from "./ui";
import { trackEvent } from "@/lib/client-analytics";
export default function Checkout({ products, settings, wallet }: { products: Product[]; settings: ShopSettings; wallet?: { balance: number; name: string; city: string } | null }) {
  const [useWallet, setUseWallet] = useState(false);
  const shop = useShop();
  const [delivery, setDelivery] = useState("shipping");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; percent: number; amount: number; type: string; label: string } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [giftCardInput, setGiftCardInput] = useState("");
  const [giftCard, setGiftCard] = useState<{ code: string; amount: number; label: string } | null>(null);
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [couponError, setCouponError] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [receipt, setReceipt] = useState<{ code: string; total: number } | null>(null);
  const subtotal = shop.cart.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const discount = (coupon?.amount ?? 0) + (giftCard?.amount ?? 0);
  const remainingForFreeShipping = Math.max(0, settings.shippingThreshold - subtotal);
  const shipping = delivery === "courier" ? (settings.payment?.courierCost || 0) : delivery === "pickup" || subtotal >= settings.shippingThreshold ? 0 : settings.shippingCost;
  const walletUsed = useWallet && wallet ? Math.min(wallet.balance, Math.max(0, subtotal - discount + shipping)) : 0;
  const total = Math.max(0, subtotal - discount + shipping - walletUsed);
  const cartLines = shop.cart.map(item => ({ productId: item.productId, price: item.price, quantity: item.quantity, category: products.find(p => p.id === item.productId)?.category }));
  /* فاز ۱۵ — رویداد شروع پرداخت */
  useEffect(() => { if (shop.ready && shop.cart.length && !receipt) trackEvent("begin_checkout", ""); }, [shop.ready, shop.cart.length, receipt]);
  /* فاز ۱۰ — ثبت سبد رهاشده: وقتی مشتری شماره‌اش را وارد کرد ولی خرید را تمام نکرد، برای یادآوری خودکار ثبت می‌شود */
  const trackedRef = useRef("");
  useEffect(() => {
    if (receipt || !shop.cart.length || !/^09\d{9}$/.test(phone)) return;
    const snapshot = phone + "|" + shop.cart.map(i => `${i.productId}x${i.quantity}`).join(",");
    if (trackedRef.current === snapshot) return;
    const timer = setTimeout(() => {
      trackedRef.current = snapshot;
      void fetch("/api/notifications/alerts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "track-cart", phone, step: "checkout", total: subtotal,
          items: shop.cart.map(i => ({ productId: i.productId, name: i.name, image: i.image, price: i.price, quantity: i.quantity, size: i.size, color: i.color })) }),
      }).catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, [phone, shop.cart, subtotal, receipt]);
  async function applyCoupon(event: FormEvent) {
    event.preventDefault(); if (!couponInput.trim()) return;
    setCouponLoading(true); setCouponError("");
    try {
      const response = await fetch("/api/coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: couponInput, lines: cartLines, phone }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCoupon(data); shop.toast(`${data.label} روی سفارشت اعمال شد.`);
    } catch (e) { setCoupon(null); const message = e instanceof Error ? e.message : "کد تخفیف بررسی نشد."; setCouponError(message); shop.toast(message, "error"); }
    finally { setCouponLoading(false); }
  }
  async function applyGiftCard(event: FormEvent) {
    event.preventDefault(); if (!giftCardInput.trim()) return;
    setGiftCardLoading(true);
    try {
      const response = await fetch("/api/coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ giftCard: giftCardInput, lines: cartLines, phone }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setGiftCard({ code: data.code, amount: data.amount, label: data.label }); shop.toast("اعتبار هدیه روی سفارشت اعمال شد.");
    } catch (e) { setGiftCard(null); shop.toast(e instanceof Error ? e.message : "بررسی گیفت‌کارت انجام نشد.", "error"); }
    finally { setGiftCardLoading(false); }
  }
  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading || !accepted) return;
    setError(""); setLoading(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const key = requestKey || crypto.randomUUID(); setRequestKey(key);
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, phone, delivery, coupon: coupon?.code || "", giftCard: giftCard?.code || "", giftWrap, giftMessage, useWallet: walletUsed > 0, requestKey: key, items: shop.cart.map(i => ({ productId: i.productId, quantity: i.quantity, size: i.size, color: i.color })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "ثبت سفارش انجام نشد.");
      setReceipt({ code: data.code, total: data.total }); shop.clearCart(); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "اتصال برقرار نشد. دوباره تلاش کن؛ سفارش تکراری ثبت نمی‌شود."); }
    finally { setLoading(false); }
  }
  return <StoreShell products={products} settings={settings}><div className="container checkout-page"><div className="breadcrumbs"><Link href="/">خانه</Link><ChevronLeft size={13} /><Link href="/shop">فروشگاه</Link><ChevronLeft size={13} /><span>ثبت سفارش</span></div>
    {!shop.ready ? <div className="loading-text">در حال آماده‌کردن سبد خرید...</div> : receipt ? <div className="order-success"><span className="success-icon"><Check size={36} /></span><span className="eyebrow">A GOOD CHOICE, MADE.</span><h1>یک انتخاب خوب، ثبت شد!</h1><p>سفارشت به دست ما رسید و در انتظار پرداخت است. از صفحهٔ «پیگیری سفارش» می‌تونی همین حالا آنلاین یا کارت‌به‌کارت پرداخت کنی؛ در غیر این صورت برای هماهنگی تماس می‌گیریم.</p><div className="success-code"><span>کد سفارش تو</span><b dir="ltr">{receipt.code}</b><button className="icon-button" aria-label="کپی کد سفارش" onClick={async () => { try { await navigator.clipboard.writeText(receipt.code); shop.toast("کد سفارش کپی شد."); } catch { shop.toast("کد سفارش را انتخاب و کپی کنید.", "error"); } }}><Copy size={17} /></button></div><div className="success-total">مبلغ سفارش: <strong>{money(receipt.total)} تومان</strong></div><div className="success-actions"><Link className="button button-lime" href={`/track?code=${receipt.code}`}>پیگیری سفارش<ArrowLeft size={17} /></Link><Link className="button button-outline" href="/shop">بازگشت به فروشگاه</Link></div></div> : !shop.cart.length ? <EmptyState icon={<ShoppingBag size={40} />} title="هنوز انتخابی نکردی" text="اول چند تا از جزئیات مورد علاقه‌ات رو به سبد اضافه کن."><Link className="button button-lime" href="/shop">بریم فروشگاه<ArrowLeft size={18} /></Link></EmptyState> : <><h1>یک قدم تا انتخاب خوبت</h1><p className="checkout-intro">اطلاعاتت رو وارد کن؛ بقیهٔ مسیر رو با هم پیش می‌ریم.</p><div className="checkout-layout"><form className="checkout-form-card" onSubmit={placeOrder}><h2><span>۱</span>اطلاعات دریافت‌کننده</h2><div className="form-grid"><label>نام و نام خانوادگی<input required name="name" autoComplete="name" placeholder="نام کامل دریافت‌کننده" minLength={3} maxLength={100} defaultValue={wallet?.name || ""} /></label><label>شماره موبایل<input required name="phone" type="tel" autoComplete="tel" dir="ltr" placeholder="09xxxxxxxxx" maxLength={14} minLength={11} value={phone} onChange={e => setPhone(e.target.value)} /></label></div><h3 className="checkout-section-title">چطور به دستت برسونیم؟</h3><div className="delivery-options"><label className={`delivery-option ${delivery === "shipping" ? "selected" : ""}`}><input type="radio" name="deliveryChoice" checked={delivery === "shipping"} onChange={() => setDelivery("shipping")} /><span><strong>ارسال به آدرس شما</strong><small>{subtotal >= settings.shippingThreshold ? "ارسال رایگان برای این سفارش" : `${money(settings.shippingCost)} تومان هزینهٔ ارسال`}</small></span></label>{settings.payment?.courierEnabled && <label className={`delivery-option ${delivery === "courier" ? "selected" : ""}`}><input type="radio" name="deliveryChoice" checked={delivery === "courier"} onChange={() => setDelivery("courier")} /><span><strong>پیک شهری</strong><small>{settings.payment.courierNote || "تحویل سریع داخل شهر"}{settings.payment.courierCost ? ` · ${money(settings.payment.courierCost)} تومان` : " · بدون هزینه"}</small></span></label>}{settings.address && <label className={`delivery-option ${delivery === "pickup" ? "selected" : ""}`}><input type="radio" name="deliveryChoice" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")} /><span><strong>تحویل حضوری</strong><small>بدون هزینه؛ با هماهنگی قبلی</small></span></label>}</div><h3 className="checkout-section-title">{delivery === "shipping" ? "آدرس دریافت سفارش" : delivery === "courier" ? "نشانی تحویل پیک" : "نشانی فروشگاه"}</h3>{delivery === "shipping" ? <div className="form-grid"><label>شهر<input required name="city" autoComplete="address-level2" placeholder="مثلاً تهران" minLength={2} maxLength={100} /></label><label>کد پستی<input required name="postalCode" autoComplete="postal-code" inputMode="numeric" dir="ltr" placeholder="کد پستی ۱۰ رقمی" pattern="[0-9۰-۹٠-٩]{10}" title="کد پستی باید ۱۰ رقم باشد" maxLength={10} /></label><label className="full-width">آدرس کامل<textarea required name="address" autoComplete="street-address" placeholder="استان، خیابان، کوچه، پلاک و واحد" minLength={8} maxLength={600} rows={3} /></label></div> : delivery === "courier" ? <div className="form-grid"><label>شهر<input name="city" autoComplete="address-level2" placeholder="مثلاً تهران" maxLength={100} /></label><label className="full-width">نشانی کامل تحویل<textarea required name="address" autoComplete="street-address" placeholder="محله، خیابان، کوچه، پلاک و واحد" minLength={8} maxLength={600} rows={3} /></label></div> : <p className="payment-note">{settings.address}</p>}<div className="form-grid" style={{ marginTop: 18 }}><label className="full-width">توضیحات سفارش <span className="muted">(اختیاری)</span><textarea name="note" maxLength={600} rows={2} placeholder="اگر نکته‌ای هست که باید بدونیم، اینجا بنویس." /></label></div>
        <h3 className="checkout-section-title">این خرید، یک هدیه است؟</h3>
        <div className="gift-options">
          <label className={giftWrap ? "gift-option selected" : "gift-option"}><input type="checkbox" checked={giftWrap} onChange={e => { setGiftWrap(e.target.checked); if (!e.target.checked) setGiftMessage(""); }} /><span><Gift size={19} /><div><strong>کادوپیچ اختصاصی کیا</strong><small>بسته‌بندی هدیه با روبان و کارت امضا</small></div></span></label>
          {giftWrap && <label className="gift-message-field">پیام هدیه‌ات را بنویس<textarea rows={3} maxLength={400} value={giftMessage} onChange={e => setGiftMessage(e.target.value)} placeholder="مثلاً: برات آرزوی بهترین‌ها رو دارم..." /></label>}
        </div><h3 className="checkout-section-title">ثبت سفارش و هماهنگی پرداخت</h3><div className="payment-note"><Info size={19} /><p>در این مرحله مبلغی پرداخت نمی‌کنی. پس از بررسی سفارش، فروشگاه برای تأیید و هماهنگی روش پرداخت با تو تماس می‌گیرد. قیمت و موجودی نهایی هنگام ثبت در سرور بررسی می‌شوند.</p></div><label className="terms-checkbox"><input required type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>اطلاعات بالا را بررسی کردم و با ثبت سفارش برای تأیید فروشگاه و هماهنگی پرداخت موافقم.</span></label>{error && <p className="form-error" role="alert" style={{ marginTop: 18 }}>{error}</p>}<button className="button button-lime checkout-submit" disabled={loading || !accepted || !shop.cart.length}><span>{loading ? "در حال ثبت سفارش..." : "ثبت سفارش و دریافت کد پیگیری"}</span>{loading ? <LoaderCircle size={19} className="spin" /> : <ArrowLeft size={19} />}</button></form>
    <aside className="order-summary-card"><h2><ShoppingBag size={20} />خلاصهٔ انتخاب‌های تو <span className="muted">({money(shop.cart.reduce((s, i) => s + i.quantity, 0))})</span></h2><div className="checkout-items">{shop.cart.map(item => <div key={item.key}><Link href={`/product/${item.slug}`}><img src={item.image} alt={item.name} width="70" height="75" /></Link><div><h3>{item.name}</h3><p>{item.color} · سایز {item.size} · {money(item.quantity)} عدد</p><div className="summary-line"><span>{money(item.price * item.quantity)} تومان</span><button type="button" aria-label={`حذف ${item.name}`} onClick={() => shop.updateQuantity(item.key, 0)}><Trash2 size={14} /></button></div></div></div>)}</div>{coupon ? <div className="applied-coupon"><Check size={16} /><span>{coupon.code} · {money(coupon.amount)} تومان تخفیف</span><button aria-label="حذف کد تخفیف" onClick={() => { setCoupon(null); setCouponError(""); }}><X size={15} /></button></div> : <form className="coupon-entry" onSubmit={applyCoupon}><input aria-label="کد تخفیف" placeholder="کد تخفیف داری؟" value={couponInput} onChange={e => setCouponInput(e.target.value)} maxLength={30} /><button disabled={couponLoading}>{couponLoading ? "..." : "اعمال کد"}</button></form>}
        {couponError && <p className="coupon-error" role="alert">{couponError}</p>}
        {giftCard ? <div className="applied-coupon"><Gift size={16} /><span>{giftCard.code} · {money(giftCard.amount)} تومان اعتبار</span><button aria-label="حذف گیفت‌کارت" onClick={() => setGiftCard(null)}><X size={15} /></button></div> : <form className="coupon-entry" onSubmit={applyGiftCard}><input aria-label="کد گیفت‌کارت" placeholder="کد گیفت‌کارت داری؟" value={giftCardInput} onChange={e => setGiftCardInput(e.target.value)} maxLength={30} /><button disabled={giftCardLoading}>{giftCardLoading ? "..." : "اعمال"}</button></form>}{wallet && wallet.balance > 0 && <div className="checkout-wallet"><label className={`delivery-option ${useWallet ? "selected" : ""}`}><input type="checkbox" checked={useWallet} onChange={e => setUseWallet(e.target.checked)} /><span><strong><Wallet size={17} />پرداخت با اعتبار کیف پول</strong><small>اعتبار موجود: {money(wallet.balance)} تومان{walletUsed > 0 ? ` · ${money(walletUsed)} تومان از این سفارش کم می‌شود` : ""}</small></span></label></div>}<div className="checkout-totals"><div className="summary-line"><span>جمع محصولات</span><span>{money(subtotal)} تومان</span></div>{coupon && <div className="summary-line discount-line"><span>تخفیف {coupon.code}</span><span>− {money(coupon.amount)} تومان</span></div>}{giftCard && <div className="summary-line discount-line"><span>اعتبار هدیه</span><span>− {money(giftCard.amount)} تومان</span></div>}<div className="summary-line"><span>هزینهٔ ارسال</span><span>{shipping ? `${money(shipping)} تومان` : "رایگان"}</span></div>{walletUsed > 0 && <div className="summary-line discount-line"><span>اعتبار کیف پول</span><span>− {money(walletUsed)} تومان</span></div>}<div className="summary-line total-line"><span>مبلغ سفارش</span><strong>{money(total)} <small>تومان</small></strong></div></div><div className="shipping-progress compact-progress"><Truck size={19} /><p>{remainingForFreeShipping === 0 ? "ارسال این سفارش مهمون مایی!" : <>{money(remainingForFreeShipping)} تومان تا ارسال رایگان</>}</p><div><span style={{ width: `${Math.min(100, subtotal / Math.max(1, settings.shippingThreshold) * 100)}%` }} /></div></div>
        {giftWrap && <p className="checkout-gift-note"><Gift size={16} />سفارشت با کادوپیچ اختصاصی آماده می‌شود.</p>}
        <p className="checkout-reassurance"><ShieldCheck size={17} />اطلاعاتت فقط برای پردازش سفارش استفاده می‌شود.</p></aside></div></>}
  </div></StoreShell>;
}
