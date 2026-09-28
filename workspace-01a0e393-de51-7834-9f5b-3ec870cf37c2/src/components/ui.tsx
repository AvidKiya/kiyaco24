"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import Link from "next/link";
import { X, Plus, Minus, ArrowLeft } from "lucide-react";
export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={`brand ${compact ? "brand-compact" : ""}`} aria-label="کیا اکسسوری، صفحه اصلی">
    <span className="brand-picture"><img className="logo-dark" src="/images/logo.png" alt="KIYA" width="118" height="90" /><img className="logo-light" src="/images/logo-light.png" alt="KIYA" width="118" height="90" /></span>
    {!compact && <span className="brand-description">کمربند و اکسسوری<span>جزئیات، امضای تو</span></span>}
  </Link>;
}
export function Modal({ title, children, onClose, drawer = false, wide = false }: { title: string; children: ReactNode; onClose: () => void; drawer?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${drawer ? "drawer-modal" : ""} ${wide ? "wide-modal" : ""}`} aria-labelledby={id} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="modal-inner"><header className="modal-heading"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={21} /></button></header>{children}</div>
  </dialog>;
}
export function Quantity({ value, max = 10, onChange }: { value: number; max?: number; onChange: (n: number) => void }) {
  return <div className="quantity"><button type="button" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="افزایش تعداد"><Plus size={15} /></button><span>{value.toLocaleString("fa-IR")}</span><button type="button" onClick={() => onChange(value - 1)} aria-label="کاهش تعداد"><Minus size={15} /></button></div>;
}
export function EmptyState({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) { return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{text}</p>{children}</div>; }
export function SectionTitle({ eyebrow, title, href, linkText = "مشاهده همه", children }: { eyebrow?: string; title: string; href?: string; linkText?: string; children?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2><i />{title}</h2></div>{children}{href && <Link className="text-link" href={href}>{linkText}<ArrowLeft size={17} /></Link>}</div>;
}
export function CategoryArt({ category }: { category: string }) {
  const common = { width: 76, height: 65, viewBox: "0 0 88 76", fill: "none", stroke: "currentColor", strokeWidth: 2.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  if (category === "belts") return <svg {...common}><ellipse cx="41" cy="29" rx="28" ry="17" fill="currentColor" fillOpacity=".07"/><path d="M13 28v15c0 11 13 20 29 20s28-9 28-20V29M14 33c7 12 23 17 44 11"/><rect x="48" y="33" width="25" height="22" rx="5" fill="var(--surface)" stroke="#bdca98"/><path d="M60 38v12m0-6h16" stroke="#bdca98"/><path d="m21 43 2 1m6 3 2 1m6 1 2 1"/></svg>;
  if (category === "necklaces") return <svg {...common}><path d="M21 11C7 40 9 59 28 65c15 5 27-2 32-17L71 13" strokeWidth="5" strokeDasharray="3 5"/><path d="M22 11c10 6 37 6 49 2" strokeWidth="1.5" opacity=".5"/><path d="m25 57 8 13 11-10" stroke="#bdca98"/><path d="m34 59-1 11" stroke="#bdca98"/></svg>;
  if (category === "bracelets") return <svg {...common}><ellipse cx="44" cy="39" rx="29" ry="24" strokeWidth="7" opacity=".6"/><ellipse cx="44" cy="39" rx="29" ry="24" strokeWidth="2" strokeDasharray="3 4"/><rect x="32" y="56" width="25" height="12" rx="3" transform="rotate(-5 32 56)" fill="var(--surface)" stroke="#bdca98"/><path d="m41 57 1 10m5-11 1 10" stroke="#bdca98"/></svg>;
  if (category === "rings") return <svg {...common}><ellipse cx="42" cy="45" rx="22" ry="25" transform="rotate(-25 42 45)" strokeWidth="6"/><ellipse cx="42" cy="45" rx="15" ry="19" transform="rotate(-25 42 45)" opacity=".5"/><path d="m33 13 22 2 7 14-24 7-14-13z" fill="var(--surface)" stroke="#bdca98"/><path d="m31 21 7 8 15-4-2-4z" fill="#bdca98" fillOpacity=".15" strokeWidth="1.2"/></svg>;
  if (category === "earrings") return <svg {...common}><path d="M21 16c-19 9-12 47 3 45s25-34 9-42" strokeWidth="5"/><path d="M55 15c-19 9-12 47 3 45s25-34 9-42" strokeWidth="5" stroke="#bdca98"/><path d="m22 12 6 13m28-13 6 13" strokeWidth="3"/></svg>;
  return <svg {...common}><rect x="15" y="29" width="58" height="35" rx="4" fill="currentColor" fillOpacity=".06"/><rect x="12" y="23" width="64" height="12" rx="3"/><path d="M44 23v41M29 10c-11 5 6 15 15 13-1-12-7-17-15-13ZM59 10c11 5-6 15-15 13 1-12 7-17 15-13Z" stroke="#bdca98"/><path d="m36 38-9 13m22-13 9 13" stroke="#bdca98"/></svg>;
}
