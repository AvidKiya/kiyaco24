"use client";
import { Fragment, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, ChevronLeft, ChevronRight, Truck, ShieldCheck, RefreshCcw, Headphones, Sparkles, Plus, Gift, SlidersHorizontal, X, Search, Check, Package, Gem } from "lucide-react";
import { type Product, type ShopSettings, categories, categoryName, money, discountPercent } from "@/lib/catalog";
import type { StorefrontExtras } from "@/lib/storefront-data";
import { builtinSections, type HomeSection } from "@/lib/storefront-types";
import { StoreShell, Newsletter } from "./store-shell";
import { SectionTitle, CategoryArt, Modal, EmptyState } from "./ui";
import { ProductCard, ProductDetails } from "./product";
import { TrackOrder } from "./track-order";
import { BeltSizeCalculator, ProductReviews, ProductQuestions, RecentlyViewed } from "./product-feedback";
import { useCompare, CompareBar, CompareModal } from "./compare";
import { Scale } from "lucide-react";
import { TrendingToday, NewDrop, FlashSale, ShopTheLook, CustomSection } from "./home-sections";
import { SmartSizeAdvisor, SmartSetSection } from "./ai-stylist";

type StorefrontProps = { products: Product[]; settings: ShopSettings; extras?: StorefrontExtras; mode?: "home" | "catalog" | "product" | "track"; product?: Product; category?: string; query?: string; sort?: string; sale?: boolean; orderCode?: string };
export default function Storefront(props: StorefrontProps) {
  const { products, settings, mode = "home" } = props;
  const [quickView, setQuickView] = useState<Product | null>(null);
  return <StoreShell products={products} settings={settings}>
    {mode === "home" && <Home products={products} settings={settings} extras={props.extras} quickView={setQuickView} />}
    {mode === "catalog" && <Catalog products={products} initialCategory={props.category} initialQuery={props.query} initialSort={props.sort} initialSale={props.sale} quickView={setQuickView} />}
    {mode === "product" && props.product && <div className="container product-page"><div className="breadcrumbs"><Link href="/">خانه</Link><ChevronLeft size={13} /><Link href="/shop">فروشگاه</Link><ChevronLeft size={13} /><Link href={`/shop?category=${props.product.category}`}>{categoryName(props.product.category)}</Link><ChevronLeft size={13} /><span>{props.product.name}</span></div><ProductDetails key={props.product.id} product={props.product} /><section className="product-specifications"><h2>همه‌چیز دربارهٔ این انتخاب</h2><div><details open><summary>معرفی محصول <Plus size={17} /></summary><p>{props.product.description}</p></details><details><summary>مشخصات و نگه‌داری <Plus size={17} /></summary><p>جنس: {props.product.material}<br />رنگ‌ها: {props.product.colors.map(c => c.name).join("، ")}<br />برای ماندگاری بیشتر، از تماس مستقیم با عطر، الکل، مواد شوینده و رطوبت طولانی دور نگه دارید. با پارچهٔ نرم و خشک تمیز کنید و در جعبه یا کیسهٔ جداگانه نگه دارید.</p></details><details><summary>ارسال و بازگشت <Plus size={17} /></summary><p>ارسال پس از تأیید فروشگاه هماهنگ می‌شود. خریدهای بالای {money(settings.shippingThreshold)} تومان ارسال رایگان دارند. برای بررسی بازگشت کالا تا ۷ روز پس از تحویل با پشتیبانی تماس بگیرید. شرایط کامل در پایین سایت در دسترس است.</p></details></div></section>{props.product.category === "belts" && <BeltSizeCalculator product={props.product} />}{["necklaces", "bracelets", "rings"].includes(props.product.category) && <SmartSizeAdvisor key={`size-${props.product.id}`} product={props.product} />}
      <ProductReviews product={props.product} reviews={props.extras?.reviewsByProduct[props.product.id] ?? []} />
      <ProductQuestions product={props.product} questions={props.extras?.questionsByProduct[props.product.id] ?? []} />
      <SmartSetSection key={`set-${props.product.id}`} product={props.product} products={products} quickView={setQuickView} />
      <RecentlyViewed current={props.product} /></div>}
    {mode === "track" && <div className="container track-page"><div className="breadcrumbs"><Link href="/">خانه</Link><ChevronLeft size={13} /><span>پیگیری سفارش</span></div><div className="track-page-card"><span className="eyebrow">WITH YOU, EVERY STEP</span><h1>سفارشت کجاست؟</h1><TrackOrder initialCode={props.orderCode} /></div></div>}
    {quickView && <Modal title="یک نگاه نزدیک‌تر" wide onClose={() => setQuickView(null)}><ProductDetails key={quickView.id} product={quickView} compact onAdded={() => setQuickView(null)} /></Modal>}
  </StoreShell>;
}

const slides = [
  { eyebrow: "کالکشن جدید کیا", line1: "استایل تو،", line2: "امضای تو.", description: "کمربند و اکسسوری‌هایی که فقط یک جزئیات نیستن؛\nبخشی از شخصیت تو هستن.", image: "/images/hero-belt.webp", href: "/shop", cta: "کالکشن رو ببین", en: "THE SIGNATURE COLLECTION" },
  { eyebrow: "انتخاب خاص‌پسندها", line1: "جزئیات کمتر،", line2: "تأثیر بیشتر.", description: "ساده، ماندگار و درست شبیه تو؛\nاکسسوری‌هایی برای هر روز، نه فقط یک روز.", image: "/images/hero-jewelry.webp", href: "/shop?category=accessories", cta: "اکسسوری‌ها رو ببین", en: "THE EVERYDAY EDIT" },
  { eyebrow: "یک هدیه، هزار حرف", line1: "برای کسی که", line2: "خاصه برات.", description: "یه انتخاب کوچیک، با کلی حس خوب؛\nهدیه‌هایی که از یاد نمی‌رن.", image: "/images/hero-belt.webp", href: "/shop?category=sets", cta: "هدیه‌ات رو پیدا کن", en: "A LITTLE SOMETHING SPECIAL" },
];
const mobileSrc = (slide: { mobileImage?: string }) => slide.mobileImage || "";
function Home({ products, settings, extras, quickView }: { products: Product[]; settings: ShopSettings; extras?: StorefrontExtras; quickView: (p: Product) => void }) {
  const [slideIndex, setSlideIndex] = useState(0);
  // اسلایدهای بنر از پنل مدیریت می‌آیند؛ اگر خالی بود، پیش‌فرض داخلی استفاده می‌شود
  // بنر اصلی همیشه از تنظیمات پنل می‌آید؛ اسلایدهای ساخته‌شدهٔ مدیر بعد از آن نمایش داده می‌شوند.
  const settingsHero = { eyebrow: "کالکشن جدید کیا", line1: settings.heroTitle, line2: settings.heroAccent, description: settings.heroDescription, image: settings.heroImage, cta: settings.heroButton, href: settings.heroLink, en: "THE SIGNATURE COLLECTION", mobileImage: "" };
  const adminSlides = (extras?.slides ?? []).map(s => ({ eyebrow: s.eyebrow, line1: s.title, line2: s.accent, description: s.description, image: s.image, href: s.link, cta: s.button, en: s.label, mobileImage: s.mobileImage || "" }));
  const heroSlides = (adminSlides.length ? [settingsHero, ...adminSlides] : slides).map(item => ({ mobileImage: "", ...item }));
  const slide = heroSlides[slideIndex] ?? heroSlides[0];
  const [tab, setTab] = useState("featured"); const [offset, setOffset] = useState(0);
  const [article, setArticle] = useState(false);
  const pool = tab === "sale" ? products.filter(p => p.compareAt && p.compareAt > p.price) : tab === "newest" ? [...products].reverse() : [...products].sort((a, b) => Number(b.featured) - Number(a.featured));
  const shown = Array.from({ length: Math.min(4, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);
  // فاز ۱۳: Homepage Builder — ترتیب و فعال‌بودن سکشن‌ها از پنل می‌آید
  const sectionList: HomeSection[] = extras?.homeSections?.length
    ? extras.homeSections
    : builtinSections.map((section, index) => ({ id: -index - 1, key: section.key, title: "", subtitle: "", layout: "banner", config: {}, position: index, active: true }));
  const renderSection = (s: HomeSection) => {
    switch (s.key) {
      case "hero": return <>
    <section className="hero-grid" aria-label="کالکشن‌های کیا"><div className={`hero-main hero-slide-${slideIndex}`}><picture>{mobileSrc(slide) && <source media="(max-width: 720px)" srcSet={mobileSrc(slide)} />}<img className="hero-image" src={slide.image} alt="استایل مینیمال با کمربند چرم مشکی و سگک نقره‌ای کیا" width="1400" height="934" fetchPriority="high" /></picture><div className="hero-shade" /><span className="hero-edition" dir="ltr">{slide.en}<span>VOL. 01 — 2026</span></span><div className="hero-copy" key={slideIndex}><span className="hero-eyebrow"><span />{slide.eyebrow}</span><h1>{slide.line1}<br /><em>{slide.line2}</em></h1><p>{slide.description}</p><Link className="button button-lime hero-cta" href={slide.href}>{slide.cta}<ArrowUpLeft size={21} /></Link><div className="hero-footnote"><span />جزئیات کوچیک، تفاوت‌های بزرگ.</div></div><Link className="hero-product-pin" href="/product/classic-leather-belt" aria-label="مشاهده کمربند کالکشن"><Plus size={18} /></Link><div className="hero-controls"><button aria-label="بنر قبلی" onClick={() => setSlideIndex((slideIndex + heroSlides.length - 1) % heroSlides.length)}><ChevronRight size={17} /></button><div className="slider-dots">{heroSlides.map((_, index) => <button key={index} aria-label={`نمایش بنر ${index + 1}`} aria-pressed={slideIndex === index} className={slideIndex === index ? "selected" : ""} onClick={() => setSlideIndex(index)} />)}</div><button aria-label="بنر بعدی" onClick={() => setSlideIndex((slideIndex + 1) % heroSlides.length)}><ChevronLeft size={17} /></button></div></div>
      <div className="hero-side"><img src="/images/hero-jewelry.webp" alt="انگشتر، دستبند و گردنبند نقره‌ای روی سنگ تیره" width="700" height="934" fetchPriority="high" /><div className="side-shade" /><div className="side-top"><span className="small-label" dir="ltr">LESS, BUT BETTER</span><h2>کمتر،<br />{" "}اما <span>خاص‌تر.</span></h2></div><div className="side-caption"><span className="eyebrow">جزئیاتی برای درخشیدن</span><Link href="/shop?category=accessories">دنیای اکسسوری کیا<ArrowUpLeft size={17} /></Link></div><div className="side-corner"><Link href="/shop?category=accessories" aria-label="مشاهده کالکشن اکسسوری"><ArrowUpLeft size={25} /></Link></div></div>
    </section>
    </>;
      case "trust": return <>
    <section className="trust-strip" aria-label="مزایای خرید از کیا">{[{ icon: Truck, title: "ارسال به سراسر ایران", sub: "بسته‌بندی امن، تحویل مطمئن" }, { icon: RefreshCcw, title: "۷ روز فرصت بازگشت", sub: "یک انتخاب، با خیال راحت" }, { icon: ShieldCheck, title: "کیفیت در تمام جزئیات", sub: "انتخاب‌شده با دقت و وسواس" }, { icon: Headphones, title: "پشتیبانی همراه تو", sub: "قبل و بعد از خرید، کنارتیم" }].map((item, i) => <div key={i}><span className="trust-icon"><item.icon size={28} strokeWidth={1.4} /></span><span><h3>{item.title}</h3><p>{item.sub}</p></span></div>)}</section>
    </>;
      case "categories": return <>
    <section className="categories-section"><SectionTitle title="دنبال چه جزئیاتی می‌گردی؟" href="/shop" linkText="همهٔ دسته‌بندی‌ها" /><div className="category-grid">{categories.map(c => <Link href={`/shop?category=${c.id}`} className="category-card" key={c.id}><div className="category-art"><CategoryArt category={c.id} /></div><div><h3>{c.name}</h3><span dir="ltr">{c.en}</span></div><ArrowUpLeft className="category-arrow" size={17} /></Link>)}</div></section>
    </>;
      case "trending": return <>
    <TrendingToday trends={extras?.trends ?? []} products={products} />
    </>;
      case "featured": return <>
    <section className="featured-section"><div className="section-heading"><div><span className="eyebrow">HANDPICKED FOR YOU</span><h2><i />انتخاب‌های دوست‌داشتنی</h2></div><div className="product-tabs">{[{ id: "featured", name: "منتخب‌های کیا" }, { id: "newest", name: "جدیدترین‌ها" }, { id: "sale", name: "تخفیف‌دارها" }].map(t => <button key={t.id} className={tab === t.id ? "active" : ""} aria-pressed={tab === t.id} onClick={() => { setTab(t.id); setOffset(0); }}>{t.name}</button>)}</div><div className="section-controls"><Link className="text-link" href="/shop">همهٔ محصولات<ArrowLeft size={16} /></Link><span className="carousel-arrows"><button aria-label="محصولات قبلی" disabled={pool.length <= 4} onClick={() => setOffset((offset + pool.length - 1) % pool.length)}><ChevronRight size={17} /></button><button aria-label="محصولات بعدی" disabled={pool.length <= 4} onClick={() => setOffset((offset + 1) % pool.length)}><ChevronLeft size={17} /></button></span></div></div><div className="product-grid">{shown.map(p => <ProductCard key={p.id} product={p} onQuickView={quickView} />)}</div>{!shown.length && <EmptyState icon={<Package size={32} />} title="به‌زودی انتخاب‌های تازه می‌رسن" text="فعلاً محصولی در این بخش نیست. سری به بقیهٔ دسته‌ها بزن." />}</section>
    </>;
      case "flash": return <>
    <FlashSale flash={extras?.flash ?? null} products={products} serverNow={extras?.serverNow ?? Date.now()} />
    </>;
      case "editorial": return <>
    <section className="editorial-grid"><div className="style-banner"><img src="/images/hero-belt.webp" alt="جزئیات استایل با کمربند کیا" width="700" height="400" loading="lazy" /><div><span className="eyebrow">MAKE IT YOURS</span><h2>یه کمربند خوب،<br />همه‌چیز رو عوض می‌کنه.</h2><p>ساده، خوش‌ساخت و همیشه همراه استایل تو.</p><Link className="button button-outline" href="/shop?category=belts">کمربندهای کیا<ArrowUpLeft size={18} /></Link></div></div><div className="gift-banner"><Gift className="gift-watermark" size={185} strokeWidth={.75} /><span className="eyebrow">SMALL GIFT. BIG FEELING.</span><h2>برای آدم‌های خاص،<br />یه انتخاب خاص.</h2><p>خوشحال‌کردن، از جزئیات شروع می‌شه.</p><Link href="/shop?category=sets">هدیه‌ات رو اینجا پیدا کن<ArrowUpLeft size={22} /></Link></div></section>
    </>;
      case "newdrop": return <>
    <NewDrop products={products} />
    </>;
      case "looks": return <>
    <ShopTheLook looks={extras?.looks ?? []} products={products} />
    </>;
      case "stylenote": return <>
    <section className="style-note"><div><span className="style-note-icon"><Gem size={25} /></span><div><h3>چطور اکسسوری‌هامون رو همیشه نو نگه داریم؟</h3><p>چند نکتهٔ ساده، برای جزئیاتی که دوستشون داری.</p></div></div><button className="text-link" onClick={() => setArticle(true)}>راهنمای نگه‌داری<ArrowLeft size={17} /></button></section>
    </>;
      case "newsletter": return <>
    <Newsletter />
    </>;
      default: return <CustomSection section={s} products={products} quickView={quickView} />;
    }
  };
  return <div className="container home-page">
    {sectionList.map(s => <Fragment key={s.id}>{renderSection(s)}</Fragment>)}
    {article && <Modal title="جزئیاتت رو ماندگار کن" onClose={() => setArticle(false)}><div className="prose"><h3>۵ عادت کوچک برای ماندگاری بیشتر</h3><ol><li><strong>آخرین جزئیات استایلت:</strong> عطر و اسپری را قبل از پوشیدن اکسسوری استفاده کن و صبر کن تا خشک شوند.</li><li><strong>دور از آب و رطوبت:</strong> برای حمام، استخر و ورزش، زیورآلات و کمربند چرم را کنار بگذار.</li><li><strong>یک جای مخصوص:</strong> هر اکسسوری را جدا در کیسهٔ نرم نگه دار تا خط‌وخش نیفتد.</li><li><strong>تمیزکاری ملایم:</strong> یک دستمال نرم و خشک کافی است. از الکل و پاک‌کننده‌های قوی استفاده نکن.</li><li><strong>چرم هم مراقبت می‌خواهد:</strong> کمربند را بدون تاخوردگی تند آویزان کن و از گرمای مستقیم و آفتاب دور نگه دار.</li></ol></div></Modal>}
  </div>;
}

function Catalog({ products, initialCategory = "all", initialQuery = "", initialSort = "featured", initialSale = false, quickView }: { products: Product[]; initialCategory?: string; initialQuery?: string; initialSort?: string; initialSale?: boolean; quickView: (p: Product) => void }) {
  const [category, setCategory] = useState(initialCategory); const [query, setQuery] = useState(initialQuery); const [sort, setSort] = useState(initialSort); const [sale, setSale] = useState(initialSale); const [inStock, setInStock] = useState(false);
  const [colors, setColors] = useState<string[]>([]); const [sizes, setSizes] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const compare = useCompare();
  const maximum = Math.max(1500000, ...products.map(p => p.price));
  const [maxPrice, setMaxPrice] = useState(maximum); const [mobileFilters, setMobileFilters] = useState(false);
  // فهرست رنگ‌ها و سایزهای موجود در کاتالوگ (برای فیلتر)
  const allColors = [...new Map(products.flatMap(p => p.colors).map(c => [c.name, c])).values()];
  const allSizes = [...new Set(products.flatMap(p => p.sizes))].sort((a, b) => Number(a) - Number(b));
  const toggleIn = (list: string[], value: string, setList: (next: string[]) => void) => setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  useEffect(() => { setCategory(initialCategory); setQuery(initialQuery); setSort(initialSort); setSale(initialSale); }, [initialCategory, initialQuery, initialSort, initialSale]);
  const normalize = (text: string) => text.replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
  const filtered = products.filter(p => (category === "all" || (category === "accessories" ? p.category !== "belts" : p.category === category)) && (!query || normalize(`${p.name} ${p.description}`).includes(normalize(query))) && (!sale || (p.compareAt && p.compareAt > p.price)) && (!inStock || p.stock > 0) && p.price <= maxPrice && (!colors.length || p.colors.some(c => colors.includes(c.name))) && (!sizes.length || p.sizes.some(size => sizes.includes(size)))).sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "newest" ? b.id - a.id : sort === "discount" ? discountPercent(b) - discountPercent(a) : Number(b.featured) - Number(a.featured));
  function reset() { setCategory("all"); setQuery(""); setSale(false); setInStock(false); setMaxPrice(maximum); setColors([]); setSizes([]); }
  return <div className="container catalog-page"><div className="breadcrumbs"><Link href="/">خانه</Link><ChevronLeft size={13} /><span>فروشگاه</span>{category !== "all" && <><ChevronLeft size={13} /><span>{category === "accessories" ? "اکسسوری" : categoryName(category)}</span></>}</div><div className="catalog-title"><span className="eyebrow">FIND YOUR SIGNATURE</span><h1>{query ? `نتایج جستجوی «${query}»` : category === "all" ? "جزئیاتِ استایلِ تو" : category === "accessories" ? "دنیای اکسسوری کیا" : `${categoryName(category)}‌های کیا`}</h1><p>انتخاب‌های کوچک، برای ساختن یک استایل کاملاً شخصی.</p></div><div className="catalog-layout"><aside className={`catalog-filters ${mobileFilters ? "filters-open" : ""}`}><div className="filter-heading"><h2><SlidersHorizontal size={18} />فیلتر محصولات</h2><button onClick={reset}>حذف همه</button></div><fieldset><legend>دسته‌بندی‌ها</legend><label className="category-filter"><input type="radio" name="category" checked={category === "all"} onChange={() => setCategory("all")} /><span>همهٔ محصولات</span><small>{money(products.length)}</small></label>{categories.map(c => <label className="category-filter" key={c.id}><input type="radio" name="category" checked={category === c.id} onChange={() => setCategory(c.id)} /><span>{c.name}</span><small>{money(products.filter(p => p.category === c.id).length)}</small></label>)}</fieldset><fieldset><legend>محدودهٔ قیمت</legend><label className="range-label" htmlFor="max-price">تا {money(maxPrice)} تومان</label><input id="max-price" className="price-range" type="range" min="0" max={maximum} step="1" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} /><div className="range-captions"><span>۰ تومان</span><span>{money(maximum)}</span></div></fieldset><fieldset className="toggle-filters"><label><span>فقط محصولات موجود</span><input type="checkbox" role="switch" checked={inStock} onChange={e => setInStock(e.target.checked)} /></label><label><span>فقط تخفیف‌دارها</span><input type="checkbox" role="switch" checked={sale} onChange={e => setSale(e.target.checked)} /></label></fieldset>
        <fieldset><legend>رنگ</legend><div className="chip-filters">{allColors.map(color => <button key={color.name} type="button" className={colors.includes(color.name) ? "filter-chip selected" : "filter-chip"} aria-pressed={colors.includes(color.name)} onClick={() => toggleIn(colors, color.name, setColors)}><span className="chip-dot" style={{ background: color.hex }} />{color.name}</button>)}</div></fieldset>
        <fieldset><legend>سایز</legend><div className="chip-filters">{allSizes.map(size => <button key={size} type="button" className={sizes.includes(size) ? "filter-chip selected" : "filter-chip"} aria-pressed={sizes.includes(size)} onClick={() => toggleIn(sizes, size, setSizes)}>{size}</button>)}</div></fieldset><div className="filter-help"><Headphones size={25} /><strong>برای انتخاب نیاز به کمک داری؟</strong><p>از بخش تماس با ما پیام بذار؛ کنارتیم.</p></div></aside><section className="catalog-results"><div className="catalog-toolbar"><div><button className="mobile-filter-button button button-outline" onClick={() => setMobileFilters(!mobileFilters)}><SlidersHorizontal size={16} />فیلترها</button><span><b>{money(filtered.length)}</b> انتخاب برای تو</span></div><label>مرتب‌سازی:<select aria-label="مرتب‌سازی محصولات" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">منتخب‌های کیا</option><option value="newest">جدیدترین‌ها</option><option value="price-asc">ارزان‌ترین</option><option value="price-desc">گران‌ترین</option><option value="discount">بیشترین تخفیف</option></select></label></div>{(query || category !== "all" || sale) && <div className="active-filters">{query && <button onClick={() => setQuery("")}>{query}<X size={13} /></button>}{category !== "all" && <button onClick={() => setCategory("all")}>{category === "accessories" ? "اکسسوری" : categoryName(category)}<X size={13} /></button>}{sale && <button onClick={() => setSale(false)}>تخفیف‌دار<X size={13} /></button>}{colors.map(color => <button key={color} onClick={() => toggleIn(colors, color, setColors)}>{color}<X size={13} /></button>)}{sizes.map(size => <button key={size} onClick={() => toggleIn(sizes, size, setSizes)}>سایز {size}<X size={13} /></button>)}</div>}{filtered.length ? <div className="catalog-product-grid">{filtered.map(p => <div className="catalog-card-wrap" key={p.id}><ProductCard product={p} onQuickView={quickView} /><button className={compare.has(p.id) ? "compare-toggle selected" : "compare-toggle"} aria-pressed={compare.has(p.id)} aria-label={`${compare.has(p.id) ? "حذف" : "افزودن"} ${p.name} از مقایسه`} onClick={() => { if (compare.toggle(p.id) === "limit") setCompareOpen(true); }}><Scale size={15} />{compare.has(p.id) ? "در مقایسه" : "مقایسه"}</button></div>)}</div> : <EmptyState icon={<Search size={38} />} title="این‌بار چیزی پیدا نشد" text="یک دسته‌بندی یا محدودهٔ قیمت دیگه رو امتحان کن."><button className="button button-lime" onClick={reset}>نمایش همهٔ محصولات</button></EmptyState>}</section>
      <CompareBar items={compare.items} products={products} onOpen={() => setCompareOpen(true)} onClear={compare.clear} />
      {compareOpen && <CompareModal items={compare.items} products={products} onClose={() => setCompareOpen(false)} onRemove={compare.remove} />}</div></div>;
}
