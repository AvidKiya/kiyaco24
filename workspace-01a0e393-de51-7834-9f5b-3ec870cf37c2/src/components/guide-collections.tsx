"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, Flame, Sparkles, Clock, PenLine, ShoppingBag, GraduationCap, LayoutGrid, Check, Layers } from "lucide-react";
import { type Product, money, categoryName, discountPercent } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { ProductCard } from "./product";
import { InvertedCorner } from "./inverted-corner";
import {
  type Guide, type Collection, type GuideTopic, type GuideBlock,
  guideTopics, topicMeta, parseGuideBody, guideSteps,
} from "@/lib/guide-types";
import type { Trend } from "@/lib/storefront-types";

/* ============================================================
 *  کارت محصول کوچک (داخل راهنما)
 * ============================================================ */
export function GuideProductCard({ product, label }: { product: Product; label?: string }) {
  const { addItem, toast } = useShop();
  const off = discountPercent(product);
  return (
    <div className="guide-product-card">
      <Link href={`/product/${product.slug}`} className="guide-product-image">
        <img src={product.image} alt={product.name} width="120" height="120" loading="lazy" />
        {off > 0 && <span className="guide-product-off">{off.toLocaleString("fa-IR")}٪</span>}
      </Link>
      <div className="guide-product-body">
        <span className="guide-product-category">{categoryName(product.category)}</span>
        <Link href={`/product/${product.slug}`}><h4>{label || product.name}</h4></Link>
        <div className="guide-product-price">
          <strong>{money(product.price)} <small>تومان</small></strong>
          {product.compareAt && product.compareAt > product.price && <s>{money(product.compareAt)}</s>}
        </div>
        <div className="guide-product-actions">
          <button className="button button-lime button-sm" onClick={() => { addItem(product, product.sizes[0], product.colors[0]?.name, 1); toast(`${product.name} به سبد خریدت اضافه شد.`); }}>
            <ShoppingBag size={15} />افزودن به سبد
          </button>
          <Link className="button button-outline button-sm" href={`/product/${product.slug}`}>جزئیات<ArrowLeft size={14} /></Link>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  ۱) صفحهٔ ترندینگ — Trending Hub
 * ============================================================ */
export function TrendingHub({ trends, products }: { trends: Trend[]; products: Product[] }) {
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const [active, setActive] = useState(0);

  if (!trends.length) {
    return (
      <div className="guide-empty">
        <Flame size={40} />
        <h2>هنوز ترندی ثبت نشده</h2>
        <p>به‌زاید ترندهای امروز در فروشگاه نمایش داده می‌شوند.</p>
        <Link className="button button-lime" href="/shop">بریم فروشگاه<ArrowLeft size={17} /></Link>
      </div>
    );
  }

  const activeTrend = trends[Math.min(active, trends.length - 1)];
  const activeItems = activeTrend.productIds.map(id => byId.get(id)).filter((p): p is Product => !!p);

  return (
    <div className="trending-page">
      <header className="page-hero">
        <div className="container">
          <span className="eyebrow">TRENDING NOW</span>
          <h1>ترندهای این فصل</h1>
          <p>داغ‌ترین مسیرهای استایل، انتخاب‌شده توسط تیم کیا و آمادهٔ خرید با یک کلیک.</p>
        </div>
      </header>

      <div className="container trending-body">
        <nav className="trending-tabs" aria-label="انتخاب ترند">
          {trends.map((trend, index) => (
            <button key={trend.id} className={index === active ? "active" : ""} onClick={() => setActive(index)}>
              <span className="trending-tab-index">{(index + 1).toLocaleString("fa-IR")}</span>
              {trend.title}
            </button>
          ))}
        </nav>

        <section className="trending-detail" aria-label={`ترند ${activeTrend.title}`}>
          <div className="trending-detail-head">
            <h2><i />{activeTrend.title}</h2>
            {activeTrend.subtitle && <p>{activeTrend.subtitle}</p>}
          </div>
          {activeItems.length ? (
            <div className="product-grid">
              {activeItems.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <p className="muted">برای این ترند هنوز محصولی متصل نشده است.</p>
          )}
          <div className="trending-detail-foot">
            <Link className="button button-outline" href="/shop">همهٔ محصولات<ArrowLeft size={16} /></Link>
            <Link className="button button-outline" href="/guide">راهنمای استایل<GraduationCap size={16} /></Link>
            <Link className="button button-outline" href="/collections">کالکشن‌ها<LayoutGrid size={16} /></Link>
          </div>
        </section>

        <section className="trending-all" aria-label="همهٔ ترندها">
          <div className="section-heading">
            <div><span className="eyebrow">ALL TRENDS</span><h2><i />همهٔ ترندهای امروز</h2></div>
          </div>
          <div className="trending-grid">
            {trends.map((trend, index) => {
              const items = trend.productIds.map(id => byId.get(id)).filter((p): p is Product => !!p);
              return (
                <button key={trend.id} className={`trending-card ${index === active ? "active" : ""}`} onClick={() => setActive(index)}>
                  <span className="trend-index">{(index + 1).toLocaleString("fa-IR")}</span>
                  <h3>{trend.title}</h3>
                  {trend.subtitle && <p>{trend.subtitle}</p>}
                  <div className="trend-products">
                    {items.slice(0, 3).map(p => <img key={p.id} src={p.image} alt={p.name} width="64" height="64" loading="lazy" />)}
                  </div>
                  <span className="trending-card-count">{items.length.toLocaleString("fa-IR")} محصول</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================================================
 *  ۲) فهرست راهنمای استایل
 * ============================================================ */
export function GuideIndex({ guides, products }: { guides: Guide[]; products: Product[] }) {
  const [topic, setTopic] = useState<GuideTopic | "all">("all");
  const visible = guides.filter(guide => topic === "all" || guide.topic === topic);
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  return (
    <div className="guide-page">
      <header className="page-hero">
        <div className="container">
          <span className="eyebrow">STYLE GUIDE</span>
          <h1>راهنمای استایل کیا</h1>
          <p>از اندازه‌گیری کمربند تا لایه‌لایه کردن زیورآلات؛ راهنماهای کوتاه و کاربردی که انتخاب را ساده می‌کنند.</p>
        </div>
      </header>

      <div className="container guide-body">
        <nav className="guide-topics" aria-label="موضوعات راهنما">
          <button className={topic === "all" ? "active" : ""} onClick={() => setTopic("all")}>همهٔ راهنماها</button>
          {guideTopics.map(item => {
            const count = guides.filter(guide => guide.topic === item.id).length;
            if (!count) return null;
            return (
              <button key={item.id} className={topic === item.id ? "active" : ""} onClick={() => setTopic(item.id)}>
                {item.title}<span>{count.toLocaleString("fa-IR")}</span>
              </button>
            );
          })}
        </nav>

        {visible.length ? (
          <div className="guide-grid">
            {visible.map(guide => {
              const meta = topicMeta(guide.topic);
              const items = guide.productIds.map(id => byId.get(id)).filter((p): p is Product => !!p);
              return (
                <article className="guide-card" key={guide.id}>
                  <Link href={`/guide/${guide.slug}`} className="guide-card-image">
                    <img src={guide.image} alt={guide.title} width="400" height="260" loading="lazy" />
                    <span className="guide-card-topic">{meta.en}</span>
                  </Link>
                  <div className="guide-card-body">
                    {guide.kicker && <span className="eyebrow">{guide.kicker}</span>}
                    <h3><Link href={`/guide/${guide.slug}`}>{guide.title}</Link></h3>
                    <p>{guide.excerpt}</p>
                    <div className="guide-card-meta">
                      <span><Clock size={13} />{guide.readMinutes.toLocaleString("fa-IR")} دقیقه</span>
                      {items.length > 0 && <span className="guide-card-shop"><ShoppingBag size={13} />{items.length.toLocaleString("fa-IR")} محصول</span>}
                    </div>
                    <Link className="guide-card-link" href={`/guide/${guide.slug}`}>راهنما را بخوان<ArrowLeft size={15} /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="guide-empty">
            <GraduationCap size={40} />
            <h2>راهنمایی در این موضوع نیست</h2>
            <p>موضوع دیگری را انتخاب کن یا فروشگاه را ببین.</p>
          </div>
        )}

        <div className="guide-cross-links">
          <Link className="button button-outline" href="/trending"><Flame size={16} />ترندهای این فصل</Link>
          <Link className="button button-outline" href="/collections"><LayoutGrid size={16} />کالکشن‌ها</Link>
          <Link className="button button-outline" href="/shop"><ShoppingBag size={16} />فروشگاه</Link>
          <Link className="button button-outline" href="/daily"><Sparkles size={16} />مجلهٔ مد</Link>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  ۳) صفحهٔ راهنما
 * ============================================================ */
export function GuideView({ guide, products, related }: { guide: Guide; products: Product[]; related: Guide[] }) {
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const blocks = useMemo(() => parseGuideBody(guide.body), [guide.body]);
  const steps = useMemo(() => guideSteps(blocks), [blocks]);
  const meta = topicMeta(guide.topic);
  const shopProducts = guide.productIds.map(id => byId.get(id)).filter((p): p is Product => !!p);
  let stepIndex = 0;

  return (
    <div className="guide-view">
      <div className="container">
        <nav className="guide-breadcrumb" aria-label="مسیر صفحه">
          <Link href="/">خانه</Link><i /><Link href="/guide">راهنمای استایل</Link><i /><span>{meta.title}</span>
        </nav>

        <header className="guide-view-header">
          <span className="guide-view-topic">{meta.en}</span>
          {guide.kicker && <span className="eyebrow">{guide.kicker}</span>}
          <h1>{guide.title}</h1>
          <div className="guide-view-meta">
            <span><PenLine size={14} />{guide.author}</span>
            <span><Clock size={14} />{guide.readMinutes.toLocaleString("fa-IR")} دقیقه مطالعه</span>
            <span>{steps.length.toLocaleString("fa-IR")} مرحله</span>
          </div>
        </header>

        <div className="guide-view-layout">
          <div className="guide-view-content">
            <img className="guide-view-hero" src={guide.image} alt={guide.title} width="900" height="480" />
            {guide.excerpt && <p className="guide-view-lead">{guide.excerpt}</p>}

            {blocks.map((block, index) => {
              if (block.kind === "subhead") {
                stepIndex += 1;
                return <h2 key={index} id={`step-${stepIndex}`} className="guide-view-subhead"><span className="guide-step-number">{stepIndex.toLocaleString("fa-IR")}</span>{block.text}</h2>;
              }
              if (block.kind === "quote") return <blockquote key={index} className="guide-view-quote">{block.text}</blockquote>;
              if (block.kind === "list") return <ul key={index} className="guide-view-list">{block.items.map((item, i) => <li key={i}><Check size={15} />{item}</li>)}</ul>;
              if (block.kind === "product") {
                const product = byId.get(block.productId);
                if (!product) return null;
                return <GuideProductCard key={index} product={product} label={block.label} />;
              }
              return <p key={index} className="guide-view-paragraph">{block.text}</p>;
            })}

            {shopProducts.length > 0 && (
              <section className="guide-view-shop" aria-label="محصولات این راهنما">
                <div className="section-heading">
                  <div><span className="eyebrow">SHOP THE GUIDE</span><h2><i />محصولات این راهنما</h2></div>
                </div>
                <div className="guide-shop-grid">
                  {shopProducts.map(product => <GuideProductCard key={product.id} product={product} />)}
                </div>
              </section>
            )}

            <div className="guide-view-cta">
              <InvertedCorner size={44} className="guide-cta-corner" />
              <div>
                <h3>راهنمای دیگری می‌خواهی؟</h3>
                <p>همهٔ راهنماهای استایل کیا یک کلیک دورترند.</p>
              </div>
              <Link className="button button-lime" href="/guide">همهٔ راهنماها<ArrowLeft size={17} /></Link>
            </div>
          </div>

          <aside className="guide-view-side" aria-label="راهنماهای مرتبط">
            {related.length > 0 && (
              <div className="guide-view-related">
                <h3>راهنماهای مرتبط</h3>
                {related.map(item => (
                  <Link key={item.id} href={`/guide/${item.slug}`} className="guide-related-item">
                    <img src={item.image} alt={item.title} width="80" height="80" loading="lazy" />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{topicMeta(item.topic).title}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="guide-view-side-cta">
              <h3>سایز کمربندت را نمی‌دانی؟</h3>
              <p>در صفحهٔ محصول، راهنمای سایز با اندازه‌گیری دور کمر کمکت می‌کند.</p>
              <Link className="button button-outline button-sm" href="/shop?category=belts">کمربندها را ببین<ArrowLeft size={14} /></Link>
            </div>
            <div className="guide-view-side-cta">
              <h3>ترندهای این فصل</h3>
              <p>ببین این روزها چه چیزی داغ است.</p>
              <Link className="button button-outline button-sm" href="/trending"><Flame size={14} />ترندینگ</Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  ۴) فهرست کالکشن‌ها
 * ============================================================ */
export function CollectionsIndex({ collections, products }: { collections: Collection[]; products: Product[] }) {
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const featured = collections.filter(collection => collection.featured);
  const rest = collections.filter(collection => !collection.featured);

  return (
    <div className="collections-page">
      <header className="page-hero">
        <div className="container">
          <span className="eyebrow">COLLECTIONS</span>
          <h1>کالکشن‌های کیا</h1>
          <p>هر کالکشن یک داستان استایل است؛ از پاییز گرم تا مشکیِ مات.</p>
        </div>
      </header>

      <div className="container collections-body">
        {featured.length > 0 && (
          <section className="collections-featured" aria-label="کالکشن‌های ویژه">
            {featured.map(collection => {
              const items = collection.productIds.map(id => byId.get(id)).filter((p): p is Product => !!p);
              return (
                <article className="collection-card wide" key={collection.id} style={{ "--card-color": collection.colorHex } as React.CSSProperties}>
                  <Link href={`/collections/${collection.slug}`} className="collection-card-image">
                    <img src={collection.image} alt={collection.name} width="640" height="440" loading="lazy" />
                    {collection.badge && <span className="collection-badge">{collection.badge}</span>}
                    <span className="collection-card-label">{collection.label}</span>
                  </Link>
                  <div className="collection-card-body">
                    <h3><Link href={`/collections/${collection.slug}`}>{collection.name}</Link></h3>
                    <p>{collection.subtitle}</p>
                    <div className="collection-card-products">
                      {items.slice(0, 4).map(p => <Link key={p.id} href={`/product/${p.slug}`}><img src={p.image} alt={p.name} width="56" height="56" /></Link>)}
                    </div>
                    <Link className="button button-lime button-sm" href={`/collections/${collection.slug}`}>مشاهدهٔ کالکشن<ArrowLeft size={15} /></Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {rest.length > 0 && (
          <section className="collections-rest" aria-label="بقیهٔ کالکشن‌ها">
            <div className="section-heading">
              <div><span className="eyebrow">MORE COLLECTIONS</span><h2><i />بقیهٔ کالکشن‌ها</h2></div>
            </div>
            <div className="collections-grid">
              {rest.map(collection => {
                const items = collection.productIds.map(id => byId.get(id)).filter((p): p is Product => !!p);
                return (
                  <article className="collection-card" key={collection.id} style={{ "--card-color": collection.colorHex } as React.CSSProperties}>
                    <Link href={`/collections/${collection.slug}`} className="collection-card-image">
                      <img src={collection.image} alt={collection.name} width="400" height="280" loading="lazy" />
                      <span className="collection-card-label">{collection.label}</span>
                    </Link>
                    <div className="collection-card-body">
                      <h3><Link href={`/collections/${collection.slug}`}>{collection.name}</Link></h3>
                      <p>{collection.subtitle}</p>
                      <span className="collection-card-count">{items.length.toLocaleString("fa-IR")} محصول</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!collections.length && (
          <div className="guide-empty">
            <Layers size={40} />
            <h2>کالکشنی ساخته نشده</h2>
            <p>به‌زودی کالکشن‌های تازه اینجا دیده می‌شوند.</p>
          </div>
        )}

        <div className="guide-cross-links">
          <Link className="button button-outline" href="/trending"><Flame size={16} />ترندهای این فصل</Link>
          <Link className="button button-outline" href="/guide"><GraduationCap size={16} />راهنمای استایل</Link>
          <Link className="button button-outline" href="/shop"><ShoppingBag size={16} />فروشگاه</Link>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  ۵) لندینگ کالکشن
 * ============================================================ */
export function CollectionLanding({ collection, products, related }: { collection: Collection; products: Product[]; related: Collection[] }) {
  const total = products.reduce((sum, product) => sum + product.price, 0);
  const cheapest = products.length ? Math.min(...products.map(p => p.price)) : 0;

  return (
    <div className="collection-page" style={{ "--collection-color": collection.colorHex } as React.CSSProperties}>
      <header className="collection-hero">
        <div className="container">
          <nav className="guide-breadcrumb" aria-label="مسیر صفحه">
            <Link href="/">خانه</Link><i /><Link href="/collections">کالکشن‌ها</Link><i /><span>{collection.name}</span>
          </nav>
          <div className="collection-hero-grid">
            <div className="collection-hero-body">
              {collection.badge && <span className="collection-badge">{collection.badge}</span>}
              <span className="eyebrow">{collection.label}</span>
              <h1>{collection.name}</h1>
              {collection.subtitle && <p className="collection-hero-sub">{collection.subtitle}</p>}
              {collection.description && <p className="collection-hero-desc">{collection.description}</p>}
              <div className="collection-hero-stats">
                <span><strong>{products.length.toLocaleString("fa-IR")}</strong>محصول</span>
                <span>شروع از <strong>{money(cheapest)}</strong> تومان</span>
              </div>
              <div className="collection-hero-actions">
                <a className="button button-lime" href="#collection-products">مشاهدهٔ محصولات<ArrowLeft size={17} /></a>
                <Link className="button button-outline" href="/shop">فروشگاه<ArrowUpLeft size={16} /></Link>
              </div>
            </div>
            <div className="collection-hero-image">
              <img src={collection.image} alt={collection.name} width="560" height="460" />
            </div>
          </div>
        </div>
      </header>

      <div className="container collection-body">
        <section className="collection-products" id="collection-products" aria-label={`محصولات کالکشن ${collection.name}`}>
          <div className="section-heading">
            <div><span className="eyebrow">IN THIS COLLECTION</span><h2><i />محصولات این کالکشن</h2></div>
            <span className="muted">{products.length.toLocaleString("fa-IR")} محصول · جمع {money(total)} تومان</span>
          </div>
          {products.length ? (
            <div className="product-grid">
              {products.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <p className="muted">هنوز محصولی به این کالکشن متصل نشده است.</p>
          )}
        </section>

        {related.length > 0 && (
          <section className="collection-related" aria-label="کالکشن‌های مرتبط">
            <div className="section-heading">
              <div><span className="eyebrow">MORE LIKE THIS</span><h2><i />کالکشن‌های مرتبط</h2></div>
              <Link className="text-link" href="/collections">همهٔ کالکشن‌ها<ArrowUpLeft size={17} /></Link>
            </div>
            <div className="collections-grid">
              {related.map(item => (
                <article className="collection-card" key={item.id} style={{ "--card-color": item.colorHex } as React.CSSProperties}>
                  <Link href={`/collections/${item.slug}`} className="collection-card-image">
                    <img src={item.image} alt={item.name} width="400" height="280" loading="lazy" />
                    <span className="collection-card-label">{item.label}</span>
                  </Link>
                  <div className="collection-card-body">
                    <h3><Link href={`/collections/${item.slug}`}>{item.name}</Link></h3>
                    <p>{item.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="guide-cross-links">
          <Link className="button button-outline" href="/guide"><GraduationCap size={16} />راهنمای استایل</Link>
          <Link className="button button-outline" href="/trending"><Flame size={16} />ترندهای این فصل</Link>
          <Link className="button button-outline" href="/daily"><Sparkles size={16} />مجلهٔ مد</Link>
        </div>
      </div>
    </div>
  );
}
