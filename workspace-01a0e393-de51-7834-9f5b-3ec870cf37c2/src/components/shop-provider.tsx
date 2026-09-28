"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { Check, AlertCircle, X } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { trackEvent } from "@/lib/client-analytics";

export type CartItem = { key: string; productId: number; slug: string; name: string; image: string; price: number; quantity: number; stock: number; size: string; color: string };
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type ShopContextValue = {
  cart: CartItem[]; favorites: number[]; theme: string; ready: boolean;
  addItem: (product: Product, size?: string, color?: string, quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void; clearCart: () => void;
  toggleFavorite: (id: number) => void; toggleTheme: () => void;
  toast: (text: string, type?: "success" | "error") => void;
  install: () => Promise<boolean>; installed: boolean;
};
const ShopContext = createContext<ShopContextValue | null>(null);
/* در سرور useLayoutEffect هشدار می‌دهد؛ فقط در مرورگر استفاده می‌شود. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
export function ShopProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [theme, setTheme] = useState("dark");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: string; id: number } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  /* هیدراسیون ری‌اکت ویژگی data-theme را با مقدار سرور هم‌تراز می‌کند و حذفش می‌کند؛
     اینجا پیش از رنگ‌آمیزی صفحه، انتخاب کاربر را دوباره اعمال می‌کنیم. */
  useIsoLayoutEffect(() => {
    let saved = "dark";
    try { saved = localStorage.getItem("kiya-theme") === "light" ? "light" : "dark"; } catch { /* حافظهٔ مرورگر در دسترس نیست */ }
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);
  useEffect(() => {
    try {
      const items = JSON.parse(localStorage.getItem("kiya-cart") || "[]");
      const saved = JSON.parse(localStorage.getItem("kiya-favorites") || "[]");
      if (Array.isArray(items)) setCart(items.filter(i => typeof i?.key === "string" && Number.isFinite(i.price) && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 10 && Number.isInteger(i.productId)));
      if (Array.isArray(saved)) setFavorites(saved.filter(Number.isInteger));
      setTheme(document.documentElement.dataset.theme || "dark");
    } catch { /* A corrupted local cart should not block the storefront. */ }
    setReady(true);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallEvent); };
    const didInstall = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", didInstall);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("beforeinstallprompt", beforeInstall); window.removeEventListener("appinstalled", didInstall); };
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem("kiya-cart", JSON.stringify(cart)); } catch {} }, [cart, ready]);
  useEffect(() => { if (ready) try { localStorage.setItem("kiya-favorites", JSON.stringify(favorites)); } catch {} }, [favorites, ready]);
  const toastRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!notice) return;
    try {
      if (typeof toastRef.current?.showPopover === "function") {
        if (toastRef.current.matches(":popover-open")) toastRef.current.hidePopover();
        toastRef.current.showPopover();
      }
    } catch {}
    const timeout = setTimeout(() => setNotice(null), notice.type === "error" ? 6500 : 4000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const toast = useCallback((text: string, type: "success" | "error" = "success") => setNotice({ text, type, id: Date.now() }), []);
  const addItem = (product: Product, size = product.sizes[0] || "استاندارد", color = product.colors[0]?.name || "پیش‌فرض", quantity = 1) => {
    const existingQuantity = cart.filter(i => i.productId === product.id).reduce((s, i) => s + i.quantity, 0);
    if (product.stock <= existingQuantity || existingQuantity + quantity > Math.min(product.stock, 10)) { toast("بیشتر از موجودی محصول نمی‌توانید اضافه کنید.", "error"); return; }
    const key = `${product.id}:${size}:${color}`;
    setCart(items => {
      const existing = items.find(i => i.key === key);
      if (existing) return items.map(i => i.key === key ? { ...i, price: product.price, quantity: i.quantity + quantity, stock: product.stock } : i);
      return [...items, { key, productId: product.id, slug: product.slug, name: product.name, image: product.image, price: product.price, stock: product.stock, quantity, size, color }];
    });
    toast("به سبد خریدت اضافه شد.");
    trackEvent("add_to_cart", product.slug, false); // فاز ۱۵ — آنالیتیکس
  };
  const updateQuantity = (key: string, quantity: number) => {
    setCart(items => {
      if (quantity <= 0) return items.filter(i => i.key !== key);
      return items.map(i => {
        if (i.key !== key) return i;
        const others = items.filter(other => other.productId === i.productId && other.key !== key).reduce((sum, item) => sum + item.quantity, 0);
        return { ...i, quantity: Math.max(1, Math.min(quantity, i.stock - others, 10 - others)) };
      });
    });
  };
  const toggleFavorite = (id: number) => setFavorites(items => {
    if (!items.includes(id)) trackEvent("wishlist", String(id), false); // فاز ۱۵ — فقط هنگام افزودن
    return items.includes(id) ? items.filter(i => i !== id) : [...items, id];
  });
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next); document.documentElement.dataset.theme = next;
    try { localStorage.setItem("kiya-theme", next); } catch {}
  };
  const install = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); return true;
  };
  return <ShopContext.Provider value={{ cart, favorites, theme, ready, addItem, updateQuantity, clearCart: () => setCart([]), toggleFavorite, toggleTheme, toast, install, installed }}>
    {children}
    {notice && <div ref={toastRef} popover="manual" className={`toast toast-${notice.type}`} role="status"><span>{notice.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}</span>{notice.text}<button aria-label="بستن پیام" onClick={() => setNotice(null)}><X size={16} /></button></div>}
  </ShopContext.Provider>;
}
export function useShop() { const context = useContext(ShopContext); if (!context) throw new Error("ShopProvider is required"); return context; }
