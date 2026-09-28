"use client";
import { useState, type FormEvent } from "react";
import { Images, Flame, TrendingUp, ShoppingBag, Star, MessageCircleQuestion, Plus, Pencil, Trash2, Check, X, Eye, EyeOff, Save } from "lucide-react";
import { type Product, money } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { EmptyState } from "./ui";

/* ============================================================
 *  مدیریت ویترین v2 از پنل — بدون هیچ ویرایش کدی
 * ============================================================ */

type Slide = { id: number; eyebrow: string; title: string; accent: string; description: string; image: string; button: string; link: string; label: string; mobileImage: string; startsAt: string | null; endsAt: string | null; position: number; active: boolean };
type Flash = { id: number; title: string; subtitle: string; productIds: number[]; endsAt: string; active: boolean };
type Trend = { id: number; title: string; subtitle: string; productIds: number[]; position: number; active: boolean };
type Look = { id: number; title: string; description: string; image: string; productIds: number[]; position: number; active: boolean };
type Review = { id: number; productId: number; name: string; rating: number; text: string; image: string; approved: boolean; createdAt: string };
type Question = { id: number; productId: number; name: string; question: string; answer: string; approved: boolean; createdAt: string };

type Props = {
  slides: Slide[]; flashSales: Flash[]; trends: Trend[]; looks: Look[];
  products: Product[]; saving: boolean;
  onMutate: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
};

const emptySlide: Slide = { id: 0, eyebrow: "", title: "", accent: "", description: "", image: "/images/hero-belt.webp", button: "مشاهده", link: "/shop", label: "", mobileImage: "", startsAt: null, endsAt: null, position: 0, active: true };
const emptyFlash: Flash = { id: 0, title: "", subtitle: "", productIds: [], endsAt: "", active: true };
const emptyTrend: Trend = { id: 0, title: "", subtitle: "", productIds: [], position: 0, active: true };
const emptyLook: Look = { id: 0, title: "", description: "", image: "/images/hero-belt.webp", productIds: [], position: 0, active: true };

const toLocalInput = (iso: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function StorefrontEditor({ slides, flashSales, trends, looks, products, saving, onMutate }: Props) {
  const [section, setSection] = useState<"slides" | "flash" | "trends" | "looks">("slides");
  const [editingSlide, setEditingSlide] = useState<Slide | "new" | null>(null);
  const [editingFlash, setEditingFlash] = useState<Flash | "new" | null>(null);
  const [editingTrend, setEditingTrend] = useState<Trend | "new" | null>(null);
  const [editingLook, setEditingLook] = useState<Look | "new" | null>(null);

  const sections = [
    { id: "slides", title: "اسلایدهای بنر", icon: Images, count: slides.length },
    { id: "flash", title: "فروش ویژهٔ زمان‌دار", icon: Flame, count: flashSales.length },
    { id: "trends", title: "ترندهای امروز", icon: TrendingUp, count: trends.length },
    { id: "looks", title: "ست‌ها (Shop the Look)", icon: ShoppingBag, count: looks.length },
  ] as const;

  const productName = (id: number) => products.find(p => p.id === id)?.name ?? `#${id}`;

  return (
    <div className="admin-storefront">
      <div className="admin-subtabs" role="tablist" aria-label="بخش‌های ویترین">
        {sections.map(item => (
          <button key={item.id} role="tab" aria-selected={section === item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
            <item.icon size={16} />{item.title}<b>{item.count.toLocaleString("fa-IR")}</b>
          </button>
        ))}
      </div>

      {/* ---------- اسلایدها ---------- */}
      {section === "slides" && (
        <section className="admin-card">
          <div className="admin-card-heading">
            <div><h2>اسلایدهای بنر اصلی</h2><p className="muted">هر اسلاید یک بنر کامل در صفحهٔ خانه است. اگر هیچ اسلاید فعالی نباشد، بنر پیش‌فرض نمایش داده می‌شود.</p></div>
            <button className="button button-lime" onClick={() => setEditingSlide("new")}><Plus size={16} />اسلاید جدید</button>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>بنر</th><th>عنوان</th><th>لینک</th><th>ترتیب</th><th>وضعیت</th><th>مدیریت</th></tr></thead>
              <tbody>
                {slides.map(slide => (
                  <tr key={slide.id}>
                    <td><div className="table-product"><img src={slide.image} alt="" width="47" height="47" /><span><strong>{slide.eyebrow || "—"}</strong><small dir="ltr">{slide.label}</small></span></div></td>
                    <td><strong>{slide.title}</strong><br /><em style={{ color: "var(--accent-text)" }}>{slide.accent}</em></td>
                    <td dir="ltr">{slide.link}</td>
                    <td>{slide.position.toLocaleString("fa-IR")}</td>
                    <td><span className={`status-badge ${slide.active ? "status-delivered" : "status-cancelled"}`}>{slide.active ? "فعال" : "پنهان"}</span></td>
                    <td><div className="table-actions">
                      <button className="icon-button" aria-label={`ویرایش اسلاید ${slide.title}`} onClick={() => setEditingSlide(slide)}><Pencil size={16} /></button>
                      <button className="icon-button" aria-label={slide.active ? `پنهان‌کردن ${slide.title}` : `فعال‌کردن ${slide.title}`} disabled={saving} onClick={() => onMutate("slide.save", { slide: { ...slide, active: !slide.active } })}>{slide.active ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      <button className="icon-button danger-action" aria-label={`حذف اسلاید ${slide.title}`} disabled={saving} onClick={() => { if (window.confirm("این اسلاید حذف شود؟")) void onMutate("slide.delete", { id: slide.id }); }}><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!slides.length && <EmptyState icon={<Images size={30} />} title="اسلایدی ثبت نشده" text="یک بنر تازه بساز تا ویترینت شخصی‌تر شود." />}
        </section>
      )}

      {/* ---------- فروش ویژه ---------- */}
      {section === "flash" && (
        <section className="admin-card">
          <div className="admin-card-heading">
            <div><h2>فروش ویژهٔ زمان‌دار</h2><p className="muted">کاونت‌داکن از زمان پایان واقعی محاسبه می‌شود؛ پس از پایان، بخش خودکار از ویترین حذف می‌شود.</p></div>
            <button className="button button-lime" onClick={() => setEditingFlash("new")}><Plus size={16} />فروش ویژه جدید</button>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>عنوان</th><th>محصولات</th><th>پایان</th><th>وضعیت</th><th>مدیریت</th></tr></thead>
              <tbody>
                {flashSales.map(flash => (
                  <tr key={flash.id}>
                    <td><strong>{flash.title}</strong><br /><small className="muted">{flash.subtitle}</small></td>
                    <td>{flash.productIds.map(productName).join("، ") || "—"}</td>
                    <td>{new Date(flash.endsAt).toLocaleString("fa-IR")}</td>
                    <td>
                      <span className={`status-badge ${flash.active && new Date(flash.endsAt) > new Date() ? "status-delivered" : "status-cancelled"}`}>
                        {!flash.active ? "غیرفعال" : new Date(flash.endsAt) > new Date() ? "در جریان" : "پایان‌یافته"}
                      </span>
                    </td>
                    <td><div className="table-actions">
                      <button className="icon-button" aria-label={`ویرایش ${flash.title}`} onClick={() => setEditingFlash(flash)}><Pencil size={16} /></button>
                      <button className="icon-button danger-action" aria-label={`حذف ${flash.title}`} disabled={saving} onClick={() => { if (window.confirm("این فروش ویژه حذف شود؟")) void onMutate("flash.delete", { id: flash.id }); }}><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!flashSales.length && <EmptyState icon={<Flame size={30} />} title="فروش ویژه‌ای فعال نیست" text="با یک فروش ویژهٔ زمان‌دار، حس فوریت برای مشتری می‌سازی." />}
        </section>
      )}

      {/* ---------- ترندها ---------- */}
      {section === "trends" && (
        <section className="admin-card">
          <div className="admin-card-heading">
            <div><h2>ترندهای امروز</h2><p className="muted">رنگ، مد، جنس یا استایل داغ این فصل را به محصولاتش وصل کن.</p></div>
            <button className="button button-lime" onClick={() => setEditingTrend("new")}><Plus size={16} />ترند جدید</button>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>ترند</th><th>توضیح</th><th>محصولات</th><th>ترتیب</th><th>مدیریت</th></tr></thead>
              <tbody>
                {trends.map(trend => (
                  <tr key={trend.id}>
                    <td><strong>{trend.title}</strong></td>
                    <td className="muted">{trend.subtitle || "—"}</td>
                    <td>{trend.productIds.map(productName).join("، ") || "—"}</td>
                    <td>{trend.position.toLocaleString("fa-IR")}</td>
                    <td><div className="table-actions">
                      <button className="icon-button" aria-label={`ویرایش ${trend.title}`} onClick={() => setEditingTrend(trend)}><Pencil size={16} /></button>
                      <button className="icon-button danger-action" aria-label={`حذف ${trend.title}`} disabled={saving} onClick={() => { if (window.confirm("این ترند حذف شود؟")) void onMutate("trend.delete", { id: trend.id }); }}><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!trends.length && <EmptyState icon={<TrendingUp size={30} />} title="ترندی ثبت نشده" text="بخش «ترندهای امروز» در ویترین نمایش داده می‌شود." />}
        </section>
      )}

      {/* ---------- ست‌ها ---------- */}
      {section === "looks" && (
        <section className="admin-card">
          <div className="admin-card-heading">
            <div><h2>ست‌ها — Shop the Look</h2><p className="muted">مشتری با یک کلیک، همهٔ اقلام ست را به سبد اضافه می‌کند.</p></div>
            <button className="button button-lime" onClick={() => setEditingLook("new")}><Plus size={16} />ست جدید</button>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>ست</th><th>محصولات</th><th>مجموع</th><th>مدیریت</th></tr></thead>
              <tbody>
                {looks.map(look => {
                  const total = look.productIds.reduce((sum, id) => sum + (products.find(p => p.id === id)?.price ?? 0), 0);
                  return (
                    <tr key={look.id}>
                      <td><div className="table-product"><img src={look.image} alt="" width="47" height="47" /><span><strong>{look.title}</strong><small>{look.description}</small></span></div></td>
                      <td>{look.productIds.map(productName).join("، ") || "—"}</td>
                      <td><strong>{money(total)}</strong> تومان</td>
                      <td><div className="table-actions">
                        <button className="icon-button" aria-label={`ویرایش ${look.title}`} onClick={() => setEditingLook(look)}><Pencil size={16} /></button>
                        <button className="icon-button danger-action" aria-label={`حذف ${look.title}`} disabled={saving} onClick={() => { if (window.confirm("این ست حذف شود؟")) void onMutate("look.delete", { id: look.id }); }}><Trash2 size={16} /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!looks.length && <EmptyState icon={<ShoppingBag size={30} />} title="ستی ساخته نشده" text="با «Shop the Look» میانگین سبد خرید را بالا می‌بری." />}
        </section>
      )}

      {/* ---------- مودال‌ها ---------- */}
      {editingSlide && <SlideModal slide={editingSlide === "new" ? emptySlide : editingSlide} saving={saving} onClose={() => setEditingSlide(null)} onSave={async slide => { if (await onMutate("slide.save", { slide })) setEditingSlide(null); }} />}
      {editingFlash && <FlashModal flash={editingFlash === "new" ? emptyFlash : editingFlash} saving={saving} products={products} onClose={() => setEditingFlash(null)} onSave={async flash => { if (await onMutate("flash.save", { flash })) setEditingFlash(null); }} />}
      {editingTrend && <TrendModal trend={editingTrend === "new" ? emptyTrend : editingTrend} saving={saving} products={products} onClose={() => setEditingTrend(null)} onSave={async trend => { if (await onMutate("trend.save", { trend })) setEditingTrend(null); }} />}
      {editingLook && <LookModal look={editingLook === "new" ? emptyLook : editingLook} saving={saving} products={products} onClose={() => setEditingLook(null)} onSave={async look => { if (await onMutate("look.save", { look })) setEditingLook(null); }} />}
    </div>
  );
}

/* ============================================================
 *  انتخابگر محصول (چندانتخابی)
 * ============================================================ */
function ProductPicker({ selected, onChange, products }: { selected: number[]; onChange: (ids: number[]) => void; products: Product[] }) {
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <div className="product-picker">
      {products.filter(p => p.active).map(p => (
        <label key={p.id} className={selected.includes(p.id) ? "picker-chip selected" : "picker-chip"}>
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
          <img src={p.image} alt="" width="30" height="30" />
          <span>{p.name}</span>
        </label>
      ))}
      {!products.filter(p => p.active).length && <p className="muted">محصول فعالی وجود ندارد.</p>}
    </div>
  );
}

/* ---------- مودال اسلاید ---------- */
function SlideModal({ slide, saving, onClose, onSave }: { slide: Slide; saving: boolean; onClose: () => void; onSave: (slide: Slide) => Promise<void> }) {
  const [s, setS] = useState(slide);
  const set = <K extends keyof Slide>(key: K, value: Slide[K]) => setS(prev => ({ ...prev, [key]: value }));
  return (
    <form className="admin-modal-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void onSave(s); }}>
      <div className="form-grid">
        <label>لیبل کوچک بالا<input value={s.eyebrow} maxLength={60} onChange={e => set("eyebrow", e.target.value)} placeholder="کالکشن جدید کیا" /></label>
        <label>لیبل انگلیسی (اختیاری)<input dir="ltr" value={s.label} maxLength={60} onChange={e => set("label", e.target.value)} placeholder="THE SIGNATURE COLLECTION" /></label>
        <label>خط اول عنوان<input required maxLength={40} value={s.title} onChange={e => set("title", e.target.value)} placeholder="استایل تو،" /></label>
        <label>خط رنگی عنوان<input required maxLength={40} value={s.accent} onChange={e => set("accent", e.target.value)} placeholder="امضای تو." /></label>
        <label className="full-width">توضیح بنر<textarea rows={3} maxLength={250} value={s.description} onChange={e => set("description", e.target.value)} /></label>
        <label>متن دکمه<input required maxLength={35} value={s.button} onChange={e => set("button", e.target.value)} /></label>
        <label>مسیر دکمه<input required dir="ltr" value={s.link} onChange={e => set("link", e.target.value)} placeholder="/shop?category=belts" /></label>
        <label>ترتیب نمایش<input type="number" min="0" max="50" value={s.position} onChange={e => set("position", Number(e.target.value))} /></label>
        <label className="editor-check"><input type="checkbox" checked={s.active} onChange={e => set("active", e.target.checked)} />این اسلاید فعال باشد</label>
      </div>
      <ImageUrlField label="آدرس تصویر بنر" value={s.image} onChange={value => set("image", value)} />
      <ImageUrlField label="تصویر جداگانهٔ موبایل (اختیاری — خالی: همان تصویر اصلی)" value={s.mobileImage} onChange={value => set("mobileImage", value)} />
      {/* فاز ۱۳: کمپین زمان‌دار — خارج از بازه، بنر خودکار پنهان می‌شود */}
      <div className="form-grid">
        <label>شروع نمایش (اختیاری)<input type="datetime-local" value={toLocalDateTime(s.startsAt)} onChange={e => set("startsAt", e.target.value ? new Date(e.target.value).toISOString() : null)} /></label>
        <label>پایان نمایش (اختیاری)<input type="datetime-local" value={toLocalDateTime(s.endsAt)} onChange={e => set("endsAt", e.target.value ? new Date(e.target.value).toISOString() : null)} /></label>
      </div>
      <div className="admin-form-footer">
        <button type="button" className="button button-outline" onClick={onClose}><X size={16} />انصراف</button>
        <button className="button button-lime" disabled={saving}><Save size={17} />{saving ? "در حال ذخیره..." : "ذخیرهٔ اسلاید"}</button>
      </div>
    </form>
  );
}

/* ---------- مودال فروش ویژه ---------- */
function FlashModal({ flash, saving, products, onClose, onSave }: { flash: Flash; saving: boolean; products: Product[]; onClose: () => void; onSave: (flash: Flash) => Promise<void> }) {
  const [f, setF] = useState(flash);
  const set = <K extends keyof Flash>(key: K, value: Flash[K]) => setF(prev => ({ ...prev, [key]: value }));
  return (
    <form className="admin-modal-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void onSave({ ...f, endsAt: f.endsAt || new Date(Date.now() + 86400000).toISOString() }); }}>
      <div className="form-grid">
        <label>عنوان فروش ویژه<input required maxLength={80} value={f.title} onChange={e => set("title", e.target.value)} placeholder="فروش ویژهٔ امروز" /></label>
        <label>زمان پایان<input required type="datetime-local" value={toLocalInput(f.endsAt)} onChange={e => set("endsAt", e.target.value ? new Date(e.target.value).toISOString() : "")} /></label>
        <label className="full-width">زیرعنوان (اختیاری)<input maxLength={200} value={f.subtitle} onChange={e => set("subtitle", e.target.value)} placeholder="تا پایان امشب، با این قیمت‌ها" /></label>
        <label className="editor-check"><input type="checkbox" checked={f.active} onChange={e => set("active", e.target.checked)} />فعال باشد</label>
      </div>
      <fieldset className="picker-fieldset"><legend>محصولات این فروش ویژه ({f.productIds.length.toLocaleString("fa-IR")} انتخاب‌شده)</legend><ProductPicker products={products} selected={f.productIds} onChange={ids => set("productIds", ids)} /></fieldset>
      <div className="admin-form-footer">
        <button type="button" className="button button-outline" onClick={onClose}><X size={16} />انصراف</button>
        <button className="button button-lime" disabled={saving}><Save size={17} />{saving ? "در حال ذخیره..." : "ذخیرهٔ فروش ویژه"}</button>
      </div>
    </form>
  );
}

/* ---------- مودال ترند ---------- */
function TrendModal({ trend, saving, products, onClose, onSave }: { trend: Trend; saving: boolean; products: Product[]; onClose: () => void; onSave: (trend: Trend) => Promise<void> }) {
  const [t, setT] = useState(trend);
  const set = <K extends keyof Trend>(key: K, value: Trend[K]) => setT(prev => ({ ...prev, [key]: value }));
  return (
    <form className="admin-modal-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void onSave(t); }}>
      <div className="form-grid">
        <label>عنوان ترند<input required maxLength={80} value={t.title} onChange={e => set("title", e.target.value)} placeholder="طلاییِ امروز" /></label>
        <label>ترتیب<input type="number" min="0" max="50" value={t.position} onChange={e => set("position", Number(e.target.value))} /></label>
        <label className="full-width">توضیح کوتاه<input maxLength={200} value={t.subtitle} onChange={e => set("subtitle", e.target.value)} placeholder="داغ‌ترین رنگ این فصل" /></label>
        <label className="editor-check"><input type="checkbox" checked={t.active} onChange={e => set("active", e.target.checked)} />فعال باشد</label>
      </div>
      <fieldset className="picker-fieldset"><legend>محصولات این ترند</legend><ProductPicker products={products} selected={t.productIds} onChange={ids => set("productIds", ids)} /></fieldset>
      <div className="admin-form-footer">
        <button type="button" className="button button-outline" onClick={onClose}><X size={16} />انصراف</button>
        <button className="button button-lime" disabled={saving}><Save size={17} />{saving ? "در حال ذخیره..." : "ذخیرهٔ ترند"}</button>
      </div>
    </form>
  );
}

/* ---------- مودال ست ---------- */
function LookModal({ look, saving, products, onClose, onSave }: { look: Look; saving: boolean; products: Product[]; onClose: () => void; onSave: (look: Look) => Promise<void> }) {
  const [l, setL] = useState(look);
  const set = <K extends keyof Look>(key: K, value: Look[K]) => setL(prev => ({ ...prev, [key]: value }));
  return (
    <form className="admin-modal-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void onSave(l); }}>
      <div className="form-grid">
        <label>عنوان ست<input required maxLength={80} value={l.title} onChange={e => set("title", e.target.value)} placeholder="THE BLACK LOOK" /></label>
        <label>ترتیب<input type="number" min="0" max="50" value={l.position} onChange={e => set("position", Number(e.target.value))} /></label>
        <label className="full-width">توضیح ست<textarea rows={2} maxLength={400} value={l.description} onChange={e => set("description", e.target.value)} /></label>
      </div>
      <ImageUrlField label="آدرس تصویر ست" value={l.image} onChange={value => set("image", value)} />
      <fieldset className="picker-fieldset"><legend>اقلام این ست</legend><ProductPicker products={products} selected={l.productIds} onChange={ids => set("productIds", ids)} /></fieldset>
      <div className="admin-form-footer">
        <button type="button" className="button button-outline" onClick={onClose}><X size={16} />انصراف</button>
        <button className="button button-lime" disabled={saving}><Save size={17} />{saving ? "در حال ذخیره..." : "ذخیرهٔ ست"}</button>
      </div>
    </form>
  );
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ImageUrlField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const samples = ["/images/hero-belt.webp", "/images/hero-jewelry.webp", "/images/product-belt.webp", "/images/product-chain.webp", "/images/product-gift.webp"];
  return (
    <div className="image-url-block">
      <label>{label}<input dir="ltr" value={value} onChange={e => onChange(e.target.value)} placeholder="/images/hero-belt.webp" /></label>
      <div className="sample-images">
        {samples.map(url => <button type="button" key={url} className={value === url ? "selected" : ""} aria-label={`انتخاب ${url}`} onClick={() => onChange(url)}><img src={url} alt="نمونه" width="52" height="52" /></button>)}
      </div>
      <small className="muted">برای تصویر اختصاصی، از کتابخانهٔ رسانه در بخش محصولات استفاده کن و آدرس آن را اینجا بچسبان.</small>
    </div>
  );
}

/* ============================================================
 *  بازخورد مشتریان — نظرات و پرسش‌ها
 * ============================================================ */
export function FeedbackEditor({ reviews, questions, products, saving, onMutate }: { reviews: Review[]; questions: Question[]; products: Product[]; saving: boolean; onMutate: (action: string, payload: Record<string, unknown>) => Promise<boolean> }) {
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const productName = (id: number) => products.find(p => p.id === id)?.name ?? `#${id}`;
  const pendingReviews = reviews.filter(r => !r.approved);
  const pendingQuestions = questions.filter(q => !q.approved || !q.answer);

  return (
    <div className="admin-feedback">
      <section className="admin-card">
        <div className="admin-card-heading">
          <div><h2>نظرات در انتظار تأیید</h2><p className="muted">هر نظری تنها پس از تأیید تو در صفحهٔ محصول نمایش داده می‌شود.</p></div>
          <span className="inline-badge">{pendingReviews.length.toLocaleString("fa-IR")} نظر جدید</span>
        </div>
        {pendingReviews.length ? pendingReviews.map(review => (
          <article className="feedback-card" key={review.id}>
            <div className="feedback-heading">
              <span className="message-avatar">{review.name.slice(0, 1)}</span>
              <div><h3>{review.name}</h3><small>{productName(review.productId)} · {new Date(review.createdAt).toLocaleDateString("fa-IR")}</small></div>
              <span className="star-row" aria-label={`امتیاز ${review.rating} از ۵`}>
                {[1, 2, 3, 4, 5].map(star => <Star key={star} size={15} fill={star <= review.rating ? "currentColor" : "none"} />)}
              </span>
            </div>
            <p>{review.text}</p>
            {review.image && <a href={review.image} target="_blank" rel="noreferrer" className="text-link"><Eye size={15} />مشاهدهٔ تصویر نظردهنده</a>}
            <div className="feedback-actions">
              <button className="button button-lime" disabled={saving} onClick={() => onMutate("review.approve", { id: review.id })}><Check size={15} />تأیید و انتشار</button>
              <button className="button button-outline" disabled={saving} onClick={() => { if (window.confirm("این نظر حذف شود؟")) void onMutate("review.delete", { id: review.id }); }}><Trash2 size={15} />حذف</button>
            </div>
          </article>
        )) : <EmptyState icon={<Star size={30} />} title="نظر جدیدی نیست" text="نظرات تأییدشده در صفحهٔ محصول‌ها نمایش داده می‌شوند." />}
      </section>

      <section className="admin-card">
        <div className="admin-card-heading">
          <div><h2>پرسش‌های مشتریان</h2><p className="muted">پاسخ تو مستقیماً در صفحهٔ محصول منتشر می‌شود.</p></div>
          <span className="inline-badge">{pendingQuestions.length.toLocaleString("fa-IR")} بدون پاسخ</span>
        </div>
        {questions.length ? questions.map(question => (
          <article className="feedback-card" key={question.id}>
            <div className="feedback-heading">
              <span className="message-avatar"><MessageCircleQuestion size={18} /></span>
              <div><h3>{question.name}</h3><small>{productName(question.productId)} · {new Date(question.createdAt).toLocaleDateString("fa-IR")}</small></div>
              {question.approved && question.answer && <span className="status-badge status-delivered">منتشرشده</span>}
            </div>
            <p><strong>پرسش:</strong> {question.question}</p>
            {question.answer && <p className="answer-text"><strong>پاسخ:</strong> {question.answer}</p>}
            <div className="answer-row">
              <input value={answerDrafts[question.id] ?? question.answer ?? ""} onChange={e => setAnswerDrafts(prev => ({ ...prev, [question.id]: e.target.value }))} placeholder="پاسخ تو به این پرسش..." aria-label={`پاسخ به ${question.name}`} maxLength={2000} />
              <button className="button button-lime" disabled={saving || !(answerDrafts[question.id] ?? question.answer ?? "").trim()} onClick={() => onMutate("question.save", { id: question.id, answer: (answerDrafts[question.id] ?? question.answer ?? "").trim() })}><Save size={15} />ثبت پاسخ</button>
              <button className="icon-button danger-action" aria-label={`حذف پرسش ${question.name}`} disabled={saving} onClick={() => { if (window.confirm("این پرسش حذف شود؟")) void onMutate("question.delete", { id: question.id }); }}><Trash2 size={16} /></button>
            </div>
          </article>
        )) : <EmptyState icon={<MessageCircleQuestion size={30} />} title="پرسشی ثبت نشده" text="پرسش‌های مشتریان از صفحهٔ محصول اینجا جمع می‌شوند." />}
      </section>
    </div>
  );
}
