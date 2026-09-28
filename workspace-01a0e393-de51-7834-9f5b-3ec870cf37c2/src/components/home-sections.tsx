"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Flame, Sparkles, ArrowUpLeft, ShoppingBag, Zap, Ruler } from "lucide-react";
import { type Product, money, categoryName } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { ProductCard } from "./product";
import { InvertedCorner } from "./inverted-corner";
import type { FlashSale, HomeSection, Look, Trend } from "@/lib/storefront-types";

/* ============================================================
 *  TRENDING TODAY — ترندهای زندهٔ امروز
 * ============================================================ */
export function TrendingToday({ trends, products }: { trends: Trend[]; products: Product[] }) {
  if (!trends.length) return null;
  const byId = new Map(products.map(p => [p.id, p]));

  return (
    <section className="trending-section" aria-label="ترندهای امروز کیا">
      <div className="section-heading">
        <div><span className="eyebrow">TRENDING TODAY</span><h2><i />ترندهای امروز</h2></div>
        <Link className="text-link" href="/shop">همهٔ محصولات<ArrowUpLeft size={17} /></Link>
      </div>
      <div className="trend-rail">
        {trends.map((trend, index) => {
          const items = trend.productIds.map(id => byId.get(id)).filter((p): p is Product => !!p);
          return (
            <article className="trend-card" key={trend.id}>
              <span className="trend-index">{(index + 1).toLocaleString("fa-IR")}</span>
              <h3>{trend.title}</h3>
              {trend.subtitle && <p>{trend.subtitle}</p>}
              {items.length ? (
                <div className="trend-products">
                  {items.slice(0, 3).map(p => (
                    <Link key={p.id} href={`/product/${p.slug}`} aria-label={p.name}>
                      <img src={p.image} alt={p.name} width="160" height="160" loading="lazy" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="trend-empty">محصولی به این ترند وصل نشده است.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================
 *  NEW DROP — تازه‌رسیده‌ها با ادیت ادیتوریال
 * ============================================================ */
export function NewDrop({ products }: { products: Product[] }) {
  const fresh = useMemo(() => [...products].reverse().slice(0, 3), [products]);
  if (!fresh.length) return null;

  return (
    <section className="drop-section" aria-label="تازه‌رسیده‌های کیا">
      <div className="drop-inner">
        <div className="drop-copy">
          <span className="eyebrow">NEW DROP — تازه رسید</span>
          <h2>جدیدترین جزئیات،<br />همین حالا اینجا.</h2>
          <p>هر انتخاب تازهٔ کیا اول اینجا می‌آید. اگر سلیقه‌ات «چیزی که ندارند بقیه» است، این بخش مال توست.</p>
          <Link className="button button-lime" href="/shop?sort=newest">دیدن همهٔ تازه‌ها<ArrowUpLeft size={20} /></Link>
        </div>
        <div className="drop-grid">
          {fresh.map((p, index) => (
            <Link key={p.id} href={`/product/${p.slug}`} aria-label={p.name}>
              <img src={p.image} alt={p.name} width="320" height="390" loading="lazy" />
              {index === 0 && <span className="drop-badge">تازه رسید</span>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 *  FLASH SALE — کاونت‌داکن کنترل‌شده از سرور
 *  زمان پایان از دیتابیس می‌آید، نه یک تایمر نمایشی.
 * ============================================================ */
function useCountdown(endsAt: number, serverNow: number) {
  /* مقدار اولیه از زمان سرور می‌آید تا رندر سرور و کلاینت یکی باشد (بدون خطای هیدراسیون). */
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - serverNow));
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    done: remaining <= 0,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function FlashSale({ flash, products, serverNow }: { flash: FlashSale | null; products: Product[]; serverNow: number }) {
  if (!flash) return null;
  const endsAt = new Date(flash.endsAt).getTime();
  const items = flash.productIds.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p && p.active);
  if (!items.length) return null;

  return <FlashSaleInner flash={flash} endsAt={endsAt} items={items} serverNow={serverNow} />;
}

function FlashSaleInner({ flash, endsAt, items, serverNow }: { flash: FlashSale; endsAt: number; items: Product[]; serverNow: number }) {
  const { done, hours, minutes, seconds } = useCountdown(endsAt, serverNow);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fa = (n: number) => n.toLocaleString("fa-IR");

  return (
    <section className="flash-section" aria-label="فروش ویژهٔ زمان‌دار">
      <div className="flash-head">
        <div className="flash-title">
          <Flame size={26} />
          <h2>{flash.title}</h2>
        </div>
        {done ? (
          <span className="flash-ended">این فروش ویژه به پایان رسید — منتظر دراپ بعدی باش.</span>
        ) : (
          <div className="flash-countdown" role="timer" aria-label="زمان باقی‌ماندهٔ فروش ویژه">
            <span className="count-cell"><b>{fa(hours)}</b><span>ساعت</span></span>
            <span className="count-sep">:</span>
            <span className="count-cell"><b>{pad(minutes)}</b><span>دقیقه</span></span>
            <span className="count-sep">:</span>
            <span className="count-cell"><b>{pad(seconds)}</b><span>ثانیه</span></span>
          </div>
        )}
        {flash.subtitle && <p className="flash-subtitle">{flash.subtitle}</p>}
      </div>
      <div className="flash-rail">
        {items.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

/* ============================================================
 *  SHOP THE LOOK — افزودن کل ست به سبد با یک کلیک
 *  گوشهٔ معکوس اینجا کاربردی است: CTA روی تصویر است.
 * ============================================================ */
export function ShopTheLook({ looks, products }: { looks: Look[]; products: Product[] }) {
  const { addItem, toast } = useShop();
  if (!looks.length) return null;

  return (
    <>
      {looks.map(look => {
        const items = look.productIds.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p && p.active);
        if (!items.length) return null;
        const total = items.reduce((sum, p) => sum + p.price, 0);

        const addLook = () => {
          let added = 0;
          for (const product of items) {
            addItem(product, product.sizes[0], product.colors[0]?.name, 1);
            added++;
          }
          if (added) toast(`«${look.title}» با ${added.toLocaleString("fa-IR")} قلم به سبد اضافه شد.`);
        };

        return (
          <section className="look-section" key={look.id} aria-label={look.title}>
            <div className="look-media">
              <img src={look.image} alt={look.title} width="700" height="700" loading="lazy" />
              <InvertedCorner position="bottom-left" size={96} aria-label={`افزودن ${look.title} به سبد`}>
                <button className="look-corner-cta" onClick={addLook} aria-label={`افزودن کامل ${look.title} به سبد خرید`}>
                  <ShoppingBag size={22} />
                </button>
              </InvertedCorner>
            </div>
            <div className="look-copy">
              <span className="eyebrow">SHOP THE LOOK</span>
              <h2>{look.title}</h2>
              {look.description && <p>{look.description}</p>}
              <div className="look-items">
                {items.map(p => (
                  <Link className="look-item" key={p.id} href={`/product/${p.slug}`}>
                    <img src={p.image} alt="" width="46" height="46" loading="lazy" />
                    <span>{p.name} <small style={{ color: "var(--muted)" }}>· {categoryName(p.category)}</small></span>
                    <b>{money(p.price)}</b>
                  </Link>
                ))}
              </div>
              <div className="look-total"><span>مجموع ست</span><b>{money(total)} <small style={{ fontSize: 12, color: "var(--muted)" }}>تومان</small></b></div>
              <button className="button button-lime" onClick={addLook}>
                <Zap size={18} />کل ست رو یک‌جا اضافه کن
              </button>
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ============================================================
 *  فاز ۱۳ — سکشن دلخواه Homepage Builder
 *  سه چیدمان: banner (تمام‌عرض) / products (گرید محصول) / split (دوستونه)
 * ============================================================ */
export function CustomSection({ section, products, quickView }: { section: HomeSection; products: Product[]; quickView: (p: Product) => void }) {
  const config = section.config || {};
  const picked = (config.productIds || []).map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p);
  const background = config.background || "";
  const style = background ? { background } : undefined;
  const link = config.link || "/shop";

  if (section.layout === "products") return (
    <section className="custom-section custom-products" style={style} aria-label={section.title}>
      <div className="section-heading"><div>{section.subtitle && <span className="eyebrow">{section.subtitle}</span>}<h2><i />{section.title}</h2></div>
        {config.cta && <Link className="text-link" href={link}>{config.cta}<ArrowUpLeft size={16} /></Link>}
      </div>
      {config.text && <p className="custom-section-text">{config.text}</p>}
      <div className="product-grid">{picked.slice(0, 8).map(p => <ProductCard key={p.id} product={p} onQuickView={quickView} />)}</div>
    </section>
  );

  if (section.layout === "split") return (
    <section className="custom-section custom-split" style={style} aria-label={section.title}>
      {config.image && <img src={config.image} alt={section.title} width="700" height="430" loading="lazy" />}
      <div>
        {section.subtitle && <span className="eyebrow">{section.subtitle}</span>}
        <h2>{section.title}</h2>
        {config.text && <p>{config.text}</p>}
        {config.cta && <Link className="button button-outline" href={link}>{config.cta}<ArrowUpLeft size={18} /></Link>}
      </div>
    </section>
  );

  // پیش‌فرض: بنر تمام‌عرض
  return (
    <section className="custom-section custom-banner" style={style} aria-label={section.title}>
      {config.image && <img className="custom-banner-image" src={config.image} alt="" width="1400" height="420" loading="lazy" />}
      <div className="custom-banner-copy">
        {section.subtitle && <span className="eyebrow">{section.subtitle}</span>}
        <h2>{section.title}</h2>
        {config.text && <p>{config.text}</p>}
        {config.cta && <Link className="button button-lime" href={link}>{config.cta}<ArrowUpLeft size={19} /></Link>}
      </div>
    </section>
  );
}
