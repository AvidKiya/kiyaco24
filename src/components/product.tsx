"use client";
import { useState } from "react";
import Link from "next/link";
import { Heart, ShoppingBag, ArrowUpLeft, Check, Ruler, ShieldCheck, Truck, Expand, Minus, BellRing, TrendingDown, Play } from "lucide-react";
import { type Product, money, discountPercent, categoryName } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { Quantity } from "./ui";

export function ProductCard({ product: p, onQuickView }: { product: Product; onQuickView?: (p: Product) => void }) {
  const { favorites, toggleFavorite, addItem } = useShop();
  const discount = discountPercent(p);
  return <article className="product-card">
    <div className="product-photo">
      <Link href={`/product/${p.slug}`} aria-label={`مشاهده ${p.name}`}><img src={p.image} alt={p.name} width="500" height="500" loading="lazy" /></Link>
      {discount > 0 ? <span className="product-badge">{money(discount)}٪ تخفیف</span> : <span className="product-badge neutral-badge">جدید</span>}
      <button className={`favorite-button ${favorites.includes(p.id) ? "is-favorite" : ""}`} aria-label={favorites.includes(p.id) ? `حذف ${p.name} از علاقه‌مندی‌ها` : `افزودن ${p.name} به علاقه‌مندی‌ها`} aria-pressed={favorites.includes(p.id)} onClick={() => toggleFavorite(p.id)}><Heart size={18} fill={favorites.includes(p.id) ? "currentColor" : "none"} /></button>
      <Link className="photo-quick-link" href={`/product/${p.slug}`}>جزئیات محصول <ArrowUpLeft size={16} /></Link>
    </div>
    <div className="product-info">
      <div className="product-kicker"><span>{categoryName(p.category)} <span className="dot-separator">•</span> کالکشن کیا</span><div className="color-dots">{p.colors.map(c => <span key={c.name} style={{ background: c.hex }} title={c.name} />)}</div></div>
      <h3><Link href={`/product/${p.slug}`}>{p.name}</Link></h3>
      <div className="product-bottom"><div className="price-stack">{p.compareAt && <del>{money(p.compareAt)}</del>}<span className="price">{money(p.price)} <small>تومان</small></span></div><button className="add-button" aria-label={`انتخاب و خرید ${p.name}`} disabled={p.stock === 0} onClick={() => onQuickView ? onQuickView(p) : addItem(p)}><ShoppingBag size={19} /></button></div>
      {p.stock === 0 && <span className="out-of-stock">ناموجود</span>}
    </div>
  </article>;
}

export function ProductDetails({ product: p, compact = false, onAdded }: { product: Product; compact?: boolean; onAdded?: () => void }) {
  const { addItem, favorites, toggleFavorite } = useShop();
  const [size, setSize] = useState(p.sizes[0] || "استاندارد");
  const [color, setColor] = useState(p.colors[0]?.name || "پیش‌فرض");
  const [quantity, setQuantity] = useState(1);
  const [guide, setGuide] = useState(false);
  const [zoom, setZoom] = useState(false);
  /* فاز ۱۶ — گالری چندتصویری + ویدیو */
  const media: { kind: "image" | "video"; src: string }[] = [{ kind: "image", src: p.image }, ...(p.gallery || []).map(src => ({ kind: "image" as const, src })), ...(p.video ? [{ kind: "video" as const, src: p.video }] : [])];
  const [mediaIndex, setMediaIndex] = useState(0);
  const active = media[Math.min(mediaIndex, media.length - 1)];
  return <div className={`product-detail-grid ${compact ? "compact-detail" : ""}`}>
    <div className="detail-media">
      {active.kind === "video"
        ? <div className="detail-photo detail-video"><video src={active.src} controls playsInline preload="metadata" poster={p.image} aria-label={`ویدیوی ${p.name}`} /></div>
        : <button className={`detail-photo ${zoom ? "zoomed" : ""}`} onClick={() => setZoom(!zoom)} aria-label={zoom ? "خروج از بزرگ‌نمایی تصویر" : "بزرگ‌نمایی تصویر محصول"}><img src={active.src} alt={p.name} width="800" height="800" /><span>{zoom ? <Minus size={20} /> : <Expand size={20} />}</span></button>}
      {media.length > 1 && <div className="media-thumbs" role="tablist" aria-label={`گالری ${p.name}`}>{media.map((m, i) => <button key={i} role="tab" aria-selected={i === mediaIndex} className={`media-thumb ${i === mediaIndex ? "selected" : ""}`} aria-label={m.kind === "video" ? "ویدیوی محصول" : `تصویر ${i + 1} از ${media.length}`} onClick={() => { setMediaIndex(i); setZoom(false); }}>{m.kind === "video" ? <span className="media-thumb-video"><Play size={18} /></span> : <img src={m.src} alt="" width="64" height="64" loading="lazy" />}</button>)}</div>}
    </div>
    <div className="detail-info"><span className="eyebrow">KIYA SIGNATURE COLLECTION</span><h1>{p.name}</h1><p className="muted detail-material">{p.material}</p>
      <div className="detail-price"><span className="price">{money(p.price)} <small>تومان</small></span>{p.compareAt && <del>{money(p.compareAt)}</del>}{discountPercent(p) > 0 && <span className="inline-badge">{money(discountPercent(p))}٪ تخفیف</span>}</div>
      <p className="detail-description">{p.description}</p>
      <div className="variant-group"><label>رنگ: <strong>{color}</strong></label><div className="color-choices">{p.colors.map(c => <button key={c.name} title={c.name} aria-label={c.name} aria-pressed={color === c.name} className={color === c.name ? "selected" : ""} onClick={() => setColor(c.name)}><span style={{ background: c.hex }}>{color === c.name && <Check size={15} color={c.hex === "#252621" ? "white" : "#222"} />}</span></button>)}</div></div>
      <div className="variant-group"><div className="variant-label"><label>انتخاب سایز</label><button className="text-link" onClick={() => setGuide(!guide)}><Ruler size={15} />راهنمای سایز</button></div><div className="size-choices">{p.sizes.map(s => <button key={s} className={size === s ? "selected" : ""} aria-pressed={size === s} onClick={() => setSize(s)}>{/^\d+$/.test(s) ? money(Number(s)) : s}</button>)}</div></div>
      {guide && <div className="size-guide"><strong>انتخاب اندازهٔ مناسب</strong><p>{p.category === "belts" ? "عدد سایز، طول کمربند به سانتی‌متر است. دور کمرتان را از روی شلوار اندازه بگیرید؛ معمولاً کمربند ۱۰ تا ۱۵ سانتی‌متر بلندتر از دور کمر مناسب است." : p.category === "rings" ? "قطر داخلی انگشتر مناسب خود را اندازه بگیرید: سایز ۸ حدود ۱۸٫۲، سایز ۹ حدود ۱۹، سایز ۱۰ حدود ۱۹٫۸ و سایز ۱۱ حدود ۲۰٫۶ میلی‌متر است." : p.category === "necklaces" ? "سایز گردنبند، طول کامل زنجیر به سانتی‌متر است. برای انتخاب راحت‌تر، طول موردنظر را با یک نخ دور گردن امتحان کنید." : p.category === "bracelets" ? "دور مچ را با متر اندازه بگیرید و برای راحتی، ۱ تا ۲ سانتی‌متر به آن اضافه کنید. سایزها به سانتی‌متر هستند." : "این محصول در اندازهٔ استاندارد عرضه می‌شود. برای جزئیات بیشتر از بخش تماس با ما پیام بگذارید."}</p></div>}
      <div className="detail-buy"><Quantity value={quantity} max={Math.min(p.stock, 10)} onChange={n => setQuantity(Math.max(1, n))} /><button className="button button-lime" disabled={!p.stock} onClick={() => { addItem(p, size, color, quantity); onAdded?.(); }}><ShoppingBag size={19} />{p.stock ? "افزودن به سبد خرید" : "فعلاً ناموجود"}</button><button className={`icon-button detail-wishlist ${favorites.includes(p.id) ? "is-favorite" : ""}`} aria-label="ذخیره در علاقه‌مندی‌ها" aria-pressed={favorites.includes(p.id)} onClick={() => toggleFavorite(p.id)}><Heart size={21} fill={favorites.includes(p.id) ? "currentColor" : "none"} /></button></div>
      <span className={`availability ${p.stock ? "" : "unavailable"}`}><i />{p.stock ? "موجود و آمادهٔ ثبت سفارش" : "فعلاً ناموجود — می‌تونیم به‌محض موجود شدن خبرت کنیم"}</span>
      {!compact && <ProductAlertForm product={p} />}
      <div className="detail-assurances"><span><Truck size={18} />ارسال به سراسر ایران</span><span><ShieldCheck size={18} />۷ روز فرصت بررسی و بازگشت</span></div>
      {compact && <Link className="text-link" href={`/product/${p.slug}`}>مشاهدهٔ صفحهٔ کامل محصول <ArrowUpLeft size={16} /></Link>}
    </div>
  </div>;
}

/* ---------- فاز ۱۰: درخواست اطلاع‌رسانی موجود شدن / کاهش قیمت ---------- */
export function ProductAlertForm({ product: p }: { product: Product }) {
  const { toast } = useShop();
  const type = p.stock ? "price_drop" : "back_in_stock";
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/notifications/alerts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", productId: p.id, type, phone, priceAtRequest: p.price }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ثبت نشد.");
      toast(result.message || "ثبت شد؛ به‌محض تغییر خبرت می‌کنیم.");
      setDone(true); setOpen(false);
    } catch (error) { toast(error instanceof Error ? error.message : "ثبت نشد.", "error"); }
    finally { setBusy(false); }
  }

  if (done) return <div className="product-alert done"><Check size={17} /><span>{type === "back_in_stock" ? "به‌محض موجود شدن بهت پیامک می‌دهیم." : "اگر قیمت کم شد بهت پیامک می‌دهیم."}</span></div>;

  return <div className="product-alert">
    {!open
      ? <button type="button" className="button button-outline product-alert-toggle" onClick={() => setOpen(true)}>
          {type === "back_in_stock" ? <><BellRing size={17} />موجود شد، خبرم کن</> : <><TrendingDown size={17} />قیمتش کم شد، خبرم کن</>}
        </button>
      : <form className="product-alert-form" onSubmit={submit}>
          <input dir="ltr" type="tel" inputMode="numeric" pattern="09[0-9]{9}" required maxLength={11} value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ""))} placeholder="09121234567" aria-label="شماره موبایل برای اطلاع‌رسانی" />
          <button className="button button-lime" disabled={busy}>{busy ? "در حال ثبت..." : "خبرم کن"}</button>
          <button type="button" className="icon-button" aria-label="بستن فرم اطلاع‌رسانی" onClick={() => setOpen(false)}><Minus size={16} /></button>
        </form>}
  </div>;
}
