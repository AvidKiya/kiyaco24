"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Newspaper, Plus, Pencil, Trash2, X, Save, Eye, Clock, CalendarClock, ShoppingBag } from "lucide-react";
import { type Product, money } from "@/lib/catalog";
import { dailySections, sectionMeta, slugify } from "@/lib/daily-types";
import { Modal, EmptyState } from "./ui";

/* ============================================================
 *  Fashion Daily — مدیریت روزنامهٔ دیجیتال از پنل
 * ============================================================ */

export type AdminArticle = {
  id: number; slug: string; section: string; title: string; kicker: string; excerpt: string;
  body: string; image: string; colorHex: string; author: string; readMinutes: number;
  editionDate: string; publishAt: string; productIds: number[]; shopLabel: string;
  position: number; active: boolean; createdAt: string;
};

const emptyArticle: AdminArticle = {
  id: 0, slug: "", section: "main-story", title: "", kicker: "", excerpt: "", body: "",
  image: "/images/hero-belt.webp", colorHex: "#D19B44", author: "تیم کیا", readMinutes: 3,
  editionDate: new Date().toISOString(), publishAt: new Date().toISOString(),
  productIds: [], shopLabel: "SHOP THE TREND", position: 0, active: true, createdAt: new Date().toISOString(),
};

const toLocalInput = (iso: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const bodyTemplate = `## زیرتیتر اول
این‌جا متن مطلب را بنویس. هر خط یک پاراگراف است و خط خالی پاراگراف‌ها را از هم جدا می‌کند.

> نقل‌قول برجسته با این شکل نوشته می‌شود.

[[product:1|برچسب دلخواه برای کارت محصول]]

## زیرتیتر دوم
ادامهٔ متن...`;

export function DailyEditor({ articles, products, saving, onMutate }: { articles: AdminArticle[]; products: Product[]; saving: boolean; onMutate: (action: string, payload: Record<string, unknown>) => Promise<boolean> }) {
  const [editing, setEditing] = useState<AdminArticle | "new" | null>(null);
  const productName = (id: number) => products.find(p => p.id === id)?.name ?? `#${id}`;
  const now = Date.now();
  const published = articles.filter(a => a.active && new Date(a.publishAt).getTime() <= now);

  return (
    <div className="daily-admin">
      <section className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>مطالب روزنامه ({money(articles.length)})</h2>
            <p className="muted">هر مطلب به یک سکشن از Fashion Daily وصل می‌شود. انتشار را می‌توانید برای آینده زمان‌بندی کنید.</p>
          </div>
          <div className="admin-heading-actions">
            <span className="inline-badge">{money(published.length)} منتشرشده</span>
            <Link className="button button-outline" href="/daily" target="_blank"><Eye size={16} />مشاهدهٔ روزنامه</Link>
            <button className="button button-lime" onClick={() => setEditing("new")}><Plus size={17} />مطلب جدید</button>
          </div>
        </div>

        {articles.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>سکشن</th><th>عنوان</th><th>تاریخ نسخه</th><th>انتشار</th><th>محصولات</th><th>وضعیت</th><th>ویرایش</th></tr></thead>
              <tbody>
                {articles.map(article => {
                  const scheduled = new Date(article.publishAt).getTime() > now;
                  return (
                    <tr key={article.id}>
                      <td><span className="daily-admin-section" style={{ background: article.colorHex }}>{sectionMeta(article.section).en}</span></td>
                      <td>
                        <strong>{article.title}</strong>
                        {article.kicker && <small className="muted" style={{ display: "block" }}>{article.kicker}</small>}
                        <small className="muted" dir="ltr" style={{ display: "block" }}>/daily/{article.slug}</small>
                      </td>
                      <td><small>{new Date(article.editionDate).toLocaleDateString("fa-IR")}</small></td>
                      <td>
                        <small className="muted">{new Date(article.publishAt).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })}</small>
                        {scheduled && <small style={{ display: "block", color: "var(--accent-text)" }}><CalendarClock size={11} /> زمان‌بندی‌شده</small>}
                      </td>
                      <td>
                        {article.productIds.length ? (
                          <span className="daily-admin-products" title={article.productIds.map(productName).join("، ")}>
                            <ShoppingBag size={13} />{article.productIds.length.toLocaleString("fa-IR")}
                          </span>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td><span className={`status-badge ${article.active ? "status-delivered" : "status-cancelled"}`}>{article.active ? (scheduled ? "زمان‌بندی‌شده" : "منتشرشده") : "پیش‌نویس"}</span></td>
                      <td>
                        <div className="table-actions">
                          {article.active && !scheduled && <Link className="icon-button" href={`/daily/${article.slug}`} target="_blank" aria-label={`مشاهدهٔ ${article.title}`}><Eye size={16} /></Link>}
                          <button className="icon-button" aria-label={`ویرایش ${article.title}`} onClick={() => setEditing(article)}><Pencil size={16} /></button>
                          <button className="icon-button danger-action" aria-label={`حذف ${article.title}`} disabled={saving} onClick={() => { if (window.confirm(`مطلب «${article.title}» حذف شود؟`)) void onMutate("article.delete", { id: article.id }); }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Newspaper size={32} />} title="هنوز مطلبی نساخته‌ای" text="با اولین مطلب، بخش Fashion Daily در فروشگاه فعال می‌شود.">
            <button className="button button-lime" onClick={() => setEditing("new")}><Plus size={17} />اولین مطلب</button>
          </EmptyState>
        )}
      </section>

      {editing && (
        <ArticleModal
          article={editing === "new" ? emptyArticle : editing}
          products={products}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={async article => { if (await onMutate("article.save", { article })) setEditing(null); }}
        />
      )}
    </div>
  );
}

/* ---------- مودال مطلب ---------- */
function ArticleModal({ article, products, saving, onClose, onSave }: { article: AdminArticle; products: Product[]; saving: boolean; onClose: () => void; onSave: (article: AdminArticle) => Promise<void> }) {
  const [a, setA] = useState(article);
  const set = <K extends keyof AdminArticle>(key: K, value: AdminArticle[K]) => setA(prev => ({ ...prev, [key]: value }));
  const autoSlug = () => set("slug", slugify(a.title));

  return (
    <Modal title={a.id ? "ویرایش مطلب روزنامه" : "مطلب جدید روزنامه"} onClose={onClose} wide>
      <form className="admin-modal-form" onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void onSave({
          ...a,
          editionDate: a.editionDate ? new Date(a.editionDate).toISOString() : new Date().toISOString(),
          publishAt: a.publishAt ? new Date(a.publishAt).toISOString() : new Date().toISOString(),
        });
      }}>
        <div className="form-grid">
          <label className="full-width">عنوان مطلب<input required minLength={3} maxLength={140} value={a.title} onChange={e => set("title", e.target.value)} onBlur={() => { if (!a.slug) autoSlug(); }} placeholder="طلایی گرم، آبکاری‌ای که این پاییز را روشن می‌کند" /></label>
          <label>سکشن روزنامه
            <select value={a.section} onChange={e => set("section", e.target.value)}>
              {dailySections.map(section => <option key={section.id} value={section.id}>{section.title} — {section.en}</option>)}
            </select>
          </label>
          <label>لیبل کوچک بالا<input maxLength={60} value={a.kicker} onChange={e => set("kicker", e.target.value)} placeholder="گزارش ویژهٔ امروز" /></label>
          <label>نویسنده<input maxLength={60} value={a.author} onChange={e => set("author", e.target.value)} placeholder="تیم کیا" /></label>
          <label>زمان مطالعه (دقیقه)<input type="number" min={1} max={60} value={a.readMinutes} onChange={e => set("readMinutes", Number(e.target.value))} /></label>
          <label>رنگ سکشن<input dir="ltr" maxLength={9} value={a.colorHex} onChange={e => set("colorHex", e.target.value)} placeholder="#D19B44" /></label>
          <label>تاریخ نسخه<input type="date" value={a.editionDate ? a.editionDate.slice(0, 10) : ""} onChange={e => set("editionDate", e.target.value ? new Date(`${e.target.value}T08:00:00`).toISOString() : "")} /></label>
          <label>زمان انتشار<input type="datetime-local" value={toLocalInput(a.publishAt)} onChange={e => set("publishAt", e.target.value ? new Date(e.target.value).toISOString() : "")} /></label>
          <label>متن دکمهٔ خرید<input dir="ltr" maxLength={40} value={a.shopLabel} onChange={e => set("shopLabel", e.target.value)} placeholder="SHOP THE TREND" /></label>
          <label>ترتیب نمایش<input type="number" min={0} max={50} value={a.position} onChange={e => set("position", Number(e.target.value))} /></label>
          <label>نشانی صفحه (slug)<span className="slug-row"><input dir="ltr" maxLength={60} value={a.slug} onChange={e => set("slug", e.target.value)} placeholder="warm-gold-this-autumn" /><button type="button" className="button button-outline button-sm" onClick={autoSlug}>از عنوان</button></span><small className="muted">اگر خالی بماند، خودکار از عنوان ساخته می‌شود (حروف فارسی به لاتین تبدیل می‌شوند).</small></label>
          <label className="full-width">خلاصهٔ مطلب (در کارت و صفحهٔ مقاله)<textarea rows={2} maxLength={400} value={a.excerpt} onChange={e => set("excerpt", e.target.value)} /></label>
          <label className="full-width">
            متن مطلب
            <textarea rows={12} maxLength={20000} value={a.body} onChange={e => set("body", e.target.value)} placeholder={bodyTemplate} />
            <small className="muted">«## » زیرتیتر · «&gt; » نقل‌قول · «[[product:1|برچسب]]» کارت محصول داخل متن</small>
          </label>
          <label className="editor-check"><input type="checkbox" checked={a.active} onChange={e => set("active", e.target.checked)} />این مطلب منتشر شود (برای پیش‌نویس، برداشته شود)</label>
        </div>

        <ImageUrlBlock value={a.image} onChange={value => set("image", value)} />

        <div className="daily-admin-picker">
          <div className="admin-card-heading"><h3>محصولات این مطلب (Content → Commerce)</h3><span className="muted">{a.productIds.length.toLocaleString("fa-IR")} محصول</span></div>
          <div className="product-picker">
            {products.filter(p => p.active).map(p => (
              <label key={p.id} className={a.productIds.includes(p.id) ? "picker-chip selected" : "picker-chip"}>
                <input type="checkbox" checked={a.productIds.includes(p.id)} onChange={() => set("productIds", a.productIds.includes(p.id) ? a.productIds.filter(x => x !== p.id) : [...a.productIds, p.id])} />
                <img src={p.image} alt="" width="30" height="30" />
                <span>{p.name}</span>
              </label>
            ))}
            {!products.filter(p => p.active).length && <p className="muted">محصول فعالی وجود ندارد.</p>}
          </div>
          <small className="muted">این محصولات در پایین مقاله و در بخش «محصولات امروز» نمایش داده می‌شوند. برای کارت محصول داخل متن هم از «[[product:1]]» استفاده کن.</small>
        </div>

        <div className="admin-form-footer">
          <button type="button" className="button button-outline" onClick={onClose}><X size={16} />انصراف</button>
          <button className="button button-lime" disabled={saving}><Save size={17} />{saving ? "در حال ذخیره..." : "ذخیرهٔ مطلب"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ImageUrlBlock({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const samples = ["/images/hero-belt.webp", "/images/hero-jewelry.webp", "/images/product-belt.webp", "/images/product-chain.webp", "/images/product-bracelet.webp", "/images/product-ring.webp", "/images/product-earrings.webp", "/images/product-gift.webp"];
  return (
    <div className="image-url-block">
      <label>تصویر مطلب<input dir="ltr" value={value} onChange={e => onChange(e.target.value)} placeholder="/images/hero-belt.webp" /></label>
      <div className="sample-images">
        {samples.map(url => <button type="button" key={url} className={value === url ? "selected" : ""} aria-label={`انتخاب ${url}`} onClick={() => onChange(url)}><img src={url} alt="نمونه" width="52" height="52" /></button>)}
      </div>
      <small className="muted">تصویر اختصاصی: از کتابخانهٔ رسانه در بخش محصولات آدرس را بگیر و اینجا بچسبان.</small>
    </div>
  );
}
