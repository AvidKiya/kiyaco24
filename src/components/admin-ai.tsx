"use client";
import { useState } from "react";
import { Bot, Plug, Check, TriangleAlert, Wand2, TrendingUp, Trash2, Copy, RefreshCw, Sparkles, Coins, Database } from "lucide-react";
import { useShop } from "./shop-provider";
import { money } from "@/lib/catalog";

/* ============================================================
 *  فاز ۱۱ — تب «دستیار هوشمند» پنل مدیریت
 *  اتصال به هر سرویس OpenAI-compatible از داخل پنل (بدون کد)
 * ============================================================ */

export type AdminAiData = {
  settings: {
    enabled: boolean; baseUrl: string; model: string; hasKey: boolean; keyHint: string;
    temperature: number; maxTokens: number; monthlyTokenBudget: number;
    features: Record<string, boolean>; assistantName: string; envBaseUrl: string; envModel: string;
  };
  online: boolean; effectiveModel: string;
  logs: { id: number; feature: string; source: string; model: string; promptTokens: number; completionTokens: number; durationMs: number; error: string; createdAt: string }[];
  usage: { feature: string; calls: number; tokens: number }[];
  monthlyTokens: number;
  cache: { entries: number; hits: number };
};

const featureList = [
  { id: "stylist", title: "مشاور استایل (چت سایت)", hint: "ویجت گفتگو برای پیشنهاد ست بر اساس مناسبت و بودجه" },
  { id: "search", title: "جستجوی هوشمند", hint: "جستجو با زبان طبیعی؛ نتیجه فقط از کاتالوگ واقعی" },
  { id: "size", title: "پیشنهاد سایز", hint: "محاسبهٔ قطعی سایز از قد/وزن — بدون خطای مدل" },
  { id: "recommend", title: "پیشنهاد محصول مکمل", hint: "ست پیشنهادی صفحهٔ محصول — بدون هزینهٔ توکن" },
  { id: "captions", title: "تولید کپشن", hint: "کپشن اینستاگرام/تلگرام/صفحهٔ محصول" },
  { id: "trends", title: "تحلیل ترند", hint: "گزارش رشد/افت دسته‌ها از فروش واقعی" },
];
const featureNames: Record<string, string> = Object.fromEntries(featureList.map(f => [f.id, f.title]));
featureNames.test = "تست اتصال";
const sourceLabels: Record<string, string> = { ai: "سرویس AI", fallback: "موتور آفلاین", cache: "کش", rule: "محاسبهٔ قطعی", error: "خطا" };
const sourceClass: Record<string, string> = { ai: "status-delivered", fallback: "status-pending", cache: "status-delivered", rule: "status-delivered", error: "status-cancelled" };
const date = (value: string) => new Date(value).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });

type Props = {
  ai: AdminAiData;
  products: { id: number; name: string }[];
  saving: boolean;
  mutate: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onRefresh: () => Promise<void>;
};

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "ارتباط برقرار نشد.");
  return data as T;
}

export default function AiEditor({ ai, products, saving, mutate, onRefresh }: Props) {
  const shop = useShop();
  const s = ai.settings;
  const [form, setForm] = useState({
    enabled: s.enabled, baseUrl: s.baseUrl, apiKey: "__keep__", model: s.model,
    temperature: s.temperature, maxTokens: s.maxTokens, monthlyTokenBudget: s.monthlyTokenBudget,
    features: { ...Object.fromEntries(featureList.map(f => [f.id, s.features[f.id] !== false])) },
    assistantName: s.assistantName,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [captionProduct, setCaptionProduct] = useState(products[0]?.id ?? 0);
  const [captions, setCaptions] = useState<{ instagram: string; telegram: string; page: string; source: string } | null>(null);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [trend, setTrend] = useState<{ report: string; source: string } | null>(null);
  const [trendBusy, setTrendBusy] = useState(false);

  async function saveSettings() {
    if (await mutate("ai.settings", { settings: form })) setForm(f => ({ ...f, apiKey: "__keep__" }));
  }

  async function testConnection() {
    setTesting(true); setTestResult(null);
    try { const result = await call<{ ok: boolean; message: string }>("ai.test"); setTestResult(result); }
    catch (error) { setTestResult({ ok: false, message: error instanceof Error ? error.message : "تست انجام نشد." }); }
    finally { setTesting(false); }
  }

  async function makeCaptions() {
    if (!captionProduct) return;
    setCaptionBusy(true);
    try { const result = await call<{ captions: { instagram: string; telegram: string; page: string; source: string } }>("ai.caption", { productId: captionProduct }); setCaptions(result.captions); }
    catch (error) { shop.toast(error instanceof Error ? error.message : "تولید کپشن انجام نشد.", "error"); }
    finally { setCaptionBusy(false); }
  }

  async function makeTrend() {
    setTrendBusy(true);
    try { const result = await call<{ report: string; source: string }>("ai.trend"); setTrend(result); }
    catch (error) { shop.toast(error instanceof Error ? error.message : "تحلیل انجام نشد.", "error"); }
    finally { setTrendBusy(false); }
  }

  function copy(text: string) { navigator.clipboard?.writeText(text).then(() => shop.toast("کپی شد.")); }

  return <div className="ai-admin">
    {/* ---- وضعیت ---- */}
    <div className="notify-channels">
      <div className={`notify-channel ${ai.online ? "connected" : ""}`}>
        <Bot size={19} />
        <div><strong>سرویس هوش مصنوعی</strong><small>{ai.online ? `متصل — مدل ${ai.effectiveModel}` : "متصل نیست — موتور آفلاین (قانون‌محور) پاسخ می‌دهد و هیچ بخشی از سایت از کار نمی‌افتد"}</small></div>
        <span className={`status-badge ${ai.online ? "status-delivered" : "status-pending"}`}>{ai.online ? "آنلاین" : "آفلاین"}</span>
      </div>
      <div className="notify-channel connected">
        <Coins size={19} />
        <div><strong>مصرف توکن این ماه</strong><small>{money(ai.monthlyTokens)} توکن{s.monthlyTokenBudget ? ` از سقف ${money(s.monthlyTokenBudget)}` : " — بدون سقف"}</small></div>
      </div>
      <div className="notify-channel connected">
        <Database size={19} />
        <div><strong>کش پاسخ‌ها</strong><small>{money(ai.cache.entries)} پاسخ ذخیره · {money(ai.cache.hits)} بار استفادهٔ مجدد (صرفه‌جویی توکن)</small></div>
        <button className="text-link" onClick={() => call("ai.cache.clear").then(() => { shop.toast("کش خالی شد."); void onRefresh(); }).catch(() => shop.toast("انجام نشد.", "error"))}>خالی کردن</button>
      </div>
    </div>

    {/* ---- تنظیمات اتصال ---- */}
    <section className="admin-card">
      <div className="admin-card-heading"><h2>اتصال سرویس AI</h2>
        <button className="button button-outline" disabled={testing} onClick={testConnection}>{testing ? "در حال تست..." : "تست اتصال"}<RefreshCw size={15} className={testing ? "spin" : ""} /></button>
      </div>
      <div className="ai-card-body">
      <p className="muted">هر سرویس سازگار با OpenAI را می‌توانید وصل کنید: سرویس‌دهندهٔ ایرانی (آوال‌ای، گیلاس، متیس و…)، واسط معتبر، یا مدل متن‌باز روی سرور خودتان. بدون اتصال هم، همهٔ قابلیت‌ها با «موتور آفلاین» کار می‌کنند.</p>
      {testResult && <p className={testResult.ok ? "form-success" : "form-error"} role="alert">{testResult.ok ? <Check size={15} /> : <TriangleAlert size={15} />} {testResult.message}</p>}
      <div className="form-grid">
        <label className="editor-check"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />سرویس آنلاین AI فعال باشد</label>
        <label>نام دستیار (نمایش در سایت)<input value={form.assistantName} maxLength={50} onChange={e => setForm({ ...form, assistantName: e.target.value })} placeholder="مشاور کیا" /></label>
        <label>آدرس پایه (Base URL)<input dir="ltr" value={form.baseUrl} maxLength={300} onChange={e => setForm({ ...form, baseUrl: e.target.value })} placeholder={s.envBaseUrl || "https://api.example.ir/v1"} />{s.envBaseUrl && !form.baseUrl && <small className="muted">از env: {s.envBaseUrl}</small>}</label>
        <label>کلید API<input dir="ltr" type="password" value={form.apiKey === "__keep__" ? "" : form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} placeholder={s.hasKey ? `ذخیره شده ${s.keyHint} — برای تغییر تایپ کنید` : "sk-..."} autoComplete="new-password" /></label>
        <label>نام مدل<input dir="ltr" value={form.model} maxLength={100} onChange={e => setForm({ ...form, model: e.target.value })} placeholder={s.envModel || "gpt-4o-mini"} /></label>
        <label>سقف توکن ماهانه (۰ = بدون سقف)<input type="number" min={0} value={form.monthlyTokenBudget} onChange={e => setForm({ ...form, monthlyTokenBudget: Number(e.target.value) || 0 })} /><small className="muted">بعد از عبور از سقف، موتور آفلاین جایگزین می‌شود تا هزینه کنترل بماند.</small></label>
        <label>خلاقیت پاسخ (دما × ۱۰۰)<input type="number" min={0} max={200} value={form.temperature} onChange={e => setForm({ ...form, temperature: Number(e.target.value) || 0 })} /><small className="muted">۷۰ یعنی ۰٫۷ — عدد بالاتر، پاسخ خلاقانه‌تر.</small></label>
        <label>حداکثر توکن هر پاسخ<input type="number" min={100} max={4000} value={form.maxTokens} onChange={e => setForm({ ...form, maxTokens: Number(e.target.value) || 700 })} /></label>
      </div>
      <h3 className="ai-features-title"><Sparkles size={16} />قابلیت‌ها</h3>
      <div className="ai-feature-grid">
        {featureList.map(feature => <label key={feature.id} className={`ai-feature ${form.features[feature.id] ? "on" : ""}`}>
          <input type="checkbox" checked={!!form.features[feature.id]} onChange={e => setForm({ ...form, features: { ...form.features, [feature.id]: e.target.checked } })} />
          <span><strong>{feature.title}</strong><small>{feature.hint}</small></span>
        </label>)}
      </div>
      <div className="ai-card-actions"><button className="button button-lime" disabled={saving} onClick={saveSettings}>{saving ? "در حال ذخیره..." : "ذخیرهٔ تنظیمات"}</button></div>
      </div>
    </section>

    {/* ---- ابزار: کپشن‌ساز ---- */}
    <section className="admin-card">
      <div className="admin-card-heading"><h2>کپشن‌ساز محصول</h2><Wand2 size={18} /></div>
      <div className="ai-card-body">
      <p className="muted">برای هر محصول، سه نسخهٔ آمادهٔ انتشار: اینستاگرام، کانال تلگرام و متن فروش صفحهٔ محصول.</p>
      <div className="ai-toolbar">
        <select value={captionProduct} onChange={e => setCaptionProduct(Number(e.target.value))} aria-label="انتخاب محصول">
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="button button-outline" disabled={captionBusy || !captionProduct} onClick={makeCaptions}>{captionBusy ? "در حال تولید..." : "تولید کپشن"}<Wand2 size={15} /></button>
      </div>
      {captions && <div className="ai-captions">
        <span className={`status-badge ${captions.source === "ai" ? "status-delivered" : "status-pending"}`}>{captions.source === "ai" ? "تولید مدل AI" : "قالب آفلاین"}</span>
        {[{ id: "instagram", title: "اینستاگرام", value: captions.instagram }, { id: "telegram", title: "کانال تلگرام", value: captions.telegram }, { id: "page", title: "صفحهٔ محصول", value: captions.page }].map(item =>
          <div key={item.id} className="ai-caption">
            <div><strong>{item.title}</strong><button className="text-link" onClick={() => copy(item.value)}><Copy size={14} />کپی</button></div>
            <textarea readOnly value={item.value} rows={5} />
          </div>)}
      </div>}
      </div>
    </section>

    {/* ---- ابزار: تحلیل ترند ---- */}
    <section className="admin-card">
      <div className="admin-card-heading"><h2>تحلیل ترند فروش</h2>
        <button className="button button-outline" disabled={trendBusy} onClick={makeTrend}>{trendBusy ? "در حال تحلیل..." : "تحلیل کن"}<TrendingUp size={15} /></button>
      </div>
      <div className="ai-card-body">
      <p className="muted">دادهٔ واقعی ۳۰ روز اخیر (فروش، لیست انتظار موجودی، سبدهای رهاشده) تحلیل می‌شود و پیشنهاد خرید/محتوا می‌گیرید.</p>
      {trend && <div className="ai-trend-report">
        <span className={`status-badge ${trend.source === "ai" ? "status-delivered" : "status-pending"}`}>{trend.source === "ai" ? "روایت مدل AI" : "گزارش آماری"}</span>
        <pre>{trend.report}</pre>
        <button className="text-link" onClick={() => copy(trend.report)}><Copy size={14} />کپی گزارش</button>
      </div>}
      </div>
    </section>

    {/* ---- گزارش مصرف ---- */}
    <section className="admin-card">
      <div className="admin-card-heading"><h2>گزارش مصرف</h2>
        <button className="text-link" onClick={() => call("ai.logs.clear").then(() => { shop.toast("گزارش پاک شد."); void onRefresh(); }).catch(() => shop.toast("انجام نشد.", "error"))}><Trash2 size={15} />پاک کردن گزارش</button>
      </div>
      <div className="ai-card-body ai-logs-body">
      {!!ai.usage.length && <div className="ai-usage-chips">{ai.usage.map(u => <span key={u.feature}>{featureNames[u.feature] || u.feature}: {money(u.calls)} فراخوانی · {money(u.tokens)} توکن</span>)}</div>}
      {ai.logs.length ? <div className="admin-table-scroll"><table className="admin-table">
        <thead><tr><th>قابلیت</th><th>منبع پاسخ</th><th>توکن</th><th>زمان</th><th>تاریخ</th><th>خطا</th></tr></thead>
        <tbody>{ai.logs.map(log => <tr key={log.id}>
          <td>{featureNames[log.feature] || log.feature}</td>
          <td><span className={`status-badge ${sourceClass[log.source] || ""}`}>{sourceLabels[log.source] || log.source}</span></td>
          <td>{log.promptTokens + log.completionTokens ? money(log.promptTokens + log.completionTokens) : "—"}</td>
          <td>{log.durationMs ? `${money(log.durationMs)}ms` : "—"}</td>
          <td>{date(log.createdAt)}</td>
          <td className="ai-log-error">{log.error || "—"}</td>
        </tr>)}</tbody>
      </table></div> : <p className="muted">هنوز فراخوانی ثبت نشده است.</p>}
      </div>
    </section>
  </div>;
}
