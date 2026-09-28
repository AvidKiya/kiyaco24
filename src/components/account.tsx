"use client";
import { useState, useMemo, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserRound, Phone, LockKeyhole, LogOut, LayoutDashboard, ShoppingBag, Heart, MapPin, Wallet,
  TicketPercent, Trophy, Bell, Users, Star, Headphones, ArrowLeft, ArrowUpLeft, Gift, Copy, Check,
  Sparkles, Package, Medal, ChevronLeft, RefreshCw, BellRing,
} from "lucide-react";
import { type Product, orderStatuses } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { ProductCard } from "./product";
import { InvertedCorner } from "./inverted-corner";
import { type Customer, type CustomerTier, clubTiers, tierMeta, tierProgress, tierForSpending, pointsToWallet, pointsRules, money as faMoney } from "@/lib/customer-types";

/* ---------- فاز ۱۰: اعلان مرورگر (Web Push / PWA) ---------- */
function PushCard({ phone }: { phone: string }) {
  const shop = useShop();
  const [state, setState] = useState<"idle" | "working" | "on" | "unsupported" | "denied">("idle");
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) { if (alive) setState("unsupported"); return; }
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription && alive) setState("on");
    };
    void check();
    return () => { alive = false; };
  }, []);

  async function enable() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setState("unsupported"); return; }
    setState("working");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
      const json = subscription.toJSON();
      const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "فعال‌سازی اعلان مرورگر انجام نشد.");
      setState("on"); shop.toast(result.message || "اعلان مرورگر فعال شد.");
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === "NotAllowedError") { setState("denied"); shop.toast("اجازهٔ اعلان در مرورگر داده نشد.", "error"); return; }
      shop.toast(error instanceof Error ? error.message : "فعال‌سازی انجام نشد.", "error"); setState("idle");
    }
  }

  async function disable() {
    setState("working");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setState("idle"); shop.toast("اعلان مرورگر خاموش شد.");
    } catch { shop.toast("خاموش‌کردن اعلان انجام نشد.", "error"); setState("idle"); }
  }

  return <div className="push-card">
    <span className="push-card-icon"><BellRing size={22} /></span>
    <div>
      <h3>اعلان مرورگر</h3>
      <p>{state === "on" ? "اعلان‌های وضعیت سفارش، کالکشن جدید و پیشنهادها روی این مرورگر فعال است." : state === "denied" ? "مرورگر اجازهٔ اعلان نداده؛ از تنظیمات سایت در مرورگر اجازه بده." : state === "unsupported" ? "مرورگر شما از اعلان پشتیبانی نمی‌کند؛ پیامک و ایمیل جای این را می‌گیرد." : "با فعال‌سازی، بدون باز کردن سایت از وضعیت سفارش و تخفیف‌ها باخبر شو."}</p>
      <small className="muted">{phone ? `پیامک و ایمیل نیز برای ${phone} فعال است.` : "برای دریافت پیامک و ایمیل، شمارهٔ حساب‌ات استفاده می‌شود."}</small>
    </div>
    {state === "on"
      ? <button className="button button-outline button-sm" onClick={() => void disable()}>خاموش‌کردن</button>
      : <button className="button button-lime button-sm" onClick={() => void enable()} disabled={state === "working" || state === "denied" || state === "unsupported"}>{state === "working" ? "در حال فعال‌سازی..." : "فعال‌سازی اعلان"}</button>}
  </div>;
}

/* ============================================================
 *  فاز ۹ — ورود مشتری (کد پیامکی یا رمز عبور)
 * ============================================================ */

export function AccountLogin({ nextPath = "/account/panel" }: { nextPath?: string }) {
  const router = useRouter();
  const { toast } = useShop();
  const [step, setStep] = useState<"phone" | "code" | "profile">("phone");
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function send(action: string, payload: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/customer/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "انجام نشد."); return null; }
      return data;
    } catch { setError("ارتباط با سرور برقرار نشد."); return null; }
    finally { setBusy(false); }
  }

  async function requestCode() {
    const data = await send("request-otp", { phone });
    if (!data) return;
    setStep("code"); setCountdown(120);
    if (data.devCode) setDevCode(data.devCode);
    toast("کد تأیید ارسال شد.");
  }

  async function verifyCode() {
    const data = await send("verify-otp", { phone, code });
    if (!data) return;
    if (data.isNew) { setStep("profile"); return; }
    toast("خوش آمدید!");
    router.push(nextPath); router.refresh();
  }

  async function finishProfile() {
    if (name.trim().length < 2) { setError("نام خود را وارد کنید."); return; }
    const response = await fetch("/api/customer/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", name, city }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "ذخیره ناموفق بود."); return; }
    toast("حساب شما ساخته شد!");
    router.push(nextPath); router.refresh();
  }

  async function loginPassword() {
    const data = await send("login-password", { phone, password });
    if (!data) return;
    toast("خوش آمدید!");
    router.push(nextPath); router.refresh();
  }

  return (
    <div className="account-login-page">
      <header className="page-hero">
        <div className="container">
          <span className="eyebrow">MY ACCOUNT</span>
          <h1>حساب کاربری من</h1>
          <p>با ورود به حساب، سفارش‌ها، امتیازها، کیف پول و کالکشن‌های موردعلاقه‌ات همیشه در دسترس است.</p>
        </div>
      </header>

      <div className="container account-login-body">
        <div className="account-login-card">
          <div className="account-login-head">
            <span className="account-login-icon"><UserRound size={26} /></span>
            <div>
              <h2>{step === "profile" ? "یکی دو اطلاعات ازت بپرسیم" : step === "code" ? "کد تأیید را وارد کن" : "ورود یا ثبت‌نام"}</h2>
              <p>{step === "profile" ? "نامت را در باشگاه مشتریان کیا ثبت کن." : step === "code" ? `کد ۶ رقمی ارسال‌شده به ${phone} را وارد کن.` : "با شمارهٔ موبایلت وارد شو؛ اگر حسابی نداشته باشی، خودکار ساخته می‌شود."}</p>
            </div>
          </div>

          {step === "phone" && (
            <>
              <div className="account-login-modes">
                <button className={mode === "otp" ? "active" : ""} onClick={() => setMode("otp")}><Phone size={15} />کد پیامکی</button>
                <button className={mode === "password" ? "active" : ""} onClick={() => setMode("password")}><LockKeyhole size={15} />رمز عبور</button>
              </div>

              {mode === "otp" ? (
                <form className="account-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void requestCode(); }}>
                  <label>شماره موبایل<input required inputMode="numeric" maxLength={11} dir="ltr" placeholder="09xxxxxxxxx" value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d]/g, ""))} /></label>
                  {error && <p className="form-error">{error}</p>}
                  <button className="button button-lime" disabled={busy}>{busy ? "در حال ارسال..." : "دریافت کد تأیید"}<ArrowLeft size={17} /></button>
                </form>
              ) : (
                <form className="account-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void loginPassword(); }}>
                  <label>شماره موبایل<input required inputMode="numeric" maxLength={11} dir="ltr" placeholder="09xxxxxxxxx" value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d]/g, ""))} /></label>
                  <label>رمز عبور<input required type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></label>
                  {error && <p className="form-error">{error}</p>}
                  <button className="button button-lime" disabled={busy}>ورود به حساب<ArrowLeft size={17} /></button>
                  <p className="account-form-hint">اگر رمزی نداری، با «کد پیامکی» وارد شو و از بخش امنیت حساب، رمز بساز.</p>
                </form>
              )}
            </>
          )}

          {step === "code" && (
            <form className="account-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void verifyCode(); }}>
              <label>کد تأیید ۶ رقمی<input required inputMode="numeric" maxLength={6} dir="ltr" className="otp-input" value={code} onChange={e => setCode(e.target.value.replace(/[^\d]/g, ""))} /></label>
              {devCode && <p className="account-dev-hint">حالت توسعه — کد شما: <b dir="ltr">{devCode}</b></p>}
              {error && <p className="form-error">{error}</p>}
              <button className="button button-lime" disabled={busy}>تأیید و ورود<ArrowLeft size={17} /></button>
              <div className="account-login-foot">
                <button type="button" className="text-link" onClick={() => { setStep("phone"); setDevCode(""); }}><ChevronLeft size={15} />تغییر شماره یا ارسال دوباره</button>
                {countdown > 0 && <span className="muted">ارسال دوباره در {countdown.toLocaleString("fa-IR")} ثانیه</span>}
              </div>
            </form>
          )}

          {step === "profile" && (
            <form className="account-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void finishProfile(); }}>
              <label>نام و نام خانوادگی<input required maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="مثلاً سارا محمدی" /></label>
              <label>شهر<input maxLength={40} value={city} onChange={e => setCity(e.target.value)} placeholder="مثلاً تهران" /></label>
              {error && <p className="form-error">{error}</p>}
              <button className="button button-lime" disabled={busy}>ساخت حساب و ورود<ArrowLeft size={17} /></button>
              <p className="account-form-note">با تکمیل اطلاعات، {pointsRules.profile.toLocaleString("fa-IR")} امتیاز هدیه می‌گیری.</p>
            </form>
          )}
        </div>

        <aside className="account-login-side">
          <h3>مزیت‌های حساب کاربری</h3>
          <ul>
            <li><Trophy size={17} />امتیاز برای هر خرید و هر نظر</li>
            <li><Medal size={17} />سطوح باشگاه: برنزی، نقره‌ای، طلایی، ویژه</li>
            <li><Wallet size={17} />کیف پول و تبدیل امتیاز به اعتبار</li>
            <li><Users size={17} />دعوت دوست و گرفتن امتیاز</li>
            <li><Heart size={17} />ذخیرهٔ علاقه‌مندی‌ها و پیگیری سفارش‌ها</li>
          </ul>
          <div className="account-login-club">
            {clubTiers.map(tier => (
              <span key={tier.id} className="account-tier-chip" style={{ background: tier.color }}>{tier.name}</span>
            ))}
          </div>
          <Link className="text-link" href="/shop">ادامهٔ خرید بدون حساب<ArrowUpLeft size={16} /></Link>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
 *  پنل مشتری
 * ============================================================ */

type Section = "overview" | "orders" | "favorites" | "addresses" | "wallet" | "coupons" | "points" | "referral" | "notifications" | "reviews" | "support";

const sections: { id: Section; title: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", title: "نمای کلی", icon: LayoutDashboard },
  { id: "orders", title: "سفارش‌های من", icon: ShoppingBag },
  { id: "favorites", title: "علاقه‌مندی‌ها", icon: Heart },
  { id: "addresses", title: "نشانی‌ها", icon: MapPin },
  { id: "wallet", title: "کیف پول", icon: Wallet },
  { id: "coupons", title: "کوپن‌های من", icon: TicketPercent },
  { id: "points", title: "امتیازها", icon: Trophy },
  { id: "referral", title: "دعوت دوستان", icon: Users },
  { id: "notifications", title: "اعلان‌ها", icon: Bell },
  { id: "reviews", title: "نظرات من", icon: Star },
  { id: "support", title: "پشتیبانی", icon: Headphones },
];

export type AccountOrder = { id: string; code: string; items: { productId: number; name: string; image: string; price: number; quantity: number; size: string; color: string }[]; total: number; status: string; paymentStatus: string; createdAt: string; trackingNumber: string };
export type AccountReview = { id: number; productId: number; name: string; rating: number; text: string; approved: boolean; createdAt: string };
export type AccountPointLog = { id: number; points: number; reason: string; orderCode: string; createdAt: string };
export type AccountWalletTxn = { id: number; amount: number; kind: string; note: string; orderCode: string; createdAt: string };
export type AccountReferral = { id: number; code: string; status: string; rewardPoints: number; createdAt: string };
export type AccountNotification = { id: number; title: string; body: string; link: string; read: boolean; createdAt: string };

export function AccountPanel({
  customer, orders, reviews, pointsLogs, walletTxns, referrals, invited, notifications, products,
}: {
  customer: Customer; orders: AccountOrder[]; reviews: AccountReview[]; pointsLogs: AccountPointLog[];
  walletTxns: AccountWalletTxn[]; referrals: AccountReferral[]; invited: { id: number; name: string; createdAt: string }[];
  notifications: AccountNotification[]; products: Product[];
}) {
  const router = useRouter();
  const { toast, favorites } = useShop();
  const [section, setSection] = useState<Section>("overview");
  const [busy, setBusy] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const tier: CustomerTier = tierForSpending(customer.totalSpent);
  const meta = tierMeta(tier);
  const progress = tierProgress(customer.totalSpent);
  const unread = notifications.filter(item => !item.read).length;
  const inviteLink = useMemo(() => `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${customer.referralCode}`, [customer.referralCode]);
  const favoriteProducts = products.filter(product => favorites.includes(product.id));

  async function call(url: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { toast(data.error || "انجام نشد.", "error"); return false; }
      toast(data.message || "انجام شد.");
      router.refresh();
      return true;
    } catch { toast("ارتباط با سرور برقرار نشد.", "error"); return false; }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/customer/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    router.push("/account"); router.refresh();
  }

  return (
    <div className="account-panel">
      <header className="account-panel-head">
        <div className="container">
          <span className="eyebrow">MY ACCOUNT</span>
          <h1>سلام {customer.name || "دوست خوب کیا"} 👋</h1>
          <div className="account-tier-line">
            <span className="account-tier-badge" style={{ background: meta.color }}>{meta.name}</span>
            <span>{meta.en} · {customer.points.toLocaleString("fa-IR")} امتیاز · {faMoney(customer.walletBalance)} تومان اعتبار</span>
          </div>
          <div className="account-tier-progress">
            <div><span style={{ width: `${progress.percent}%`, background: meta.color }} /></div>
            {progress.next ? (
              <p>{faMoney(progress.remaining)} تومان تا سطح <b>{tierMeta(progress.next.id).name}</b></p>
            ) : (
              <p>به بالاترین سطح باشگاه رسیدی! 🎉</p>
            )}
          </div>
        </div>
      </header>

      <div className="container account-panel-body">
        <aside className={`account-side ${mobileMenu ? "open" : ""}`}>
          <nav aria-label="بخش‌های حساب کاربری">
            {sections.map(item => (
              <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => { setSection(item.id); setMobileMenu(false); }}>
                <item.icon size={18} /><span>{item.title}</span>
                {item.id === "notifications" && unread > 0 && <b>{unread.toLocaleString("fa-IR")}</b>}
                {item.id === "orders" && orders.length > 0 && <b>{orders.length.toLocaleString("fa-IR")}</b>}
              </button>
            ))}
          </nav>
          <div className="account-side-foot">
            <Link href="/shop"><ShoppingBag size={17} />رفتن به فروشگاه</Link>
            <button onClick={logout}><LogOut size={17} />خروج از حساب</button>
          </div>
        </aside>

        <div className="account-content">
          {/* ---------- نمای کلی ---------- */}
          {section === "overview" && (
            <div className="account-section">
              <div className="account-stats">
                {[
                  { title: "امتیاز قابل استفاده", value: faMoney(customer.points), unit: "امتیاز", icon: Trophy, color: meta.color },
                  { title: "اعتبار کیف پول", value: faMoney(customer.walletBalance), unit: "تومان", icon: Wallet, color: "#717967" },
                  { title: "سفارش‌های من", value: orders.length.toLocaleString("fa-IR"), unit: "سفارش", icon: ShoppingBag, color: "#252621" },
                  { title: "مجموع خرید", value: faMoney(customer.totalSpent), unit: "تومان", icon: Package, color: "#D19B44" },
                ].map(stat => (
                  <div className="account-stat" key={stat.title}>
                    <span className="account-stat-icon" style={{ color: stat.color }}><stat.icon size={20} /></span>
                    <div><strong>{stat.value}<small>{stat.unit}</small></strong><p>{stat.title}</p></div>
                  </div>
                ))}
              </div>

              <div className="account-card">
                <div className="admin-card-heading"><h2>باشگاه مشتریان کیا</h2><span className="inline-badge" style={{ background: meta.color, color: "#14150f" }}>{meta.name}</span></div>
                <div className="account-club-grid">
                  {clubTiers.map(item => (
                    <div key={item.id} className={`account-club-tier ${item.id === tier ? "current" : ""}`} style={{ "--tier-color": item.color } as React.CSSProperties}>
                      <span className="account-club-name">{item.name}</span>
                      <span className="account-club-min">{item.minSpent ? `از ${faMoney(item.minSpent)} تومان` : "همهٔ اعضا"}</span>
                      <ul>{item.perks.map(perk => <li key={perk}><Check size={13} />{perk}</li>)}</ul>
                      {item.id === tier && <span className="account-club-current">سطح فعلی تو</span>}
                    </div>
                  ))}
                </div>
                <div className="account-tier-progress wide">
                  <div><span style={{ width: `${progress.percent}%`, background: meta.color }} /></div>
                  <p>{progress.next ? `${faMoney(progress.remaining)} تومان تا سطح ${tierMeta(progress.next.id).name}` : "بالاترین سطح باشگاه"}</p>
                </div>
              </div>

              {orders.length > 0 && (
                <div className="account-card">
                  <div className="admin-card-heading"><h2>آخرین سفارش</h2><button className="text-link" onClick={() => setSection("orders")}>همهٔ سفارش‌ها<ArrowLeft size={15} /></button></div>
                  <div className="account-order-row">
                    <span className="account-order-code" dir="ltr">{orders[0].code}</span>
                    <span className={`status-badge status-${orders[0].status}`}>{orderStatuses[orders[0].status] ?? orders[0].status}</span>
                    <strong>{faMoney(orders[0].total)} تومان</strong>
                    <small className="muted">{new Date(orders[0].createdAt).toLocaleDateString("fa-IR")}</small>
                    <Link className="button button-outline button-sm" href="/track">پیگیری<ArrowLeft size={14} /></Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------- سفارش‌ها ---------- */}
          {section === "orders" && (
            <div className="account-section">
              <div className="account-card">
                <div className="admin-card-heading"><h2>سفارش‌های من ({orders.length.toLocaleString("fa-IR")})</h2></div>
                {orders.length ? (
                  <div className="account-orders">
                    {orders.map(order => (
                      <article className="account-order-card" key={order.id}>
                        <div className="account-order-head">
                          <span className="account-order-code" dir="ltr">{order.code}</span>
                          <span className={`status-badge status-${order.status}`}>{orderStatuses[order.status] ?? order.status}</span>
                          <span className="muted">{new Date(order.createdAt).toLocaleDateString("fa-IR")}</span>
                          <strong>{faMoney(order.total)} تومان</strong>
                        </div>
                        <div className="account-order-items">
                          {order.items.map((item, index) => (
                            <Link key={index} href={`/product/${products.find(p => p.id === item.productId)?.slug ?? "/shop"}`} className="account-order-item">
                              <img src={item.image} alt={item.name} width="54" height="54" />
                              <div><strong>{item.name}</strong><small>{item.color} · سایز {item.size} · {item.quantity.toLocaleString("fa-IR")} عدد</small></div>
                            </Link>
                          ))}
                        </div>
                        <div className="account-order-foot">
                          <span className="muted">پرداخت: {order.paymentStatus === "paid" ? "انجام شده" : "در انتظار"}</span>
                          {order.trackingNumber && <span className="muted" dir="ltr">رهگیری: {order.trackingNumber}</span>}
                          <Link className="button button-outline button-sm" href="/track">پیگیری سفارش<ArrowLeft size={14} /></Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="account-empty">
                    <ShoppingBag size={34} />
                    <h3>هنوز سفارشی ثبت نکردی</h3>
                    <p>اولین انتخاب خوبت را انجام بده.</p>
                    <Link className="button button-lime" href="/shop">بریم فروشگاه<ArrowLeft size={16} /></Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------- علاقه‌مندی‌ها ---------- */}
          {section === "favorites" && (
            <div className="account-section">
              <div className="account-card">
                <div className="admin-card-heading"><h2>علاقه‌مندی‌های من ({favoriteProducts.length.toLocaleString("fa-IR")})</h2></div>
                {favoriteProducts.length ? (
                  <div className="product-grid">{favoriteProducts.map(product => <ProductCard key={product.id} product={product} />)}</div>
                ) : (
                  <div className="account-empty">
                    <Heart size={34} />
                    <h3>لیست علاقه‌مندی‌ها خالی است</h3>
                    <p>روی قلب هر محصول بزن تا اینجا ذخیره شود.</p>
                    <Link className="button button-lime" href="/shop">دیدن محصولات<ArrowLeft size={16} /></Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------- نشانی‌ها ---------- */}
          {section === "addresses" && (
            <AddressesSection customer={customer} busy={busy} call={call} />
          )}

          {/* ---------- کیف پول ---------- */}
          {section === "wallet" && (
            <div className="account-section">
              <div className="account-card">
                <div className="admin-card-heading"><div><h2>کیف پول</h2><p className="muted">اعتبار کیف پول را در تسویه استفاده کن.</p></div><span className="inline-badge">{faMoney(customer.walletBalance)} تومان</span></div>
                <div className="account-wallet-convert">
                  <div>
                    <strong>{customer.points.toLocaleString("fa-IR")} امتیاز</strong>
                    <p>هر ۱۰۰ امتیاز = ۱٬۰۰۰ تومان اعتبار</p>
                  </div>
                  <button className="button button-lime" disabled={busy || customer.points < 100} onClick={() => call("/api/customer/wallet", { points: Math.floor(customer.points / 100) * 100 })}>
                    <Sparkles size={16} />تبدیل {pointsToWallet(customer.points).toLocaleString("fa-IR")} تومان
                  </button>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead><tr><th>تاریخ</th><th>نوع</th><th>توضیح</th><th>مبلغ</th></tr></thead>
                    <tbody>
                      {walletTxns.map(txn => (
                        <tr key={txn.id}>
                          <td><small>{new Date(txn.createdAt).toLocaleDateString("fa-IR")}</small></td>
                          <td>{txn.kind === "debit" ? "برداشت" : "واریز"}</td>
                          <td className="muted"><small>{txn.note}{txn.orderCode ? ` · ${txn.orderCode}` : ""}</small></td>
                          <td style={{ color: txn.kind === "debit" ? "var(--danger)" : "var(--accent-text)" }}>{txn.amount > 0 ? "+" : ""}{faMoney(txn.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!walletTxns.length && <div className="account-empty"><Wallet size={30} /><h3>تراکنشی ثبت نشده</h3><p>با خرید یا تبدیل امتیاز، اعتبار کیف پولت را ببین.</p></div>}
              </div>
            </div>
          )}

          {/* ---------- امتیازها ---------- */}
          {section === "points" && (
            <div className="account-section">
              <div className="account-card">
                <div className="admin-card-heading"><div><h2>سابقهٔ امتیازها</h2><p className="muted">مجموع امتیاز کسب‌شده: {customer.lifetimePoints.toLocaleString("fa-IR")}</p></div><span className="inline-badge">{customer.points.toLocaleString("fa-IR")} امتیاز</span></div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead><tr><th>تاریخ</th><th>دلیل</th><th>امتیاز</th></tr></thead>
                    <tbody>
                      {pointsLogs.map(log => (
                        <tr key={log.id}>
                          <td><small>{new Date(log.createdAt).toLocaleDateString("fa-IR")}</small></td>
                          <td className="muted"><small>{log.reason}{log.orderCode ? ` · ${log.orderCode}` : ""}</small></td>
                          <td style={{ color: log.points > 0 ? "var(--accent-text)" : "var(--danger)" }}>{log.points > 0 ? "+" : ""}{log.points.toLocaleString("fa-IR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!pointsLogs.length && <div className="account-empty"><Trophy size={30} /><h3>هنوز امتیازی نگردی</h3><p>با هر خرید و هر نظر امتیاز بگیر.</p></div>}
              </div>
            </div>
          )}

          {/* ---------- دعوت دوستان ---------- */}
          {section === "referral" && (
            <div className="account-section">
              <div className="account-card">
                <div className="admin-card-heading"><div><h2>دعوت دوستان</h2><p className="muted">با هر دوستی که با لینک تو عضو شود {pointsRules.referralRegister.toLocaleString("fa-IR")} امتیاز و با اولین خریدش {pointsRules.referralPurchase.toLocaleString("fa-IR")} امتیاز بگیر.</p></div></div>
                <div className="account-invite-box">
                  <InvertedCorner size={40} className="account-invite-corner" />
                  <div>
                    <span className="eyebrow">لینک اختصاصی تو</span>
                    <code dir="ltr">{inviteLink}</code>
                  </div>
                  <button className="button button-lime" onClick={() => { navigator.clipboard?.writeText(inviteLink); toast("لینک کپی شد."); }}>
                    <Copy size={16} />کپی لینک
                  </button>
                </div>
                <div className="account-referral-stats">
                  <div><strong>{referrals.filter(r => r.status !== "clicked").length.toLocaleString("fa-IR")}</strong><span>ثبت‌نام با دعوت تو</span></div>
                  <div><strong>{referrals.filter(r => r.status === "purchased" || r.status === "rewarded").length.toLocaleString("fa-IR")}</strong><span>خرید دعوت‌شده‌ها</span></div>
                  <div><strong>{referrals.reduce((sum, r) => sum + r.rewardPoints, 0).toLocaleString("fa-IR")}</strong><span>امتیاز از دعوت</span></div>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead><tr><th>تاریخ</th><th>وضعیت</th><th>امتیاز</th></tr></thead>
                    <tbody>
                      {referrals.map(referral => (
                        <tr key={referral.id}>
                          <td><small>{new Date(referral.createdAt).toLocaleDateString("fa-IR")}</small></td>
                          <td className="muted"><small>{referral.status === "clicked" ? "کلیک روی لینک" : referral.status === "registered" ? "ثبت‌نام دوست" : referral.status === "purchased" ? "خرید دوست" : "پاداش داده شد"}</small></td>
                          <td>{referral.rewardPoints ? `+${referral.rewardPoints.toLocaleString("fa-IR")}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!referrals.length && <div className="account-empty"><Users size={30} /><h3>هنوز کسی با لینکت نیامده</h3><p>لینک را برای دوستانت بفرست.</p></div>}
              </div>
            </div>
          )}

          {/* ---------- اعلان‌ها ---------- */}
          {section === "notifications" && (
            <div className="account-section">
              <div className="account-card">
                <div className="admin-card-heading"><h2>اعلان‌ها</h2>{unread > 0 && <button className="button button-outline button-sm" disabled={busy} onClick={() => call("/api/customer/notifications", { action: "read-all" })}><Check size={15} />خواندن همه</button>}</div>
                {notifications.length ? (
                  <div className="account-notifications">
                    {notifications.map(item => (
                      <Link key={item.id} href={item.link || "/account/panel"} className={`account-notification ${item.read ? "" : "unread"}`}>
                        <span className="account-notification-dot" />
                        <div><strong>{item.title}</strong><p>{item.body}</p><small className="muted">{new Date(item.createdAt).toLocaleDateString("fa-IR")}</small></div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="account-empty"><Bell size={30} /><h3>اعلانی نداری</h3><p>از وضعیت سفارش و پاداش‌ها اینجا باخبر شو.</p></div>
                )}
                <PushCard phone={customer.phone} />
              </div>
            </div>
          )}

          {/* ---------- نظرات من ---------- */}
          {section === "reviews" && (
            <div className="account-section">
              <div className="account-card">
                <div className="admin-card-heading"><div><h2>نظرات من</h2><p className="muted">هر نظر تأییدشده {pointsRules.review.toLocaleString("fa-IR")} امتیاز دارد.</p></div></div>
                {reviews.length ? (
                  <div className="account-reviews">
                    {reviews.map(review => (
                      <article className="account-review" key={review.id}>
                        <div className="account-review-head">
                          <strong>{products.find(p => p.id === review.productId)?.name ?? "محصول"}</strong>
                          <span className="account-review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                          <span className={`status-badge ${review.approved ? "status-delivered" : "status-pending"}`}>{review.approved ? "منتشرشده" : "در انتظار تأیید"}</span>
                        </div>
                        <p>{review.text}</p>
                        <small className="muted">{new Date(review.createdAt).toLocaleDateString("fa-IR")}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="account-empty"><Star size={30} /><h3>هنوز نظری ننوشتی</h3><p>تجربه‌ات از خرید را با دیگران به اشتراک بگذار.</p></div>
                )}
              </div>
            </div>
          )}

          {/* ---------- پشتیبانی ---------- */}
          {section === "support" && (
            <div className="account-section">
              <div className="account-card">
                <div className="admin-card-heading"><h2>پشتیبانی</h2></div>
                <div className="account-support">
                  <div>
                    <h3>پیام به پشتیبانی</h3>
                    <p className="muted">برای سایز، سفارش یا هر سوالی، پیام بگذار؛ تیم کیا پاسخ می‌دهد.</p>
                    <SupportForm />
                  </div>
                  <div className="account-support-side">
                    <h3>راه‌های سریع</h3>
                    <Link className="text-link" href="/track">پیگیری سفارش<ArrowUpLeft size={15} /></Link>
                    <Link className="text-link" href="/guide">راهنمای سایز<ArrowUpLeft size={15} /></Link>
                    <Link className="text-link" href="/daily">مجلهٔ مد<ArrowUpLeft size={15} /></Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------- کوپن‌های من ---------- */}
          {section === "coupons" && (
            <div className="account-section">
              <div className="account-card">
                <div className="admin-card-heading"><div><h2>کوپن‌های من</h2><p className="muted">کدهای تخفیف باشگاه مشتریان.</p></div></div>
                <div className="account-coupons">
                  {meta.welcomeCoupon > 0 ? (
                    <div className="account-coupon" style={{ borderColor: meta.color }}>
                      <span className="account-coupon-percent" style={{ background: meta.color }}>{meta.welcomeCoupon.toLocaleString("fa-IR")}٪</span>
                      <div><strong>کد تخفیف سطح {meta.name}</strong><p>برای سفارش بعدی‌ات در تسویه وارد کن.</p></div>
                    </div>
                  ) : (
                    <div className="account-empty"><TicketPercent size={30} /><h3>کوپنی نداری</h3><p>با ارتقا در باشگاه مشتریان، کد تخفیف می‌گیری.</p></div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  نشانی‌ها
 * ============================================================ */
function AddressesSection({ customer, busy, call }: { customer: Customer; busy: boolean; call: (url: string, payload: Record<string, unknown>) => Promise<boolean> }) {
  const [form, setForm] = useState({ id: "", label: "", receiver: "", phone: "", city: "", address: "", postalCode: "" });
  const [open, setOpen] = useState(false);
  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  function edit(address: Customer["addresses"][number]) {
    setForm({ id: address.id, label: address.label, receiver: address.receiver, phone: address.phone, city: address.city, address: address.address, postalCode: address.postalCode });
    setOpen(true);
  }

  return (
    <div className="account-section">
      <div className="account-card">
        <div className="admin-card-heading"><h2>نشانی‌های من</h2><button className="button button-lime button-sm" onClick={() => { setForm({ id: "", label: "", receiver: "", phone: "", city: "", address: "", postalCode: "" }); setOpen(true); }}><MapPin size={15} />نشانی جدید</button></div>
        {customer.addresses.length ? (
          <div className="account-addresses">
            {customer.addresses.map(address => (
              <article className="account-address" key={address.id}>
                <div className="account-address-head"><strong>{address.label}</strong><span className="muted">{address.receiver}</span></div>
                <p>{address.city}، {address.address}</p>
                <small className="muted" dir="ltr">{address.phone} · {address.postalCode}</small>
                <div className="table-actions">
                  <button className="icon-button" aria-label={`ویرایش ${address.label}`} onClick={() => edit(address)}><RefreshCw size={15} /></button>
                  <button className="icon-button danger-action" aria-label={`حذف ${address.label}`} disabled={busy} onClick={() => call("/api/customer/profile", { action: "address.delete", id: address.id })}><LogOut size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="account-empty"><MapPin size={30} /><h3>نشانی‌ای ذخیره نکردی</h3><p>نشانی‌ات را ذخیره کن تا تسویه سریع‌تر باشد.</p></div>
        )}

        {open && (
          <form className="account-address-form" onSubmit={async (e: FormEvent) => { e.preventDefault(); if (await call("/api/customer/profile", { action: "address.save", ...form })) setOpen(false); }}>
            <div className="form-grid">
              <label>نام نشانی<input maxLength={30} value={form.label} onChange={e => set("label", e.target.value)} placeholder="خانه / محل کار" /></label>
              <label>نام گیرنده<input required maxLength={60} value={form.receiver} onChange={e => set("receiver", e.target.value)} /></label>
              <label>شمارهٔ گیرنده<input required dir="ltr" inputMode="numeric" maxLength={11} value={form.phone} onChange={e => set("phone", e.target.value.replace(/[^\d]/g, ""))} placeholder="09xxxxxxxxx" /></label>
              <label>شهر<input required maxLength={40} value={form.city} onChange={e => set("city", e.target.value)} /></label>
              <label className="full-width">نشانی کامل<input required maxLength={300} value={form.address} onChange={e => set("address", e.target.value)} placeholder="خیابان، کوچه، پلاک، واحد" /></label>
              <label>کد پستی<input required dir="ltr" inputMode="numeric" maxLength={10} value={form.postalCode} onChange={e => set("postalCode", e.target.value.replace(/[^\d]/g, ""))} /></label>
            </div>
            <div className="admin-form-footer">
              <button type="button" className="button button-outline" onClick={() => setOpen(false)}>انصراف</button>
              <button className="button button-lime" disabled={busy}>ذخیرهٔ نشانی</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 *  فرم پیام پشتیبانی
 * ============================================================ */
function SupportForm() {
  const { toast } = useShop();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) { toast(data.error || "ارسال نشد.", "error"); return; }
      toast("پیام شما ثبت شد.");
      setForm({ name: "", phone: "", message: "" });
    } catch { toast("ارتباط با سرور برقرار نشد.", "error"); }
    finally { setBusy(false); }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <label>نام شما<input required maxLength={60} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>شمارهٔ موبایل<input required dir="ltr" inputMode="numeric" maxLength={11} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^\d]/g, "") })} placeholder="09xxxxxxxxx" /></label>
      <label>پیام شما<textarea required rows={4} maxLength={1000} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></label>
      <button className="button button-lime" disabled={busy}>ارسال پیام<ArrowLeft size={16} /></button>
    </form>
  );
}

/* ============================================================
 *  صفحهٔ دعوت (invite) — ثبت کلیک و هدایت به فروشگاه
 * ============================================================ */
export function InviteLanding({ code, valid }: { code: string; valid: boolean }) {
  useEffect(() => {
    if (!valid) return;
    void fetch(`/api/referral/${encodeURIComponent(code)}`, { method: "POST" }).catch(() => {});
  }, [code, valid]);
  return (
    <div className="invite-page">
      <div className="container invite-card">
        <span className="invite-icon"><Gift size={34} /></span>
        <span className="eyebrow">دعوت‌نامهٔ کیا</span>
        <h1>{valid ? "دعوت‌شدهٔ یک دوست خوبی!" : "این لینک دعوت معتبر نیست"}</h1>
        <p>{valid ? "یک دوست از کیا تو رو دعوت کرده. با این لینک عضو شو تا هم تو و هم دوستت امتیاز هدیه بگیرید؛ ثبت‌نام فقط با شمارهٔ موبایل است." : "کد دعوت پیدا نشد. می‌توانید مستقیم وارد فروشگاه شوید."}</p>
        <div className="invite-actions">
          <Link className="button button-lime" href="/account">ساخت حساب با دعوت<ArrowLeft size={17} /></Link>
          <Link className="button button-outline" href="/shop">ورود به فروشگاه<ArrowUpLeft size={16} /></Link>
        </div>
        {valid && <small className="muted" dir="ltr">{code}</small>}
      </div>
    </div>
  );
}
