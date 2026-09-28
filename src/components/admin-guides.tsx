"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { GraduationCap, LayoutGrid, Plus, Pencil, Trash2, X, Save, Eye, Clock, CalendarClock, ShoppingBag, Star } from "lucide-react";
import { type Product, money } from "@/lib/catalog";
import { guideTopics, topicMeta, slugify } from "@/lib/guide-types";
import { Modal, EmptyState } from "./ui";

/* ============================================================
 *  فاز ۸ — مدیریت راهنمای استایل و کالکشن‌ها از پنل
 * ============================================================ */

export type AdminGuide = {
  id: number; slug: string; topic: string; title: string; kicker: string; excerpt: string;
  body: string; image: string; author: string; readMinutes: number; publishAt: string;
  productIds: number[]; position: number; active: boolean; createdAt: string;
};

export type AdminCollection = {
  id: number; slug: string; name: string; label: string; subtitle: string; description: string;
  image: string; colorHex: string; badge: string; productIds: number[]; featured: boolean;
  position: number; active: boolean; createdAt: string;
};

const emptyGuide: AdminGuide = {
  id: 0, slug: "", topic: "sizing", title: "", kicker: "", excerpt: "", body: "",
  image: "/images/hero-belt.webp", author: "تیم کیا", readMinutes: 3,
  publishAt: new Date().toISOString(), productIds: [], position: 0, active: true, createdAt: new Date().toISOString(),
};

const emptyCollection: AdminCollection = {
  id: 0, slug: "", name: "", label: "", subtitle: "", description: "",
  image: "/images/hero-belt.webp", colorHex: "#D19B44", badge: "", productIds: [],
  featured: false, position: 0, active: true, createdAt: new Date().toISOString(),
};

const toLocalInput = (iso: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const guideBodyTemplate = `## مرحلهٔ اول
توضیح این مرحله را بنویس. هر خط یک پاراگراف است.

- نکتهٔ اول
- نکتهٔ دوم

> نکتهٔ برجسته با این شکل نوشته می‌شود.

[[product:1|برچسب کارت محصول]]

## مرحلهٔ دوم
ادامهٔ متن...`;

export function GuidesEditor({ guides, collections, products, saving, onMutate }: {
  guides: AdminGuide[]; collections: AdminCollection[]; products: Product[]; saving: boolean;
  onMutate: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [section, setSection] = useState<"guides" | "collections">("guides");
  const [editingGuide, setEditingGuide] = useState<AdminGuide | "new" | null>(null);
  const [editingCollection, setEditingCollection] = useState<AdminCollection | "new" | null>(null);
  const now = Date.now();
  const productName = (id: number) => products.find(p => p.id === id)?.name ?? `#${id}`;

  return (
    <div className="guides-admin">
      <div className="admin-sub-tabs">
        <button className={section === "guides" ? "active" : ""} onClick={() => setSection("guides")}><GraduationCap size={17} />راهنمای استایل ({guides.length.toLocaleString("fa-IR")})</button>
        <button className={section === "collections" ? "active" : ""} onClick={() => setSection("collections")}><LayoutGrid size={17} />کالکشن‌ها ({collections.length.toLocaleString("fa-IR")})</button>
      </div>

      {section === "guides" && (
        <section className="admin-card">
          <div className="admin-card-heading">
            <div>
              <h2>راهنماهای استایل</h2>
              <p className="muted">محتوای آموزشی بهینه برای جست‌وجو؛ هر «## » در متن یک مرحلهٔ HowTo برای گوگل ثبت می‌شود.</p>
            </div>
            <div className="admin-heading-actions">
              <Link className="button button-outline" href="/guide" target="_blank"><Eye size={16} />مشاهدهٔ صفحه</Link>
              <button className="button button-lime" onClick={() => setEditingGuide("new")}><Plus size={17} />راهنمأ جدید</button>
            </div>
          </div>

          {guides.length ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead><tr><th>موضوع</th><th>عنوان</th><th>انتشار</th><th>محصولات</th><th>وضعیت</th><th>ویرایش</th></tr></thead>
                <tbody>
                  {guides.map(guide => {
                    const scheduled = new Date(guide.publishAt).getTime() > now;
                    return (
                      <tr key={guide.id}>
                        <td><span className="daily-admin-section" style={{ background: "var(--accent)" }}>{topicMeta(guide.topic).title}</span></td>
                        <td>
                          <strong>{guide.title}</strong>
                          {guide.kicker && <small className="muted" style={{ display: "block" }}>{guide.kicker}</small>}
                          <small className="muted" dir="ltr" style={{ display: "block" }}>/guide/{guide.slug}</small>
                        </td>
                        <td>
                          <small className="muted">{new Date(guide.publishAt).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" })}</small>
                          {scheduled && <small style={{ display: "block", color: "var(--accent-text)" }}><CalendarClock size={11} /> زمان‌بندی‌شده</small>}
                        </td>
                        <td>{guide.productIds.length ? <span className="daily-admin-products" title={guide.productIds.map(productName).join("، ")}><ShoppingBag size={13} />{guide.productIds.length.toLocaleString("fa-IR")}</span> : <span className="muted">—</span>}</td>
                        <td><span className={`status-badge ${guide.active ? (scheduled ? "status-pending" : "status-delivered") : "status-cancelled"}`}>{guide.active ? (scheduled ? "زمان‌بندی‌شده" : "منتشرشده") : "پیش‌نویس"}</span></td>
                        <td>
                          <div className="table-actions">
                            {guide.active && !scheduled && <Link className="icon-button" href={`/guide/${guide.slug}`} target="_blank" aria-label={`مشاهدهٔ ${guide.title}`}><Eye size={16} /></Link>}
                            <button className="icon-button" aria-label={`ویرایش ${guide.title}`} onClick={() => setEditingGuide(guide)}><Pencil size={16} /></button>
                            <button className="icon-button danger-action" aria-label={`حذف ${guide.title}`} disabled={saving} onClick={() => { if (window.confirm(`راهنمای «${guide.title}» حذف شود؟`)) void onMutate("guide.delete", { id: guide.id }); }}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<GraduationCap size={32} />} title="راهنمایی نساخته‌ای" text="با اولین راهنما، بخش راهنمای استایل در فروشگاه فعال می‌شود.">
              <button className="button button-lime" onClick={() => setEditingGuide("new")}><Plus size={17} />اولین راهنما</button>
            </EmptyState>
          )}
        </section>
      )}

      {section === "collections" && (
        <section className="admin-card">
          <div className="admin-card-heading">
            <div>
              <h2>کالکشن‌ها</h2>
              <p className="muted">کالکشن ویژه در بالای صفحهٔ کالکشن‌ها بزرگ نمایش داده می‌شود.</p>
            </div>
            <div className="admin-heading-actions">
              <Link className="button button-outline" href="/collections" target="_blank"><Eye size={16} />مشاهدهٔ صفحه</Link>
              <button className="button button-lime" onClick={() => setEditingCollection("new")}><Plus size={17} />کالکشن جدید</button>
            </div>
          </div>

          {collections.length ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead><tr><th>کالکشن</th><th>زیرعنوان</th><th>محصولات</th><th>ویژه</th><th>وضعیت</th><th>ویرایش</th></tr></thead>
                <tbody>
                  {collections.map(collection => (
                    <tr key={collection.id}>
                      <td>
                        <strong>{collection.name}</strong>
                        {collection.badge && <span className="collection-badge" style={{ marginInlineStart: 6 }}>{collection.badge}</span>}
                        <small className="muted" dir="ltr" style={{ display: "block" }}>/collections/{collection.slug}</small>
                      </td>
                      <td className="muted"><small>{collection.subtitle || "—"}</small></td>
                      <td>{collection.productIds.length ? <span className="daily-admin-products" title={collection.productIds.map(productName).join("، ")}><ShoppingBag size={13} />{collection.productIds.length.toLocaleString("fa-IR")}</span> : <span className="muted">—</span>}</td>
                      <td>{collection.featured ? <span className="status-badge status-delivered"><Star size={12} /> ویژه</span> : <span className="muted">—</span>}</td>
                      <td><span className={`status-badge ${collection.active ? "status-delivered" : "status-cancelled"}`}>{collection.active ? "فعال" : "غیرفعال"}</span></td>
                      <td>
                        <div className="table-actions">
                          {collection.active && <Link className="icon-button" href={`/collections/${collection.slug}`} target="_blank" aria-label={`مشاهدهٔ ${collection.name}`}><Eye size={16} /></Link>}
                          <button className="icon-button" aria-label={`ویرایش ${collection.name}`} onClick={() => setEditingCollection(collection)}><Pencil size={16} /></button>
                          <button className="icon-button danger-action" aria-label={`حذف ${collection.name}`} disabled={saving} onClick={() => { if (window.confirm(`کالکشن «${collection.name}» حذف شود؟`)) void onMutate("collection.delete", { id: collection.id }); }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<LayoutGrid size={32} />} title="کالکشنی نساخته‌ای" text="با اولین کالکشن، لندینگ اختصاصی آن ساخته می‌شود.">
              <button className="button button-lime" onClick={() => setEditingCollection("new")}><Plus size={17} />اولین کالکشن</button>
            </EmptyState>
          )}
        </section>
      )}

      {editingGuide && (
        <GuideModal
          guide={editingGuide === "new" ? emptyGuide : editingGuide}
          products={products} saving={saving}
          onClose={() => setEditingGuide(null)}
          onSave={async guide => { if (await onMutate("guide.save", { guide })) setEditingGuide(null); }}
        />
      )}

      {editingCollection && (
        <CollectionModal
          collection={editingCollection === "new" ? emptyCollection : editingCollection}
          products={products} saving={saving}
          onClose={() => setEditingCollection(null)}
          onSave={async collection => { if (await onMutate("collection.save", { collection })) setEditingCollection(null); }}
        />
      )}
    </div>
  );
}

/* ---------- مودال راهنما ---------- */
function GuideModal({ guide, products, saving, onClose, onSave }: { guide: AdminGuide; products: Product[]; saving: boolean; onClose: () => void; onSave: (guide: AdminGuide) => Promise<void> }) {
  const [g, setG] = useState(guide);
  const set = <K extends keyof AdminGuide>(key: K, value: AdminGuide[K]) => setG(prev => ({ ...prev, [key]: value }));

  return (
    <Modal title={g.id ? "ویرایش راهنما" : "راهنمای جدید"} onClose={onClose} wide>
      <form className="admin-modal-form" onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void onSave({ ...g, publishAt: g.publishAt ? new Date(g.publishAt).toISOString() : new Date().toISOString() });
      }}>
        <div className="form-grid">
          <label className="full-width">عنوان راهنما<input required minLength={3} maxLength={140} value={g.title} onChange={e => set("title", e.target.value)} onBlur={() => { if (!g.slug) set("slug", slugify(g.title)); }} placeholder="راهنمای سایز کمربند" /></label>
          <label>موضوع
            <select value={g.topic} onChange={e => set("topic", e.target.value)}>
              {guideTopics.map(topic => <option key={topic.id} value={topic.id}>{topic.title} — {topic.en}</option>)}
            </select>
          </label>
          <label>لیبل کوچک بالا<input maxLength={60} value={g.kicker} onChange={e => set("kicker", e.target.value)} placeholder="راهنمای سایز" /></label>
          <label>نویسنده<input maxLength={60} value={g.author} onChange={e => set("author", e.target.value)} /></label>
          <label>زمان مطالعه (دقیقه)<input type="number" min={1} max={60} value={g.readMinutes} onChange={e => set("readMinutes", Number(e.target.value))} /></label>
          <label>زمان انتشار<input type="datetime-local" value={toLocalInput(g.publishAt)} onChange={e => set("publishAt", e.target.value ? new Date(e.target.value).toISOString() : "")} /></label>
          <label>ترتیب نمایش<input type="number" min={0} max={50} value={g.position} onChange={e => set("position", Number(e.target.value))} /></label>
          <label>نشانی صفحه (slug)<span className="slug-row"><input dir="ltr" maxLength={60} value={g.slug} onChange={e => set("slug", e.target.value)} placeholder="belt-size-guide" /><button type="button" className="button button-outline button-sm" onClick={() => set("slug", slugify(g.title))}>از عنوان</button></span><small className="muted">خالی بماند، خودکار از عنوان ساخته می‌شود.</small></label>
          <label className="full-width">خلاصه (در کارت و صفحهٔ راهنما)<textarea rows={2} maxLength={400} value={g.excerpt} onChange={e => set("excerpt", e.target.value)} /></label>
          <label className="full-width">
            متن راهنما
            <textarea rows={12} maxLength={20000} value={g.body} onChange={e => set("body", e.target.value)} placeholder={guideBodyTemplate} />
            <small className="muted">«## » مرحله · «- » لیست · «&gt; » نکتهٔ برجسته · «[[product:1|برچسب]]» کارت محصول</small>
          </label>
          <label className="editor-check"><input type="checkbox" checked={g.active} onChange={e => set("active", e.target.checked)} />این راهنما منتشر شود</label>
        </div>

        <ImageUrlBlock value={g.image} onChange={value => set("image", value)} />
        <ProductPickerBlock selected={g.productIds} onChange={ids => set("productIds", ids)} products={products} />

        <div className="admin-form-footer">
          <button type="button" className="button button-outline" onClick={onClose}><X size={16} />انصراف</button>
          <button className="button button-lime" disabled={saving}><Save size={17} />{saving ? "در حال ذخیره..." : "ذخیرهٔ راهنما"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- مودال کالکشن ---------- */
function CollectionModal({ collection, products, saving, onClose, onSave }: { collection: AdminCollection; products: Product[]; saving: boolean; onClose: () => void; onSave: (collection: AdminCollection) => Promise<void> }) {
  const [c, setC] = useState(collection);
  const set = <K extends keyof AdminCollection>(key: K, value: AdminCollection[K]) => setC(prev => ({ ...prev, [key]: value }));
  const colorPresets = ["#D19B44", "#b8b9b5", "#252621", "#717967", "#78533b", "#e3bd7d"];

  return (
    <Modal title={c.id ? "ویرایش کالکشن" : "کالکشن جدید"} onClose={onClose} wide>
      <form className="admin-modal-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void onSave(c); }}>
        <div className="form-grid">
          <label className="full-width">نام کالکشن<input required minLength={2} maxLength={80} value={c.name} onChange={e => set("name", e.target.value)} onBlur={() => { if (!c.slug) set("slug", slugify(c.name)); }} placeholder="کالکشن پاییز گرم" /></label>
          <label>برچسب انگلیسی<input dir="ltr" maxLength={40} value={c.label} onChange={e => set("label", e.target.value)} placeholder="AUTUMN WARM" /></label>
          <label>برچسب کوچک (مثل «جدید»)<input maxLength={20} value={c.badge} onChange={e => set("badge", e.target.value)} /></label>
          <label>رنگ کالکشن<span className="slug-row"><input dir="ltr" maxLength={9} value={c.colorHex} onChange={e => set("colorHex", e.target.value)} placeholder="#D19B44" /></span><span className="color-swatches">{colorPresets.map(color => <button type="button" key={color} className={c.colorHex === color ? "selected" : ""} style={{ background: color }} aria-label={`رنگ ${color}`} onClick={() => set("colorHex", color)} />)}</span></label>
          <label>ترتیب نمایش<input type="number" min={0} max={50} value={c.position} onChange={e => set("position", Number(e.target.value))} /></label>
          <label>نشانی صفحه (slug)<span className="slug-row"><input dir="ltr" maxLength={60} value={c.slug} onChange={e => set("slug", e.target.value)} placeholder="autumn-warm" /><button type="button" className="button button-outline button-sm" onClick={() => set("slug", slugify(c.name))}>از نام</button></span><small className="muted">خالی بماند، خودکار ساخته می‌شود.</small></label>
          <label className="full-width">زیرعنوان<input maxLength={120} value={c.subtitle} onChange={e => set("subtitle", e.target.value)} placeholder="طلایی مات و چرم طبیعی برای روزهای خنک" /></label>
          <label className="full-width">توضیح کالکشن (برای صفحه و سئو)<textarea rows={3} maxLength={500} value={c.description} onChange={e => set("description", e.target.value)} /></label>
          <label className="editor-check"><input type="checkbox" checked={c.active} onChange={e => set("active", e.target.checked)} />این کالکشن فعال باشد</label>
          <label className="editor-check"><input type="checkbox" checked={c.featured} onChange={e => set("featured", e.target.checked)} />کالکشن ویژه (بزرگ در بالای صفحه)</label>
        </div>

        <ImageUrlBlock value={c.image} onChange={value => set("image", value)} />
        <ProductPickerBlock selected={c.productIds} onChange={ids => set("productIds", ids)} products={products} />

        <div className="admin-form-footer">
          <button type="button" className="button button-outline" onClick={onClose}><X size={16} />انصراف</button>
          <button className="button button-lime" disabled={saving}><Save size={17} />{saving ? "در حال ذخیره..." : "ذخیرهٔ کالکشن"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ProductPickerBlock({ selected, onChange, products }: { selected: number[]; onChange: (ids: number[]) => void; products: Product[] }) {
  return (
    <div className="daily-admin-picker">
      <div className="admin-card-heading"><h3>محصولات ({selected.length.toLocaleString("fa-IR")})</h3></div>
      <div className="product-picker">
        {products.filter(p => p.active).map(p => (
          <label key={p.id} className={selected.includes(p.id) ? "picker-chip selected" : "picker-chip"}>
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onChange(selected.includes(p.id) ? selected.filter(x => x !== p.id) : [...selected, p.id])} />
            <img src={p.image} alt="" width="30" height="30" />
            <span>{p.name}</span>
          </label>
        ))}
        {!products.filter(p => p.active).length && <p className="muted">محصول فعالی وجود ندارد.</p>}
      </div>
    </div>
  );
}

function ImageUrlBlock({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const samples = ["/images/hero-belt.webp", "/images/hero-jewelry.webp", "/images/product-belt.webp", "/images/product-chain.webp", "/images/product-bracelet.webp", "/images/product-ring.webp", "/images/product-earrings.webp", "/images/product-gift.webp"];
  return (
    <div className="image-url-block">
      <label>تصویر<input dir="ltr" value={value} onChange={e => onChange(e.target.value)} placeholder="/images/hero-belt.webp" /></label>
      <div className="sample-images">
        {samples.map(url => <button type="button" key={url} className={value === url ? "selected" : ""} aria-label={`انتخاب ${url}`} onClick={() => onChange(url)}><img src={url} alt="نمونه" width="52" height="52" /></button>)}
      </div>
      <small className="muted">تصویر اختصاصی: از کتابخانهٔ رسانه در بخش محصولات آدرس را بگیر و اینجا بچسبان.</small>
    </div>
  );
}
