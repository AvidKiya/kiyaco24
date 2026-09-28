"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { Sparkles, Send, X, Ruler, ChevronLeft, Wand2 } from "lucide-react";
import { type Product, money } from "@/lib/catalog";
import { ProductCard } from "./product";

/* ============================================================
 *  فاز ۱۱ — رابط‌های هوش مصنوعی سمت فروشگاه
 *  ۱) AiStylistWidget: چت شناور مشاور استایل
 *  ۲) SmartSizeAdvisor: پیشنهاد سایز روی صفحه محصول
 *  ۳) SmartSetSection: ست پیشنهادی هوشمند (مکمل‌ها)
 * ============================================================ */

type MiniProduct = { id: number; slug: string; name: string; price: number; compareAt: number | null; image: string; category: string; stock: number };
type ChatMessage = { role: "user" | "assistant"; content: string; products?: MiniProduct[] };

const quickPrompts = [
  "برای هدیه چی پیشنهاد می‌کنی؟ 🎁",
  "تا ۵۰۰ هزار تومان چی دارید؟",
  "برای استایل رسمی چی ست کنم؟",
  "یه ست کامل مشکی می‌خوام",
];

export function AiStylistWidget() {
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState("مشاور کیا");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    let alive = true;
    fetch("/api/ai/stylist").then(r => r.json()).then(data => {
      if (!alive) return;
      if (data.enabled) { setEnabled(true); setName(data.name || "مشاور کیا"); }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // رویداد سراسری: از جستجوی هدر یا هر جای دیگر، چت را با یک پیام باز کن
  useEffect(() => {
    const handler = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      setOpen(true);
      if (message) void send(message);
    };
    window.addEventListener("kiya:ai", handler);
    return () => window.removeEventListener("kiya:ai", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy, open]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMessages(prev => [...prev, { role: "user", content: message }]);
    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch("/api/ai/stylist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "پاسخی دریافت نشد.");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, products: data.products }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: error instanceof Error ? error.message : "الان نمی‌تونم جواب بدم؛ چند لحظه بعد دوباره امتحان کن 🙏" }]);
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(input); }

  if (!enabled) return null;
  return <>
    {!open && <button className="ai-fab" onClick={() => setOpen(true)} aria-label={`گفتگو با ${name}`}>
      <Sparkles size={22} /><span>{name}</span>
    </button>}
    {open && <div className="ai-chat" role="dialog" aria-label={`گفتگو با ${name}`}>
      <div className="ai-chat-head">
        <span className="ai-chat-avatar"><Sparkles size={17} /></span>
        <div><strong>{name}</strong><small>مشاور استایل کیا — همیشه آنلاین</small></div>
        <button className="icon-button" aria-label="بستن گفتگو" onClick={() => setOpen(false)}><X size={17} /></button>
      </div>
      <div className="ai-chat-body" ref={listRef}>
        {!messages.length && <div className="ai-chat-welcome">
          <p>سلام! من {name}‌ام ✨<br />بگو دنبال چه استایلی هستی، مناسبتش چیه و حدود بودجه‌ات چقدره تا بهترین‌ها رو از کالکشن کیا برات دست‌چین کنم.</p>
          <div className="ai-chips">{quickPrompts.map(prompt => <button key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div>
        </div>}
        {messages.map((message, index) => <div key={index} className={`ai-msg ${message.role}`}>
          <p>{message.content}</p>
          {!!message.products?.length && <div className="ai-msg-products">
            {message.products.map(p => <Link key={p.id} href={`/product/${p.slug}`} onClick={() => setOpen(false)}>
              <img src={p.image} alt="" width="46" height="46" />
              <span>{p.name}<small>{money(p.price)} تومان</small></span>
              <ChevronLeft size={15} />
            </Link>)}
          </div>}
        </div>)}
        {busy && <div className="ai-msg assistant typing"><span /><span /><span /></div>}
      </div>
      <form className="ai-chat-input" onSubmit={submit}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="مثلاً: برای هدیه تا ۱ میلیون چی دارید؟" maxLength={500} aria-label="پیام به مشاور استایل" />
        <button className="button button-lime" disabled={busy || input.trim().length < 2} aria-label="ارسال پیام"><Send size={17} /></button>
      </form>
    </div>}
  </>;
}

/* ------------------------------------------------------------
 *  پیشنهاد سایز هوشمند (گردنبند / دستبند / انگشتر)
 * ------------------------------------------------------------ */
export function SmartSizeAdvisor({ product }: { product: Product }) {
  const needsBody = product.category !== "rings";
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [usualSize, setUsualSize] = useState("");
  const [result, setResult] = useState<{ size: string; confidence: number; tip: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/ai/size", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, height: Number(height) || undefined, weight: Number(weight) || undefined, usualSize }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "محاسبه انجام نشد.");
      if (!data.size) { setError(data.tip || "اطلاعات بیشتری لازم است."); return; }
      setResult(data);
    } catch (err) { setError(err instanceof Error ? err.message : "محاسبه انجام نشد."); }
    finally { setBusy(false); }
  }

  return <section className="smart-size">
    <div className="smart-size-head"><Ruler size={20} /><div><h2>چه سایزی برای من مناسبه؟</h2><p>چند مشخصه بده تا سایز دقیق را همین‌جا حساب کنیم — بدون حدس و گمان.</p></div></div>
    <form onSubmit={submit}>
      {needsBody ? <>
        <label>قد (سانتی‌متر)<input type="number" inputMode="numeric" min={100} max={230} required value={height} onChange={e => setHeight(e.target.value)} placeholder="مثلاً ۱۷۵" /></label>
        <label>وزن (کیلوگرم)<input type="number" inputMode="numeric" min={30} max={200} required value={weight} onChange={e => setWeight(e.target.value)} placeholder="مثلاً ۷۵" /></label>
      </> : <label>سایز همیشگی انگشترت<input type="number" inputMode="numeric" min={4} max={15} required value={usualSize} onChange={e => setUsualSize(e.target.value)} placeholder="مثلاً ۹" /></label>}
      <button className="button button-outline" disabled={busy}>{busy ? "در حال محاسبه..." : "پیشنهاد بده"}<Wand2 size={16} /></button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <div className="smart-size-result">
      <strong>📏 سایز پیشنهادی: {money(Number(result.size)) || result.size}</strong>
      <span>✅ میزان اطمینان: {money(result.confidence)}٪</span>
      <p>💡 {result.tip}</p>
    </div>}
  </section>;
}

/* ------------------------------------------------------------
 *  ست پیشنهادی هوشمند — مکمل‌های محصول با دلیل
 * ------------------------------------------------------------ */
export function SmartSetSection({ product, products, quickView }: { product: Product; products: Product[]; quickView?: (p: Product) => void }) {
  const [complements, setComplements] = useState<{ id: number; reason: string }[] | null>(null);
  // کامپوننت با key محصول remount می‌شود؛ state اولیه null کافی است
  useEffect(() => {
    let alive = true;
    fetch(`/api/ai/recommend?productId=${product.id}`).then(r => r.json()).then(data => {
      if (alive && Array.isArray(data.complements)) setComplements(data.complements.map((c: { id: number; reason: string }) => ({ id: c.id, reason: c.reason })));
    }).catch(() => { if (alive) setComplements([]); });
    return () => { alive = false; };
  }, [product.id]);

  const byId = new Map(products.map(p => [p.id, p]));
  const smartPicks = (complements ?? []).map(c => ({ product: byId.get(c.id), reason: c.reason })).filter((c): c is { product: Product; reason: string } => !!c.product);
  const fallback = products.filter(p => p.id !== product.id).slice(0, 4);

  return <section className="related-products">
    <div className="section-heading"><div><span className="eyebrow">COMPLETE YOUR STYLE</span><h2><i />کنار هم، قشنگ‌تر می‌شن</h2></div>{!!smartPicks.length && <span className="smart-set-badge"><Sparkles size={14} />ست پیشنهادی برای {product.name}</span>}</div>
    <div className="product-grid">
      {(smartPicks.length ? smartPicks : fallback.map(p => ({ product: p, reason: "" }))).slice(0, 4).map(({ product: p, reason }) =>
        <div key={p.id} className="smart-set-item">
          <ProductCard product={p} onQuickView={quickView} />
          {reason && <p className="smart-set-reason"><Sparkles size={13} />{reason}</p>}
        </div>)}
    </div>
  </section>;
}
