"use client";
import { useState, type FormEvent } from "react";
import { LayoutTemplate, ArrowUp, ArrowDown, Eye, EyeOff, Plus, Pencil, Trash2, X, Save, Menu as MenuIcon, GripVertical } from "lucide-react";
import { defaultMenus, type SiteMenus, type MenuLink, type ShopSettings } from "@/lib/catalog";
import { builtinSections, type HomeSection } from "@/lib/storefront-types";
import { Modal, EmptyState } from "./ui";

/* ============================================================
 *  فاز ۱۳ — Homepage Builder + مدیریت منوها
 *  چیدمان صفحهٔ اصلی و منوهای هدر/فوتر بدون یک خط کد
 * ============================================================ */

const builtinName = (key: string) => builtinSections.find(section => section.key === key)?.name || key;
const builtinHint = (key: string) => builtinSections.find(section => section.key === key)?.hint || "";
const layoutNames: Record<string, string> = { banner: "بنر تمام‌عرض", products: "گرید محصولات", split: "دوستونه (تصویر + متن)" };

type Props = {
  sections: HomeSection[];
  products: { id: number; name: string; active: boolean }[];
  saving: boolean;
  onMutate: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
};

export function HomeBuilder({ sections, products, saving, onMutate }: Props) {
  const [editing, setEditing] = useState<HomeSection | "new" | null>(null);
  const ordered = [...sections].sort((a, b) => a.position - b.position || a.id - b.id);

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    const ids = ordered.map(section => section.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await onMutate("home.reorder", { ids });
  }

  return <section className="admin-card">
    <div className="admin-card-heading">
      <h2><LayoutTemplate size={18} /> چیدمان صفحهٔ اصلی</h2>
      <button className="button button-lime" onClick={() => setEditing("new")}><Plus size={16} />سکشن جدید</button>
    </div>
    <p className="admin-hint">ترتیب سکشن‌های صفحهٔ اول را با فلش‌ها عوض کنید، هر سکشن را خاموش/روشن کنید یا سکشن دلخواه (بنر، گرید محصولات، دوستونه) بسازید — بدون کد.</p>
    <div className="admin-table-scroll"><table className="admin-table">
      <thead><tr><th></th><th>سکشن</th><th>نوع</th><th>وضعیت</th><th>مدیریت</th></tr></thead>
      <tbody>{ordered.map((section, index) => {
        const isCustom = section.key === "custom";
        return <tr key={section.id} className={!section.active ? "archived-row" : ""}>
          <td><div className="table-actions">
            <button className="icon-button" aria-label="بالا بردن" disabled={saving || index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
            <button className="icon-button" aria-label="پایین بردن" disabled={saving || index === ordered.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
          </div></td>
          <td><div className="table-product"><GripVertical size={15} className="muted" /><span><strong>{isCustom ? section.title || "سکشن دلخواه" : builtinName(section.key)}</strong><small>{isCustom ? layoutNames[section.layout] || section.layout : builtinHint(section.key)}</small></span></div></td>
          <td><span className={`status-badge ${isCustom ? "status-pending" : "status-delivered"}`}>{isCustom ? "دلخواه" : "داخلی"}</span></td>
          <td><span className={`status-badge ${section.active ? "status-delivered" : "status-cancelled"}`}>{section.active ? "نمایش" : "پنهان"}</span></td>
          <td><div className="table-actions">
            <button className="icon-button" title={section.active ? "پنهان‌کردن" : "نمایش"} aria-label={section.active ? "پنهان‌کردن سکشن" : "نمایش سکشن"} disabled={saving} onClick={() => onMutate("home.section.save", { section: { ...section, active: !section.active } })}>{section.active ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            {isCustom && <button className="icon-button" title="ویرایش" aria-label={`ویرایش ${section.title}`} onClick={() => setEditing(section)}><Pencil size={15} /></button>}
            {isCustom && <button className="icon-button danger-action" title="حذف" aria-label={`حذف ${section.title}`} disabled={saving} onClick={async () => { if (window.confirm(`سکشن «${section.title}» حذف شود؟`)) await onMutate("home.section.delete", { id: section.id }); }}><Trash2 size={15} /></button>}
          </div></td>
        </tr>;
      })}</tbody>
    </table></div>
    {!ordered.length && <EmptyState icon={<LayoutTemplate size={30} />} title="سکشنی ثبت نشده" text="با اولین بازدید صفحهٔ اصلی، چیدمان پیش‌فرض ساخته می‌شود." />}
    {editing && <Modal title={editing === "new" ? "سکشن دلخواه جدید" : "ویرایش سکشن"} onClose={() => setEditing(null)}>
      <SectionForm section={editing === "new" ? null : editing} products={products} saving={saving}
        onSave={async section => { if (await onMutate("home.section.save", { section })) setEditing(null); }}
        onClose={() => setEditing(null)} />
    </Modal>}
  </section>;
}

function SectionForm({ section, products, saving, onSave, onClose }: {
  section: HomeSection | null;
  products: { id: number; name: string; active: boolean }[];
  saving: boolean;
  onSave: (section: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    id: section?.id ?? 0, key: section?.key ?? "custom",
    title: section?.title ?? "", subtitle: section?.subtitle ?? "",
    layout: section?.layout ?? "banner", active: section?.active ?? true,
    image: section?.config?.image ?? "", text: section?.config?.text ?? "",
    cta: section?.config?.cta ?? "", link: section?.config?.link ?? "/shop",
    background: section?.config?.background ?? "",
    productIds: section?.config?.productIds ?? [],
  });
  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleProduct = (id: number) => set("productIds", form.productIds.includes(id) ? form.productIds.filter(x => x !== id) : [...form.productIds, id].slice(0, 8));

  return <form className="admin-modal-form" onSubmit={(e: FormEvent) => {
    e.preventDefault();
    void onSave({ id: form.id || undefined, key: form.key, title: form.title, subtitle: form.subtitle, layout: form.layout, active: form.active, config: { image: form.image, text: form.text, cta: form.cta, link: form.link, background: form.background, productIds: form.productIds } });
  }}>
    <div className="form-grid">
      <label>عنوان سکشن<input required maxLength={80} value={form.title} onChange={e => set("title", e.target.value)} placeholder="پیشنهاد این هفتهٔ کیا" /></label>
      <label>لیبل کوچک بالا (اختیاری)<input maxLength={120} value={form.subtitle} onChange={e => set("subtitle", e.target.value)} placeholder="ONLY THIS WEEK" /></label>
      <label>نوع چیدمان<select value={form.layout} onChange={e => set("layout", e.target.value)}>
        <option value="banner">بنر تمام‌عرض</option>
        <option value="products">گرید محصولات</option>
        <option value="split">دوستونه (تصویر + متن)</option>
      </select></label>
      <label>رنگ پس‌زمینه (اختیاری)<input dir="ltr" maxLength={30} value={form.background} onChange={e => set("background", e.target.value)} placeholder="#20211c" /></label>
      <label className="full-width">متن سکشن (اختیاری)<textarea rows={3} maxLength={400} value={form.text} onChange={e => set("text", e.target.value)} /></label>
      <label>متن دکمه (اختیاری)<input maxLength={40} value={form.cta} onChange={e => set("cta", e.target.value)} placeholder="مشاهده" /></label>
      <label>مسیر دکمه<input dir="ltr" maxLength={300} value={form.link} onChange={e => set("link", e.target.value)} placeholder="/shop?sale=1" /></label>
      {form.layout !== "products" && <label className="full-width">آدرس تصویر (اختیاری)<input dir="ltr" maxLength={700} value={form.image} onChange={e => set("image", e.target.value)} placeholder="/images/hero-belt.webp" /></label>}
      <label className="editor-check"><input type="checkbox" checked={form.active} onChange={e => set("active", e.target.checked)} />این سکشن نمایش داده شود</label>
    </div>
    {form.layout === "products" && <fieldset className="editor-checks"><legend>محصولات سکشن (حداکثر ۸)</legend>
      {products.filter(p => p.active).map(p => <label key={p.id} className="editor-check">
        <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />{p.name}
      </label>)}
    </fieldset>}
    <div className="admin-form-footer">
      <button type="button" className="button button-outline" onClick={onClose}><X size={16} />انصراف</button>
      <button className="button button-lime" disabled={saving}><Save size={17} />{saving ? "در حال ذخیره..." : "ذخیرهٔ سکشن"}</button>
    </div>
  </form>;
}

/* ============================================================
 *  ادیتور منوهای هدر و فوتر
 * ============================================================ */
export function MenuEditor({ settings, saving, onSave }: {
  settings: ShopSettings;
  saving: boolean;
  onSave: (settings: ShopSettings) => Promise<boolean>;
}) {
  const [menus, setMenus] = useState<SiteMenus>(settings.menus && Array.isArray(settings.menus.header) ? settings.menus : defaultMenus);

  const setLinks = (group: "header" | "shop" | "help", links: MenuLink[]) => setMenus(prev => ({ ...prev, [group]: links }));

  return <section className="admin-card">
    <div className="admin-card-heading"><h2><MenuIcon size={18} /> منوهای سایت</h2></div>
    <p className="admin-hint">لینک‌های منوی بالای سایت و دو ستون فوتر را اینجا مدیریت کنید. لینک داخلی مثل <code dir="ltr">/shop?sale=1</code> بنویسید؛ لینک‌های ویژهٔ فوتر مثل <code dir="ltr">#shipping</code> <code dir="ltr">#returns</code> <code dir="ltr">#about</code> <code dir="ltr">#contact</code> پنجرهٔ اطلاعات را باز می‌کنند.</p>
    <MenuGroup title="منوی هدر" links={menus.header} onChange={links => setLinks("header", links)} />
    <div className="form-grid">
      <label>عنوان ستون اول فوتر<input maxLength={40} value={menus.shopTitle} onChange={e => setMenus(prev => ({ ...prev, shopTitle: e.target.value }))} /></label>
      <label>عنوان ستون دوم فوتر<input maxLength={40} value={menus.helpTitle} onChange={e => setMenus(prev => ({ ...prev, helpTitle: e.target.value }))} /></label>
    </div>
    <MenuGroup title={`ستون فوتر: ${menus.shopTitle}`} links={menus.shop} onChange={links => setLinks("shop", links)} />
    <MenuGroup title={`ستون فوتر: ${menus.helpTitle}`} links={menus.help} onChange={links => setLinks("help", links)} />
    <div className="editor-actions" style={{ marginTop: "1rem", display: "flex", gap: ".6rem" }}>
      <button className="button button-lime" disabled={saving} onClick={() => void onSave({ ...settings, menus })}>{saving ? "در حال ذخیره..." : "ذخیرهٔ منوها"}</button>
      <button className="button button-outline" disabled={saving} onClick={() => setMenus(defaultMenus)}>بازگشت به منوی پیش‌فرض</button>
    </div>
  </section>;
}

function MenuGroup({ title, links, onChange }: { title: string; links: MenuLink[]; onChange: (links: MenuLink[]) => void }) {
  const update = (index: number, patch: Partial<MenuLink>) => onChange(links.map((link, i) => i === index ? { ...link, ...patch } : link));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return <div className="menu-group">
    <h3 className="menu-group-title">{title} <small className="muted">({links.length} لینک)</small></h3>
    {links.map((link, index) => <div className="menu-link-row" key={index}>
      <input aria-label="عنوان لینک" maxLength={40} value={link.label} onChange={e => update(index, { label: e.target.value })} placeholder="عنوان" />
      <input aria-label="مسیر لینک" dir="ltr" maxLength={300} value={link.href} onChange={e => update(index, { href: e.target.value })} placeholder="/shop" />
      <button type="button" className="icon-button" aria-label="بالا" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button>
      <button type="button" className="icon-button" aria-label="پایین" disabled={index === links.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button>
      <button type="button" className="icon-button danger-action" aria-label="حذف لینک" onClick={() => onChange(links.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
    </div>)}
    {links.length < 12 && <button type="button" className="text-link" onClick={() => onChange([...links, { label: "", href: "/" }])}><Plus size={14} />افزودن لینک</button>}
  </div>;
}
