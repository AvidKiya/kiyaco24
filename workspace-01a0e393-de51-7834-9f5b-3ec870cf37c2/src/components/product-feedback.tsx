"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Star, Ruler, MessageCircleQuestion, ThumbsUp, Send, Check, Clock3, ImageIcon } from "lucide-react";
import { type Product, money } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { reviewSummary, type Review, type Question } from "@/lib/storefront-types";
import { EmptyState } from "./ui";

/* ============================================================
 *  ماشین‌حساب سایز کمربند
 * ============================================================ */
export function BeltSizeCalculator({ product }: { product: Product }) {
  const [waist, setWaist] = useState("");
  const numericSizes = product.sizes.map(Number).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const value = Number(waist.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));

  let suggested: number | null = null;
  if (waist && Number.isFinite(value) && value > 40 && value < 200) {
    // کمربند معمولاً ۱۰ تا ۱۵ سانتی‌متر بلندتر از دور کمر مناسب است
    const target = value + 12;
    suggested = numericSizes.find(size => size >= target) ?? numericSizes[numericSizes.length - 1] ?? null;
  }

  if (!numericSizes.length) return null;

  return (
    <div className="size-calculator">
      <div className="calculator-heading">
        <Ruler size={19} />
        <div>
          <strong>سایزت را مطمئن نیستی؟</strong>
          <p>دور کمرت را وارد کن تا سایز مناسب را پیشنهاد دهیم.</p>
        </div>
      </div>
      <div className="calculator-row">
        <label htmlFor="waist-input">دور کمر (سانتی‌متر)
          <input id="waist-input" type="text" inputMode="numeric" value={waist} onChange={e => setWaist(e.target.value)} placeholder="مثلاً ۹۵" maxLength={3} />
        </label>
        {suggested !== null ? (
          <output className="calculator-result">
            <span>سایز پیشنهادی کیا</span>
            <strong>{suggested.toLocaleString("fa-IR")}</strong>
            <small>حدود {Math.round(value + 12)} سانتی‌متر — دور کمر شما به‌علاوهٔ ۱۲ سانتی‌متر راحتی</small>
          </output>
        ) : (
          <p className="calculator-hint">روی شلوار خود از ناحیهٔ کمر اندازه بگیرید و عدد را وارد کنید.</p>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 *  نظرات محصول
 * ============================================================ */
function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-input" role="radiogroup" aria-label="امتیاز شما">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star.toLocaleString("fa-IR")} ستاره`} className={(hover || value) >= star ? "active" : ""} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)} onClick={() => onChange(star)}>
          <Star size={22} fill={(hover || value) >= star ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ product, reviews }: { product: Product; reviews: Review[] }) {
  const { toast } = useShop();
  const [form, setForm] = useState({ name: "", rating: 5, text: "" });
  const [sending, setSending] = useState(false);
  const summary = reviewSummary(reviews);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "review", productId: product.id, ...form }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast(result.message || "نظر شما ثبت شد.");
      setForm({ name: "", rating: 5, text: "" });
    } catch (error) {
      toast(error instanceof Error ? error.message : "ثبت نظر انجام نشد.", "error");
    } finally { setSending(false); }
  }

  return (
    <section className="product-feedback" id="reviews">
      <div className="feedback-section-heading">
        <div>
          <span className="eyebrow">CUSTOMER VOICES</span>
          <h2>نظرات مشتریان</h2>
        </div>
        {summary.count > 0 && (
          <div className="rating-summary">
            <strong>{summary.average.toLocaleString("fa-IR")}</strong>
            <span className="star-row">{[1, 2, 3, 4, 5].map(s => <Star key={s} size={15} fill={s <= Math.round(summary.average) ? "currentColor" : "none"} />)}</span>
            <small>{summary.count.toLocaleString("fa-IR")} نظر تأییدشده</small>
          </div>
        )}
      </div>

      {reviews.length ? (
        <div className="review-list">
          {reviews.map(review => (
            <article className="review-card" key={review.id}>
              <div className="review-heading">
                <span className="message-avatar">{review.name.slice(0, 1)}</span>
                <div><h3>{review.name}</h3><small>{new Date(review.createdAt).toLocaleDateString("fa-IR")}</small></div>
                <span className="star-row">{[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} fill={s <= review.rating ? "currentColor" : "none"} />)}</span>
              </div>
              <p>{review.text}</p>
              {review.image && <a href={review.image} target="_blank" rel="noreferrer" className="review-photo"><ImageIcon size={15} />تصویر نظردهنده</a>}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Star size={30} />} title="اولین نظر را تو بنویس" text="تجربهٔ تو از این محصول، به بقیه کمک می‌کند تا بهتر انتخاب کنند." />
      )}

      <form className="feedback-form" onSubmit={submit}>
        <h3>نظرت را بنویس</h3>
        <div className="form-grid">
          <label>نام شما<input required minLength={2} maxLength={60} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="نام یا نام نمایشی" /></label>
          <div className="rating-field"><span>امتیاز شما</span><StarInput value={form.rating} onChange={rating => setForm(f => ({ ...f, rating }))} /></div>
        </div>
        <label>تجربهٔ تو از این محصول<textarea required minLength={10} maxLength={1200} rows={4} value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="کیفیت، سایز، بسته‌بندی و هر چیزی که برای دیگران مفید است..." /></label>
        <div className="feedback-form-footer">
          <small><Clock3 size={13} />نظر شما پس از تأیید فروشگاه نمایش داده می‌شود.</small>
          <button className="button button-lime" disabled={sending}><Send size={16} />{sending ? "در حال ثبت..." : "ثبت نظر"}</button>
        </div>
      </form>
    </section>
  );
}

/* ============================================================
 *  پرسش و پاسخ محصول
 * ============================================================ */
export function ProductQuestions({ product, questions }: { product: Product; questions: Question[] }) {
  const { toast } = useShop();
  const [form, setForm] = useState({ name: "", question: "" });
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "question", productId: product.id, ...form }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast(result.message || "پرسش شما ثبت شد.");
      setForm({ name: "", question: "" });
    } catch (error) {
      toast(error instanceof Error ? error.message : "ثبت پرسش انجام نشد.", "error");
    } finally { setSending(false); }
  }

  return (
    <section className="product-feedback" id="questions">
      <div className="feedback-section-heading">
        <div><span className="eyebrow">ASK BEFORE YOU BUY</span><h2>پرسش و پاسخ</h2></div>
      </div>

      {questions.length ? (
        <div className="question-list">
          {questions.map(item => (
            <article className="question-card" key={item.id}>
              <div className="question-heading">
                <span className="message-avatar"><MessageCircleQuestion size={18} /></span>
                <div><h3>{item.name} پرسید:</h3><p>{item.question}</p></div>
              </div>
              <div className="answer-block">
                <span className="answer-badge"><ThumbsUp size={14} />پاسخ کیا</span>
                <p>{item.answer}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<MessageCircleQuestion size={30} />} title="هنوز پرسشی نکرده‌اند" text="اگر دربارهٔ سایز، جنس یا ارسال سوالی داری، اینجا بپرس." />
      )}

      <form className="feedback-form" onSubmit={submit}>
        <h3>سوالت را بپرس</h3>
        <div className="form-grid">
          <label>نام شما<input required minLength={2} maxLength={60} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="نام یا نام نمایشی" /></label>
        </div>
        <label>پرسش شما<textarea required minLength={5} maxLength={800} rows={3} value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="مثلاً: این کمربند برای استایل رسمی هم مناسب است؟" /></label>
        <div className="feedback-form-footer">
          <small><Clock3 size={13} />پاسخ فروشگاه پس از بررسی، همین‌جا منتشر می‌شود.</small>
          <button className="button button-lime" disabled={sending}><Send size={16} />{sending ? "در حال ثبت..." : "ثبت پرسش"}</button>
        </div>
      </form>
    </section>
  );
}

/* ============================================================
 *  بازدیدهای اخیر مشتری
 * ============================================================ */
export function RecentlyViewed({ current }: { current: Product }) {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    try {
      const stored: Product[] = JSON.parse(localStorage.getItem("kiya-recent") || "[]");
      const others = Array.isArray(stored) ? stored.filter(p => p?.id !== current.id).slice(0, 6) : [];
      localStorage.setItem("kiya-recent", JSON.stringify([current, ...others].slice(0, 7)));
      setItems(others.slice(0, 4));
    } catch { /* حافظهٔ محلی در دسترس نبود */ }
  }, [current]);

  if (!items.length) return null;

  return (
    <section className="recently-viewed">
      <div className="feedback-section-heading">
        <div><span className="eyebrow">RECENTLY VIEWED</span><h2>اخیراً دیدی</h2></div>
      </div>
      <div className="recent-rail">
        {items.map(product => (
          <Link className="recent-card" key={product.id} href={`/product/${product.slug}`}>
            <img src={product.image} alt={product.name} width="160" height="160" loading="lazy" />
            <div><strong>{product.name}</strong><span className="price">{money(product.price)} <small>تومان</small></span></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function VerifiedBadge() {
  return <span className="inline-badge"><Check size={13} /> خرید تأییدشده</span>;
}
