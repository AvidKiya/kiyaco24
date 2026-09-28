"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpLeft, Check, Handshake, Layers, Package, Receipt, RotateCcw, ShoppingCart, Truck, Users, LogOut, KeyRound, Store, ClipboardList, TrendingUp, BadgePercent } from "lucide-react";
import { money } from "@/lib/catalog";
import type { Product } from "@/lib/catalog";
import type { PartnerOrderItem } from "@/db/schema";

/* ============================================================
 *  فاز ۶ — سیستم B2B عمده
 *  لندینگ همکاری · ورود همکار · پنل همکار (کاتالوگ، سبد سریع، سفارش‌ها، فاکتور)
 * ============================================================ */

export const partnerTierOrder = ["retail", "wholesale", "vip", "distributor", "special"] as const;
export type PartnerTier = { id: number; key: string; name: string; discountType: "percent" | "fixed"; discountValue: number; minOrder: number; description: string; active: boolean };

export function PartnerLanding({ products, tiers }: { products: Product[]; tiers: PartnerTier[] }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wantPassword, setWantPassword] = useState(true);
  const [password, setPassword] = useState("");
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const categories = [...new Set(products.map(product => product.category))].length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (wantPassword && String(payload.password || "").length < 8) { setError("رمز عبور باید حداقل ۸ کاراکتر باشد."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : "ثبت درخواست انجام نشد."); }
    finally { setLoading(false); }
  }

  return <div className="partner-page">
    <section className="partner-hero">
      <span className="eyebrow" dir="ltr">KIYA WHOLESALE PARTNERSHIP</span>
      <h1>با کیا،<br />شریک <span>فروش</span> شو.</h1>
      <p>اگر فروشگاه اکسسوری داری، Boutique مدیریت می‌کنی یا در حوزهٔ زیورآلات و کمربند فعالیت می‌کنی، برنامهٔ همکاری کیا را امتحان کن: قیمت لایه‌ای عمده، حداقل سفارش مشخص، سبد سفارش سریع و فاکتور رسمی برای هر خرید.</p>
      <div className="partner-hero-actions">
        <a className="button button-lime" href="#apply">درخواست همکاری<ArrowUpLeft size={19} /></a>
        <Link className="button button-outline" href="/partner/login">ورود همکاران<ArrowLeft size={19} /></Link>
      </div>
      <div className="partner-hero-stats">
        <div><strong>{money(products.length)}</strong><span>محصول فعال</span></div>
        <div><strong>{money(categories)}</strong><span>دستهٔ کالا</span></div>
        <div><strong>{money(totalStock)}</strong><span>قلم موجود در انبار</span></div>
        <div><strong>{money(tiers.filter(t => t.active).length)}</strong><span>لایهٔ قیمت همکار</span></div>
      </div>
    </section>

    <section className="partner-benefits">
      <div className="section-heading"><div><span className="eyebrow">WHY PARTNER WITH KIYA</span><h2><i />همکاری با کیا چه چیزی درمی‌آره؟</h2></div></div>
      <div className="partner-benefit-grid">
        {[
          { icon: BadgePercent, title: "قیمت لایه‌ای واقعی", text: "هر لایه درصد یا قیمت ثابت خودش را دارد؛ قیمت نهایی هر قلم در پنل همکار قبل از سفارش مشخص است." },
          { icon: Layers, title: "پنج لایهٔ همکاری", text: "از خرده‌فروشی تا توزیع‌کننده و همکار ویژه؛ لایه با رشد خرید شما ارتقا پیدا می‌کند." },
          { icon: ClipboardList, title: "سفارش عمدهٔ سریع", text: "جدول Product/Color/Size/Qty با «افزودن همه» — بدون رفت‌وبرگشت بین صفحه‌ها." },
          { icon: Receipt, title: "فاکتور رسمی", text: "برای هر سفارش تأییدشده شمارهٔ فاکتور صادر می‌شود و در پنل همکار قابل دریافت است." },
          { icon: Truck, title: "ارسال هماهنگ", text: "سفارش‌های بالای ۱۵ میلیون تومان ارسال رایگان؛ بقیه با هزینهٔ پستی هماهنگ." },
          { icon: RotateCcw, title: "سفارش مجدد", text: "هر سفارش قبلی را با یک کلیک به سبد فعلی برگردانید." },
        ].map(benefit => <article key={benefit.title} className="partner-benefit"><span className="partner-benefit-icon"><benefit.icon size={22} /></span><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}
      </div>
    </section>

    <section className="partner-tiers" id="tiers">
      <div className="section-heading"><div><span className="eyebrow">TIERED PRICING</span><h2><i />لایه‌های قیمت همکاری</h2></div><span className="muted">قیمت نهایی هر قلم، در پنل همکار محاسبه می‌شود</span></div>
      <div className="partner-tier-grid">
        {tiers.filter(tier => tier.active).map(tier => <article key={tier.key} className={`partner-tier-card tier-${tier.key}`}>
          <header><span className="partner-tier-key" dir="ltr">{tier.key}</span><h3>{tier.name}</h3></header>
          <strong className="partner-tier-value">{tier.discountType === "fixed" ? `${money(tier.discountValue)} تومان هر قلم` : `${money(tier.discountValue)}٪ تخفیف`}</strong>
          <p className="partner-tier-min">{tier.minOrder > 0 ? `حداقل سفارش: ${money(tier.minOrder)} تومان` : "بدون حداقل سفارش"}</p>
          <p className="muted">{tier.description}</p>
        </article>)}
      </div>
    </section>

    <section className="partner-apply" id="apply">
      <div className="partner-apply-copy">
        <span className="eyebrow">JOIN US</span>
        <h2>درخواست همکاری</h2>
        <p>فرم را پر کن. تیم کیا درخواست شما را بررسی می‌کند و پس از تأیید، حساب همکاری شما با لایهٔ قیمت مناسب فعال می‌شود. اگر رمز عبور انتخاب کنید، بلافاصله پس از تأیید می‌توانید وارد پنل شوید.</p>
        <ul className="partner-apply-list">
          <li><Check size={16} />بررسی درخواست معمولاً کمتر از ۲۴ ساعت کاری</li>
          <li><Check size={16} />بدون هزینهٔ عضویت و بدون تعهد خرید</li>
          <li><Check size={16} />پشتیبانی اختصاصی همکاران</li>
        </ul>
        <div className="partner-apply-note"><Users size={17} /><span>درخواست‌های تأییدشده به‌صورت خودکار به لایهٔ «خرده‌فروشی» متصل می‌شوند و مدیر می‌تواند لایه را ارتقا دهد.</span></div>
      </div>
      {sent ? <div className="partner-apply-done"><span className="partner-done-icon"><Handshake size={30} /></span><h3>درخواست شما ثبت شد</h3><p>پس از بررسی توسط تیم کیا، با شمارهٔ موبایل شما تماس می‌گیریم. اگر رمز عبور انتخاب کرده‌اید، پس از تأیید از اینجا وارد شوید.</p><Link className="button button-lime" href="/partner/login">ورود به پنل همکار<ArrowLeft size={18} /></Link></div>
        : <form className="partner-form" onSubmit={submit}>
            <div className="form-grid">
              <label>نام کسب‌وکار یا برند<input required name="businessName" minLength={2} maxLength={120} placeholder="مثلاً بوتیک الماس" /></label>
              <label>نام و نام خانوادگی مسئول<input required name="contactName" minLength={2} maxLength={80} placeholder="نام شما" /></label>
              <label>شماره موبایل<input required name="phone" type="tel" dir="ltr" placeholder="09xxxxxxxxx" maxLength={14} /></label>
              <label>شهر<input required name="city" minLength={2} maxLength={80} placeholder="مثلاً اصفهان" /></label>
              <label>شماره ثابت (اختیاری)<input name="landline" dir="ltr" placeholder="031xxxxxxxx" maxLength={20} /></label>
              <label>آیدی اینستاگرام (اختیاری)<input name="instagram" dir="ltr" placeholder="myboutique" maxLength={60} /></label>
            </div>
            <label className="full-width">دربارهٔ کسب‌وکار و حجم خرید شما<textarea name="about" rows={4} maxLength={1200} placeholder="چه محصولاتی می‌فروشید؟ ماهانه چه حجمی خرید می‌کنید؟" /></label>
            <div className="partner-password-block">
              <label className="partner-check"><input type="checkbox" checked={wantPassword} onChange={e => setWantPassword(e.target.checked)} />می‌خواهم همین حالا رمز عبور برای پنل همکار تنظیم کنم</label>
              {wantPassword && <label>رمز عبور پنل همکار<input type="password" name="password" dir="ltr" minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="حداقل ۸ کاراکتر" />{password.length > 0 && password.length < 8 && <small className="coupon-error">رمز عبور باید حداقل ۸ کاراکتر باشد.</small>}</label>}
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-lime" disabled={loading}><Handshake size={18} />{loading ? "در حال ثبت..." : "ارسال درخواست همکاری"}</button>
          </form>}
    </section>

    <section className="partner-cta-band">
      <div><Store size={26} /><div><strong>قیمت‌ها را می‌خواهی همین حالا ببینی؟</strong><span>لایه‌های همکاری را مقایسه کن و با پشتیبانی دربارهٔ حداقل سفارش صحبت کن.</span></div></div>
      <Link className="button button-outline" href="/shop">دیدن ویترین کیا<ArrowLeft size={17} /></Link>
    </section>
  </div>;
}

/* ── ورود همکار ── */
export function PartnerLogin() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/partners/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: form.get("phone"), password: form.get("password") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDone(true);
      window.location.href = "/partner/panel";
    } catch (e) { setError(e instanceof Error ? e.message : "ورود انجام نشد."); setLoading(false); }
  }
  return <div className="partner-login-page">
    <div className="partner-login-card">
      <Link className="text-link" href="/"><ArrowLeft size={15} />بازگشت به فروشگاه</Link>
      <span className="eyebrow" dir="ltr">KIYA PARTNER PANEL</span>
      <h1>پنل همکاران عمده</h1>
      <p className="muted">با شماره موبایل و رمز عبوری که هنگام درخواست همکاری انتخاب کردید وارد شوید.</p>
      <form className="form-stack" onSubmit={submit}>
        <label>شماره موبایل<input required name="phone" type="tel" dir="ltr" autoComplete="tel" placeholder="09xxxxxxxxx" maxLength={14} /></label>
        <label>رمز عبور<input required name="password" type="password" dir="ltr" autoComplete="current-password" minLength={8} placeholder="رمز عبور پنل همکار" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {done && <p className="coupon-success">ورود موفق! در حال انتقال به پنل...</p>}
        <button className="button button-lime" disabled={loading}><KeyRound size={18} />{loading ? "در حال بررسی..." : "ورود به پنل همکار"}</button>
      </form>
      <div className="partner-login-foot">
        <span>حساب همکاری نداری؟</span>
        <Link className="text-link" href="/partner">درخواست همکاری<ArrowUpLeft size={15} /></Link>
      </div>
      <p className="muted partner-login-hint"><Users size={15} /> اگر مدیر لایهٔ قیمت شما را ارتقا داده یا حساب شما تأیید شده باشد، با همین اطلاعات وارد می‌شوید.</p>
    </div>
  </div>;
}

/* ── پنل همکار ── */
type PartnerPanelProps = {
  products: Product[];
  tier: PartnerTier | null;
  partner: { id: number; phone: string; businessName: string; contactName: string; city: string; status: string; tierName: string };
  orders: (PartnerOrderItem extends never ? never : { id: number; code: string; requestKey: string; partnerId: number; items: PartnerOrderItem[]; subtotal: number; discount: number; shipping: number; total: number; tierName: string; status: string; paymentStatus: string; trackingNumber: string; note: string; invoiceNumber: string; createdAt: string })[];
};

type PanelLine = { key: string; productId: number; name: string; image: string; size: string; color: string; quantity: number; partnerPrice: number; retailPrice: number };

export function PartnerPanel({ products, tier, partner, orders }: PartnerPanelProps) {
  const [lines, setLines] = useState<PanelLine[]>([]);
  const [tab, setTab] = useState<"catalog" | "quick" | "orders" | "account">("catalog");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [changePassword, setChangePassword] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const router = useRouter();

  useEffect(() => { setRequestKey(crypto.randomUUID()); }, []);

  const priced = useMemo(() => products.map(product => {
    const percent = tier && tier.discountType === "percent" ? tier.discountValue : 0;
    const unit = tier && tier.discountType === "fixed" ? tier.discountValue : tier ? Math.round(product.price * (100 - percent) / 100) : product.price;
    return { ...product, partnerPrice: Math.min(unit, product.price), partnerDiscount: product.price ? Math.round(((product.price - Math.min(unit, product.price)) / product.price) * 100) : 0 };
  }), [products, tier]);

  const visible = priced.filter(product => (category === "all" || product.category === category) && `${product.name} ${product.material}`.includes(query));
  const subtotal = lines.reduce((sum, line) => sum + line.partnerPrice * line.quantity, 0);
  const retailTotal = lines.reduce((sum, line) => sum + line.retailPrice * line.quantity, 0);
  const saving = retailTotal - subtotal;
  const shipping = subtotal >= 15000000 ? 0 : subtotal > 0 ? 250000 : 0;
  const total = subtotal + shipping;
  const minimum = tier?.minOrder ?? 0;
  const categories = useMemo(() => [...new Set(products.map(product => product.category))], [products]);

  function addLine(productId: number, size: string, color: string, quantity: number) {
    const product = priced.find(p => p.id === productId);
    if (!product || quantity < 1) return;
    if (quantity > product.stock) { setError(`موجودی «${product.name}» کافی نیست (${product.stock} قلم).`); return; }
    setError("");
    setLines(current => {
      const key = `${productId}-${size}-${color}`;
      const existing = current.find(line => line.key === key);
      if (existing) return current.map(line => line.key === key ? { ...line, quantity: Math.min(product.stock, line.quantity + quantity) } : line);
      return [...current, { key, productId, name: product.name, image: product.image, size, color, quantity, partnerPrice: product.partnerPrice, retailPrice: product.price }];
    });
  }

  function setQuantity(key: string, quantity: number) {
    setLines(current => current.flatMap(line => line.key === key ? (quantity < 1 ? [] : [{ ...line, quantity }]) : [line]));
  }

  function fillQuickTable() {
    const next: PanelLine[] = [];
    for (const product of priced) {
      if (product.stock < 1) continue;
      next.push({
        key: `${product.id}-${product.sizes[0] ?? ""}-${product.colors[0]?.name ?? ""}`,
        productId: product.id, name: product.name, image: product.image,
        size: product.sizes[0] ?? "", color: product.colors[0]?.name ?? "",
        quantity: Math.min(6, product.stock), partnerPrice: product.partnerPrice, retailPrice: product.price,
      });
    }
    setLines(next);
    setTab("quick");
  }

  async function submitOrder() {
    setError(""); setSuccess("");
    if (!lines.length) { setError("سبد عمده خالی است."); return; }
    if (subtotal < minimum) { setError(`حداقل مبلغ سفارش برای لایهٔ ${tier?.name ?? "همکاری"} ${money(minimum)} تومان است.`); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/partners/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey, note, items: lines.map(line => ({ productId: line.productId, quantity: line.quantity, size: line.size, color: line.color })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuccess(`سفارش عمده ${data.code} با مبلغ ${money(data.total)} تومان ثبت شد. پس از تأیید مدیر، فاکتور در همین صفحه صادر می‌شود.`);
      setLines([]); setNote(""); setRequestKey(crypto.randomUUID());
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "ثبت سفارش عمده انجام نشد."); }
    finally { setLoading(false); }
  }

  async function reorder(code: string) {
    setError("");
    try {
      const response = await fetch("/api/partners/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next: PanelLine[] = [];
      for (const item of data.items as { productId: number; quantity: number; size: string; color: string }[]) {
        const product = priced.find(p => p.id === item.productId);
        if (!product) continue;
        next.push({ key: `${item.productId}-${item.size}-${item.color}`, productId: item.productId, name: product.name, image: product.image, size: item.size, color: item.color, quantity: item.quantity, partnerPrice: product.partnerPrice, retailPrice: product.price });
      }
      setLines(next); setRequestKey(data.requestKey); setTab("quick");
      setSuccess(`اقلام سفارش ${code} به سبد فعلی منتقل شد.`);
    } catch (e) { setError(e instanceof Error ? e.message : "سفارش مجدد انجام نشد."); }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    if (changePassword.next.length < 8) { setPasswordMessage("رمز جدید باید حداقل ۸ کاراکتر باشد."); return; }
    if (changePassword.next !== changePassword.confirm) { setPasswordMessage("تکرار رمز جدید یکسان نیست."); return; }
    try {
      const response = await fetch("/api/partners/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change-password", currentPassword: changePassword.current, password: changePassword.next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPasswordMessage(data.message || "رمز عبور تغییر کرد.");
      setChangePassword({ current: "", next: "", confirm: "" });
    } catch (e) { setPasswordMessage(e instanceof Error ? e.message : "تغییر رمز انجام نشد."); }
  }

  async function logout() {
    await fetch("/api/partners/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.href = "/partner/login";
  }

  const confirmedTotal = orders.filter(order => order.status === "confirmed").reduce((sum, order) => sum + order.total, 0);

  return <div className="partner-panel">
    <aside className="partner-panel-side">
      <div className="partner-panel-brand"><Store size={20} /><div><strong>{partner.businessName || "همکار کیا"}</strong><span>{partner.phone}</span></div></div>
      <div className="partner-tier-badge"><Layers size={16} /> لایهٔ قیمت: <strong>{partner.tierName}</strong></div>
      <nav>
        {[
          { id: "catalog", label: "کاتالوگ عمده", icon: Package },
          { id: "quick", label: "سفارش عمدهٔ سریع", icon: ClipboardList },
          { id: "orders", label: "سفارش‌ها و فاکتور", icon: Receipt },
          { id: "account", label: "حساب همکاری", icon: Users },
        ].map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id as typeof tab)}><item.icon size={18} /><span>{item.label}</span></button>)}
      </nav>
      <div className="partner-panel-stats">
        <div><span>سفارش‌های تأییدشده</span><strong>{money(orders.filter(order => order.status === "confirmed").length)}</strong></div>
        <div><span>مجموع خرید</span><strong>{money(confirmedTotal)} تومان</strong></div>
      </div>
      <button className="partner-logout" onClick={logout}><LogOut size={17} />خروج از حساب</button>
    </aside>

    <main className="partner-panel-main">
      <header className="partner-panel-heading">
        <div><span className="eyebrow" dir="ltr">KIYA PARTNER PANEL</span><h1>{partner.contactName ? `${partner.contactName} عزیز، خوش اومدی` : "پنل همکار"}</h1></div>
        <Link className="button button-outline" href="/shop" target="_blank">دیدن ویترین<ArrowUpLeft size={16} /></Link>
      </header>

      {partner.status !== "approved" && <div className="partner-pending"><Users size={20} /><div><strong>حساب شما در انتظار تأیید است</strong><span>پس از تأیید توسط تیم کیا، قیمت‌های همکاری و ثبت سفارش عمده فعال می‌شود.</span></div></div>}

      {tab === "catalog" && <section className="partner-catalog">
        <div className="partner-catalog-toolbar">
          <div className="chip-filters">{["all", ...categories].map(cat => <button key={cat} className={category === cat ? "filter-chip selected" : "filter-chip"} onClick={() => setCategory(cat)}>{cat === "all" ? "همهٔ دسته‌ها" : cat}</button>)}</div>
          <input className="partner-search" placeholder="جستجوی محصول..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="partner-catalog-table">
          <table className="admin-table">
            <thead><tr><th>محصول</th><th>قیمت ویترین</th><th>قیمت همکار</th><th>تخفیف</th><th>موجودی</th><th>سایز / رنگ</th><th>تعداد</th><th /></tr></thead>
            <tbody>{visible.map(product => <tr key={product.id}>
              <td><div className="partner-product-cell"><img src={product.image} alt="" width="42" height="42" /><div><strong>{product.name}</strong><small className="muted">{product.material}</small></div></div></td>
              <td><del className="muted">{money(product.price)}</del></td>
              <td><strong className="partner-price">{money(product.partnerPrice)} تومان</strong></td>
              <td><span className="inline-badge">{money(product.partnerDiscount)}٪</span></td>
              <td>{product.stock > 0 ? money(product.stock) : <span className="muted">ناموجود</span>}</td>
              <td><small className="muted">{product.sizes.join("، ") || "فری"} · {product.colors.map(c => c.name).join("، ") || "—"}</small></td>
              <td><input className="partner-qty" type="number" min="1" max={Math.max(1, product.stock)} defaultValue="1" id={`qty-${product.id}`} /></td>
              <td><button className="icon-button" aria-label={`افزودن ${product.name} به سبد عمده`} disabled={product.stock < 1} onClick={() => { const input = document.getElementById(`qty-${product.id}`) as HTMLInputElement | null; addLine(product.id, product.sizes[0] ?? "", product.colors[0]?.name ?? "", Number(input?.value || 1)); }}><ShoppingCart size={16} /></button></td>
            </tr>)}</tbody>
          </table>
        </div>
        <button className="button button-outline partner-add-all" onClick={fillQuickTable}><ClipboardList size={17} />افزودن همه به سبد عمدهٔ سریع</button>
      </section>}

      {tab === "quick" && <section className="partner-quick">
        <div className="section-heading"><div><span className="eyebrow">QUICK WHOLESALE ORDER</span><h2><i />جدول سفارش عمدهٔ سریع</h2></div><span className="muted">سایز و رنگ پیش‌فرض هر محصول انتخاب شده؛ می‌توانید تغییر دهید.</span></div>
        <div className="partner-catalog-table">
          <table className="admin-table">
            <thead><tr><th>محصول</th><th>سایز</th><th>رنگ</th><th>تعداد</th><th>قیمت همکار</th><th>جمع</th><th /></tr></thead>
            <tbody>{lines.length ? lines.map(line => {
              const product = priced.find(p => p.id === line.productId);
              return <tr key={line.key}>
                <td><div className="partner-product-cell"><img src={line.image} alt="" width="38" height="38" /><strong>{line.name}</strong></div></td>
                <td><select value={line.size} onChange={e => setLines(current => current.map(item => item.key === line.key ? { ...item, size: e.target.value, key: `${item.productId}-${e.target.value}-${item.color}` } : item))}>{product?.sizes.map(size => <option key={size} value={size}>{size}</option>) ?? <option value={line.size}>{line.size}</option>}</select></td>
                <td><select value={line.color} onChange={e => setLines(current => current.map(item => item.key === line.key ? { ...item, color: e.target.value, key: `${item.productId}-${item.size}-${e.target.value}` } : item))}>{product?.colors.map(color => <option key={color.name} value={color.name}>{color.name}</option>) ?? <option value={line.color}>{line.color}</option>}</select></td>
                <td><input className="partner-qty" type="number" min="1" max={Math.max(1, product?.stock ?? 1)} value={line.quantity} onChange={e => setQuantity(line.key, Number(e.target.value))} /></td>
                <td>{money(line.partnerPrice)}</td>
                <td><strong>{money(line.partnerPrice * line.quantity)}</strong></td>
                <td><button className="icon-button danger-action" aria-label={`حذف ${line.name}`} onClick={() => setQuantity(line.key, 0)}><LogOut size={15} /></button></td>
              </tr>;
            }) : <tr><td colSpan={7} className="muted">سبد عمده خالی است. از کاتالوگ محصول اضافه کنید یا «افزودن همه» را بزنید.</td></tr>}</tbody>
          </table>
        </div>

        <div className="partner-order-summary">
          <div>
            <label className="full-width">یادداشت برای تیم کیا (اختیاری)<textarea rows={3} maxLength={800} value={note} onChange={e => setNote(e.target.value)} placeholder="مثلاً: لطفاً فاکتور به نام بوتیک الماس صادر شود." /></label>
            <div className="partner-order-lines">
              <div><span>جمع به قیمت ویترین</span><del className="muted">{money(retailTotal)} تومان</del></div>
              <div><span>تخفیف لایهٔ {tier?.name ?? "همکاری"}</span><strong className="partner-saving">− {money(saving)} تومان</strong></div>
              <div><span>جمع عمده</span><strong>{money(subtotal)} تومان</strong></div>
              <div><span>هزینهٔ ارسال</span><span>{shipping === 0 ? "ارسال رایگان" : `${money(shipping)} تومان`}</span></div>
              <div className="partner-order-total"><span>مبلغ نهایی</span><strong>{money(total)} تومان</strong></div>
              {minimum > 0 && subtotal < minimum && <p className="coupon-error">حداقل سفارش این لایه {money(minimum)} تومان است؛ {money(minimum - subtotal)} تومان باقی مانده.</p>}
            </div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {success && <p className="coupon-success" role="status">{success}</p>}
          <button className="button button-lime" disabled={loading || !lines.length || subtotal < minimum} onClick={submitOrder}><Handshake size={18} />{loading ? "در حال ثبت..." : "ثبت سفارش عمده"}</button>
        </div>
      </section>}

      {tab === "orders" && <section className="partner-orders">
        <div className="section-heading"><div><span className="eyebrow">ORDER HISTORY</span><h2><i />سفارش‌ها و فاکتورها</h2></div><span className="muted">{money(orders.length)} سفارش</span></div>
        <div className="partner-order-list">
          {orders.map(order => <article key={order.id} className="partner-order-card">
            <header><div><strong dir="ltr">{order.code}</strong><span className={`status-badge status-${order.status === "confirmed" ? "delivered" : order.status === "cancelled" ? "cancelled" : "pending"}`}>{order.status === "confirmed" ? "تأیید شده" : order.status === "cancelled" ? "لغو شده" : order.status === "shipped" ? "ارسال شده" : "در انتظار تأیید"}</span></div><time>{new Date(order.createdAt).toLocaleDateString("fa-IR")}</time></header>
            <div className="partner-order-items">{order.items.map((item, index) => <span key={index}>{item.name} × {item.quantity}</span>)}</div>
            <footer>
              <div className="partner-order-amounts"><span>تخفیف: {money(order.discount)}</span><strong>{money(order.total)} تومان</strong></div>
              <div className="partner-order-actions">
                {order.invoiceNumber && <span className="partner-invoice" dir="ltr"><Receipt size={15} />{order.invoiceNumber}</span>}
                {order.trackingNumber && <span className="partner-invoice" dir="ltr"><Truck size={15} />{order.trackingNumber}</span>}
                <button className="button button-subtle" onClick={() => reorder(order.code)}><RotateCcw size={16} />سفارش مجدد</button>
              </div>
            </footer>
          </article>)}
          {!orders.length && <div className="empty-state"><span className="empty-icon"><Receipt size={28} /></span><h3>هنوز سفارشی ثبت نکرده‌اید</h3><p>از کاتالوگ عمده محصول‌ها را به سبد اضافه کنید و اولین سفارش عمده‌تان را ثبت کنید.</p></div>}
        </div>
      </section>}

      {tab === "account" && <section className="partner-account">
        <div className="section-heading"><div><span className="eyebrow">ACCOUNT</span><h2><i />حساب همکاری</h2></div></div>
        <div className="partner-account-grid">
          <div className="partner-account-card">
            <h3>اطلاعات همکاری</h3>
            <dl>
              <div><dt>نام کسب‌وکار</dt><dd>{partner.businessName || "—"}</dd></div>
              <div><dt>مسئول همکاری</dt><dd>{partner.contactName || "—"}</dd></div>
              <div><dt>شماره موبایل</dt><dd dir="ltr">{partner.phone}</dd></div>
              <div><dt>شهر</dt><dd>{partner.city || "—"}</dd></div>
              <div><dt>لایهٔ قیمت</dt><dd>{partner.tierName}</dd></div>
              <div><dt>وضعیت حساب</dt><dd>{partner.status === "approved" ? "تأیید‌شده" : "در انتظار بررسی"}</dd></div>
            </dl>
          </div>
          <div className="partner-account-card">
            <h3>تغییر رمز عبور</h3>
            <form className="form-stack" onSubmit={savePassword}>
              <label>رمز فعلی<input type="password" dir="ltr" value={changePassword.current} onChange={e => setChangePassword({ ...changePassword, current: e.target.value })} /></label>
              <label>رمز جدید<input type="password" dir="ltr" minLength={8} value={changePassword.next} onChange={e => setChangePassword({ ...changePassword, next: e.target.value })} /></label>
              <label>تکرار رمز جدید<input type="password" dir="ltr" minLength={8} value={changePassword.confirm} onChange={e => setChangePassword({ ...changePassword, confirm: e.target.value })} /></label>
              {passwordMessage && <p className="form-error" role="alert">{passwordMessage}</p>}
              <button className="button button-lime"><KeyRound size={17} />ذخیرهٔ رمز جدید</button>
            </form>
          </div>
        </div>
      </section>}
    </main>

    <div className="partner-cart-drawer">
      <div className="partner-cart-head"><ShoppingCart size={18} />سبد عمده<span className="muted">{money(lines.length)} قلم</span></div>
      <div className="partner-cart-items">{lines.map(line => <div key={line.key}><span>{line.name} × {line.quantity}</span><strong>{money(line.partnerPrice * line.quantity)}</strong></div>)}</div>
      <div className="partner-cart-total"><span>جمع عمده</span><strong>{money(subtotal)} تومان</strong></div>
      <button className="button button-lime" onClick={() => setTab("quick")}><TrendingUp size={17} />ادامهٔ سفارش</button>
    </div>
  </div>;
}
