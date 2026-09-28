"use client";
import { useState, type FormEvent } from "react";
import { LockKeyhole, Save } from "lucide-react";
import { useShop } from "./shop-provider";
export default function AdminSecurity() {
  const [currentPassword, setCurrent] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const { toast } = useShop();
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirm) { setError("تکرار رمز جدید یکسان نیست."); return; }
    if (password === currentPassword) { setError("رمز جدید باید با رمز فعلی متفاوت باشد."); return; }
    setLoading(true);
    try { const response = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "password.change", currentPassword, password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setCurrent(""); setPassword(""); setConfirm(""); toast("رمز تغییر کرد و نشست‌های قبلی بسته شدند."); }
    catch (error) { setError(error instanceof Error ? error.message : "تغییر رمز انجام نشد."); }
    finally { setLoading(false); }
  }
  return <section className="admin-card admin-password-card"><div className="admin-card-heading"><h2>تغییر رمز مدیر</h2><LockKeyhole size={18} /></div><form className="form-stack" onSubmit={submit}><label>رمز فعلی<input required dir="ltr" type="password" autoComplete="current-password" maxLength={128} value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label><label>رمز جدید<input required dir="ltr" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label><label>تکرار رمز جدید<input required dir="ltr" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} /></label><p className="muted" style={{ fontSize: 10 }}>با تغییر رمز، همهٔ نشست‌های قبلی بسته می‌شوند و فقط همین نشست باقی می‌ماند.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-lime" disabled={loading}><Save size={16} />{loading ? "در حال تغییر..." : "ذخیرهٔ رمز جدید"}</button></form></section>;
}
