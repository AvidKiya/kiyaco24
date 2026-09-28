"use client";
import { useState } from "react";
import Link from "next/link";
import { Scale, X, ArrowUpLeft, ShoppingBag, Check, Minus } from "lucide-react";
import { type Product, money, discountPercent, categoryName } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { Modal } from "./ui";

/* ============================================================
 *  مقایسهٔ محصولات — حداکثر ۴ محصول کنار هم
 * ============================================================ */

export const COMPARE_LIMIT = 4;

export function useCompare() {
  const [items, setItems] = useState<number[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("kiya-compare") || "[]");
      return Array.isArray(stored) ? stored.filter(Number.isInteger).slice(0, COMPARE_LIMIT) : [];
    } catch { return []; }
  });

  const persist = (next: number[]) => {
    setItems(next);
    try { localStorage.setItem("kiya-compare", JSON.stringify(next)); } catch { /* حافظه در دسترس نبود */ }
  };

  const toggle = (id: number) => {
    if (items.includes(id)) persist(items.filter(x => x !== id));
    else if (items.length >= COMPARE_LIMIT) return "limit";
    else persist([...items, id]);
    return "ok";
  };

  const remove = (id: number) => persist(items.filter(x => x !== id));
  const clear = () => persist([]);

  return { items, toggle, remove, clear, has: (id: number) => items.includes(id) };
}

/** نوار مقایسهٔ چسبان پایین صفحه */
export function CompareBar({ items, products, onOpen, onClear }: { items: number[]; products: Product[]; onOpen: () => void; onClear: () => void }) {
  if (items.length < 2) return null;
  return (
    <div className="compare-bar" role="region" aria-label="نوار مقایسهٔ محصولات">
      <div className="compare-bar-items">
        {items.map(id => {
          const product = products.find(p => p.id === id);
          if (!product) return null;
          return (
            <span className="compare-chip" key={id}>
              <img src={product.image} alt="" width="30" height="30" />
              {product.name}
            </span>
          );
        })}
      </div>
      <div className="compare-bar-actions">
        <button className="text-link" onClick={onClear}>پاک‌کردن</button>
        <button className="button button-lime" onClick={onOpen}><Scale size={17} />مقایسهٔ {items.length.toLocaleString("fa-IR")} محصول</button>
      </div>
    </div>
  );
}

/** پنجرهٔ مقایسه */
export function CompareModal({ items, products, onClose, onRemove }: { items: number[]; products: Product[]; onClose: () => void; onRemove: (id: number) => void }) {
  const { addItem, toast } = useShop();
  const selected = items.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p);
  if (selected.length < 2) return null;

  const rows: { label: string; value: (p: Product) => string }[] = [
    { label: "دسته‌بندی", value: p => categoryName(p.category) },
    { label: "قیمت", value: p => `${money(p.price)} تومان` },
    { label: "قیمت پیش از تخفیف", value: p => (p.compareAt ? `${money(p.compareAt)} تومان` : "—") },
    { label: "تخفیف", value: p => (discountPercent(p) > 0 ? `${discountPercent(p).toLocaleString("fa-IR")}٪` : "—") },
    { label: "جنس", value: p => p.material || "—" },
    { label: "رنگ‌ها", value: p => (p.colors.length ? p.colors.map(c => c.name).join("، ") : "—") },
    { label: "سایزها", value: p => (p.sizes.length ? p.sizes.join("، ") : "—") },
    { label: "موجودی", value: p => (p.stock > 0 ? `${money(p.stock)} عدد` : "ناموجود") },
    { label: "وضعیت تأیید", value: p => (p.stock > 0 ? "آمادهٔ ارسال" : "فعلاً ناموجود") },
  ];

  return (
    <Modal title="مقایسهٔ محصولات" wide onClose={onClose}>
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">ویژگی</th>
              {selected.map(product => (
                <th scope="col" key={product.id}>
                  <div className="compare-product-head">
                    <img src={product.image} alt={product.name} width="80" height="80" />
                    <strong>{product.name}</strong>
                    <div className="compare-product-actions">
                      <Link className="text-link" href={`/product/${product.slug}`}>صفحهٔ محصول<ArrowUpLeft size={14} /></Link>
                      <button className="icon-button" aria-label={`حذف ${product.name} از مقایسه`} onClick={() => onRemove(product.id)}><X size={15} /></button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {selected.map(product => <td key={product.id}>{row.value(product)}</td>)}
              </tr>
            ))}
            <tr>
              <th scope="row">افزودن به سبد</th>
              {selected.map(product => (
                <td key={product.id}>
                  <button
                    className="button button-lime"
                    disabled={!product.stock}
                    onClick={() => { addItem(product, product.sizes[0], product.colors[0]?.name, 1); toast("به سبد خریدت اضافه شد."); }}
                  >
                    <ShoppingBag size={16} />{product.stock ? "افزودن" : "ناموجود"}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="compare-hint"><Check size={14} />برای مقایسهٔ دقیق‌تر، سایز و رنگ هر محصول را در صفحهٔ خودش انتخاب کن.</p>
    </Modal>
  );
}

export function CompareEmptyIcon() {
  return <Minus size={14} />;
}
