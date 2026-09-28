"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, Clock, ShoppingBag, Sparkles, Newspaper, PenLine, Palette } from "lucide-react";
import { type Product, money, categoryName, discountPercent } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { InvertedCorner } from "./inverted-corner";
import { type Article, type ArticleSection, dailySections, parseArticleBody, sectionMeta, editionLabel, editionNumber } from "@/lib/daily-types";

/* ============================================================
 *  کارت محصول داخل مقاله — Content → Commerce
 * ============================================================ */
export function ArticleProductCard({ product, label }: { product: Product; label?: string }) {
  const { addItem, toast } = useShop();
  const off = discountPercent(product);
  return (
    <div className="daily-product-card">
      <Link href={`/product/${product.slug}`} className="daily-product-image">
        <img src={product.image} alt={product.name} width="120" height="120" loading="lazy" />
        {off > 0 && <span className="daily-product-off">{off.toLocaleString("fa-IR")}٪ تخفیف</span>}
      </Link>
      <div className="daily-product-body">
        <span className="daily-product-category">{categoryName(product.category)}</span>
        <Link href={`/product/${product.slug}`}><h4>{label || product.name}</h4></Link>
        <div className="daily-product-price">
          <strong>{money(product.price)} <small>تومان</small></strong>
          {product.compareAt && product.compareAt > product.price && <s>{money(product.compareAt)}</s>}
        </div>
        <div className="daily-product-actions">
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
 *  کارت خلاصهٔ مقاله
 * ============================================================ */
function ArticleCard({ article, compact }: { article: Article; compact?: boolean }) {
  const meta = sectionMeta(article.section);
  return (
    <article className={`daily-card ${compact ? "compact" : ""}`}>
      <Link href={`/daily/${article.slug}`} className="daily-card-image">
        <img src={article.image} alt={article.title} width="400" height="300" loading="lazy" />
        <span className="daily-card-section" style={{ "--card-color": article.colorHex } as React.CSSProperties}>{meta.en}</span>
      </Link>
      <div className="daily-card-body">
        {article.kicker && <span className="eyebrow">{article.kicker}</span>}
        <h3><Link href={`/daily/${article.slug}`}>{article.title}</Link></h3>
        {!compact && <p>{article.excerpt}</p>}
        <div className="daily-card-meta">
          <span><Clock size={13} />{article.readMinutes.toLocaleString("fa-IR")} دقیقه</span>
          <span><PenLine size={13} />{article.author}</span>
          {article.productIds.length > 0 && <span className="daily-card-shop"><ShoppingBag size={13} />{article.productIds.length.toLocaleString("fa-IR")} محصول</span>}
        </div>
      </div>
    </article>
  );
}

/* ============================================================
 *  صفحهٔ امروز — ساختار روزنامه‌وار
 * ============================================================ */
export function DailyEdition({ articles, products }: { articles: Article[]; products: Product[] }) {
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const [activeSection, setActiveSection] = useState<ArticleSection | "all">("all");

  const grouped = useMemo(() => {
    const map: Record<string, Article[]> = {};
    for (const article of articles) (map[article.section] ||= []).push(article);
    return map;
  }, [articles]);

  const mainStory = grouped["main-story"]?.[0] ?? articles[0];
  const otherSections = dailySections.filter(section => section.id !== "main-story");
  const latestEdition = articles[0]?.editionDate ?? new Date();

  const visibleSections = otherSections
    .map(section => ({ section, items: grouped[section.id] ?? [] }))
    .filter(entry => entry.items.length > 0 && (activeSection === "all" || entry.section.id === activeSection));

  const todayProducts = useMemo(() => {
    const ids = [...new Set(articles.flatMap(a => a.productIds))];
    return ids.map(id => byId.get(id)).filter((p): p is Product => !!p).slice(0, 8);
  }, [articles, byId]);

  return (
    <div className="daily-page">
      {/* سربرگ روزنامه */}
      <header className="daily-masthead">
        <div className="container">
          <div className="daily-masthead-top">
            <span className="daily-edition-no">شمارهٔ {editionNumber(latestEdition).toLocaleString("fa-IR")}</span>
            <span className="daily-edition-date">{editionLabel(latestEdition)}</span>
            <span className="daily-edition-tag"><Newspaper size={14} />TODAY&apos;S EDITION</span>
          </div>
          <h1 className="daily-title">FASHION <span>DAILY</span></h1>
          <p className="daily-tagline">روزنامهٔ دیجیتال کیا — هر روز یک گزارش از دنیای کمربند، اکسسوری و استایل</p>
          <nav className="daily-section-nav" aria-label="سکشن‌های روزنامه">
            <button className={activeSection === "all" ? "active" : ""} onClick={() => setActiveSection("all")}>همه</button>
            {dailySections.filter(s => grouped[s.id]?.length).map(section => (
              <button key={section.id} className={activeSection === section.id ? "active" : ""} onClick={() => setActiveSection(section.id)}>
                {section.title}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="container daily-body">
        {/* مطلب اصلی */}
        {mainStory && (
          <section className="daily-main" aria-label="مطلب اصلی روزنامه">
            <Link href={`/daily/${mainStory.slug}`} className="daily-main-image">
              <img src={mainStory.image} alt={mainStory.title} width="640" height="480" />
              <span className="daily-main-badge" style={{ "--card-color": mainStory.colorHex } as React.CSSProperties}>MAIN STORY</span>
            </Link>
            <div className="daily-main-body">
              <span className="eyebrow">{mainStory.kicker || sectionMeta("main-story").hint}</span>
              <h2><Link href={`/daily/${mainStory.slug}`}>{mainStory.title}</Link></h2>
              <p>{mainStory.excerpt}</p>
              <div className="daily-card-meta">
                <span><Clock size={13} />{mainStory.readMinutes.toLocaleString("fa-IR")} دقیقه مطالعه</span>
                <span><PenLine size={13} />{mainStory.author}</span>
              </div>
              <Link className="button button-lime" href={`/daily/${mainStory.slug}`}>مقاله را بخوان<ArrowLeft size={17} /></Link>
            </div>
          </section>
        )}

        {/* بقیهٔ سکشن‌ها */}
        {visibleSections.map(({ section, items }) => (
          <section className="daily-section" key={section.id} aria-label={section.title}>
            <div className="daily-section-head">
              <div>
                <span className="eyebrow" style={{ color: items[0].colorHex }}>{section.en}</span>
                <h2><i />{section.title}</h2>
                <p className="daily-section-hint">{section.hint}</p>
              </div>
            </div>
            <div className="daily-section-grid">
              {items.map(article => <ArticleCard key={article.id} article={article} />)}
            </div>
          </section>
        ))}

        {!articles.length && (
          <div className="daily-empty">
            <Sparkles size={40} />
            <h2>نسخهٔ امروز هنوز منتشر نشده</h2>
            <p>فردا صبح با گزارش تازه برمی‌گردیم. تا آن موقع می‌توانید فروشگاه را ببینید.</p>
            <Link className="button button-lime" href="/shop">بریم فروشگاه<ArrowLeft size={17} /></Link>
          </div>
        )}

        {/* محصولات امروز */}
        {todayProducts.length > 0 && (
          <section className="daily-today-products" aria-label="محصولات امروز">
            <div className="section-heading">
              <div><span className="eyebrow">TODAY&apos;S PICKS</span><h2><i />محصولات امروز</h2></div>
              <Link className="text-link" href="/shop">همهٔ محصولات<ArrowUpLeft size={17} /></Link>
            </div>
            <div className="daily-picks-grid">
              {todayProducts.map(product => <ArticleProductCard key={product.id} product={product} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 *  صفحهٔ مقاله
 * ============================================================ */
export function ArticleView({ article, products, related }: { article: Article; products: Product[]; related: Article[] }) {
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const blocks = useMemo(() => parseArticleBody(article.body), [article.body]);
  const meta = sectionMeta(article.section);
  const shopProducts = article.productIds.map(id => byId.get(id)).filter((p): p is Product => !!p);

  return (
    <div className="article-page">
      <div className="container">
        <nav className="article-breadcrumb" aria-label="مسیر صفحه">
          <Link href="/">خانه</Link><i /><Link href="/daily">Fashion Daily</Link><i /><span>{meta.title}</span>
        </nav>

        <header className="article-header">
          <span className="article-section-tag" style={{ "--card-color": article.colorHex } as React.CSSProperties}>{meta.en}</span>
          {article.kicker && <span className="eyebrow">{article.kicker}</span>}
          <h1>{article.title}</h1>
          <div className="article-meta">
            <span><PenLine size={14} />{article.author}</span>
            <span><Clock size={14} />{article.readMinutes.toLocaleString("fa-IR")} دقیقه مطالعه</span>
            <span>{editionLabel(article.editionDate)}</span>
          </div>
          {article.section === "color-of-day" && (
            <div className="article-color-strip" aria-label="رنگ روز">
              <span className="article-color-chip" style={{ background: article.colorHex }} />
              <div>
                <strong>رنگ امروز</strong>
                <p dir="ltr">{article.colorHex.toUpperCase()}</p>
              </div>
              <Palette size={22} />
            </div>
          )}
        </header>

        <div className="article-layout">
          <div className="article-content">
            <img className="article-hero-image" src={article.image} alt={article.title} width="900" height="520" />
            {article.excerpt && <p className="article-lead">{article.excerpt}</p>}

            {blocks.map((block, index) => {
              if (block.kind === "subhead") return <h2 key={index} className="article-subhead">{block.text}</h2>;
              if (block.kind === "quote") return <blockquote key={index} className="article-quote">{block.text}</blockquote>;
              if (block.kind === "product") {
                const product = byId.get(block.productId);
                if (!product) return null;
                return <ArticleProductCard key={index} product={product} label={block.label} />;
              }
              return <p key={index} className="article-paragraph">{block.text}</p>;
            })}

            {/* Content → Commerce */}
            {shopProducts.length > 0 && (
              <section className="article-shop" aria-label="خرید محصولات این مطلب">
                <div className="section-heading">
                  <div><span className="eyebrow" style={{ color: article.colorHex }}>{article.shopLabel}</span><h2><i />محصولات این مطلب</h2></div>
                </div>
                <div className="daily-picks-grid">
                  {shopProducts.map(product => <ArticleProductCard key={product.id} product={product} />)}
                </div>
              </section>
            )}

            <div className="article-footer-cta">
              <InvertedCorner size={44} className="article-cta-corner" />
              <div>
                <h3>این مطلب را دوست داشتی؟</h3>
                <p>هر روز صبح گزارش تازهٔ کیا را در Fashion Daily بخوان.</p>
              </div>
              <Link className="button button-lime" href="/daily">نسخهٔ امروز<ArrowLeft size={17} /></Link>
            </div>
          </div>

          <aside className="article-side" aria-label="مطالب مرتبط">
            {related.length > 0 && (
              <div className="article-related">
                <h3>همین‌جا بخوان</h3>
                {related.map(item => (
                  <Link key={item.id} href={`/daily/${item.slug}`} className="article-related-item">
                    <img src={item.image} alt={item.title} width="90" height="90" loading="lazy" />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{sectionMeta(item.section).title}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="article-side-cta">
              <h3>راهنمای سایز کمربند</h3>
              <p>نمی‌دانی چه سایزی مناسبته؟ در صفحهٔ محصول دور کمرت را حساب کن.</p>
              <Link className="button button-outline button-sm" href="/shop?category=belts">کمربندها را ببین<ArrowLeft size={14} /></Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
