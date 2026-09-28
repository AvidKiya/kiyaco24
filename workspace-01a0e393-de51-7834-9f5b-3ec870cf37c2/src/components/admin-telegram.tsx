"use client";
import { useState } from "react";
import { Send, Link2, Check, TriangleAlert, Megaphone, Users, Trash2, RadioTower, MessageCircleMore, Bot } from "lucide-react";
import { money } from "@/lib/catalog";

/* ============================================================
 *  فاز ۱۲ — تب «ربات تلگرام» پنل مدیریت
 *  راه‌اندازی کامل ربات و کانال بدون یک خط کد
 * ============================================================ */

export type AdminTgData = {
  settings: {
    enabled: boolean; hasToken: boolean; tokenHint: string; botUsername: string;
    channelId: string; adminChatIds: string; webhookUrl: string; siteUrl: string;
    autoPublish: boolean; envToken: boolean; envChannel: string;
  };
  online: boolean;
  webhookPath: string;
  webhookSecret: string;
  chats: { id: number; chatId: string; name: string; username: string; phone: string; blocked: boolean; lastSeenAt: string; createdAt: string }[];
  chatCount: number;
};

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "ارتباط برقرار نشد.");
  return data as T;
}

type Props = {
  tg: AdminTgData;
  products: { id: number; name: string }[];
  saving: boolean;
  mutate: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onRefresh: () => Promise<void>;
};

const date = (value: string) => new Date(value).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });

export default function TelegramEditor({ tg, products, saving, mutate, onRefresh }: Props) {
  const s = tg.settings;
  const [form, setForm] = useState({
    enabled: s.enabled, botToken: "__keep__", botUsername: s.botUsername, channelId: s.channelId,
    adminChatIds: s.adminChatIds, siteUrl: s.siteUrl, autoPublish: s.autoPublish,
  });
  const [webhookBase, setWebhookBase] = useState(s.siteUrl);
  const [testChat, setTestChat] = useState("");
  const [post, setPost] = useState("");
  const [publishId, setPublishId] = useState(products[0]?.id ?? 0);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(key: string, action: string, payload: Record<string, unknown>) {
    setBusy(key); setNotice(null);
    try {
      const result = await call<{ message?: string }>(action, payload);
      setNotice({ ok: true, text: result.message || "انجام شد." });
      await onRefresh();
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "انجام نشد." });
    } finally { setBusy(""); }
  }

  return <div className="ai-admin">
    {/* ---- وضعیت ---- */}
    <div className="notify-channels">
      <div className={`notify-channel ${tg.online ? "connected" : ""}`}>
        <Bot size={19} />
        <div><strong>ربات تلگرام</strong><small>{tg.online ? "توکن تنظیم شده — ربات داخل خود سایت (وبهوک) اجرا می‌شود" : "بدون توکن — حالت آزمایشی: پیام‌ها فقط در گزارش سرور ثبت می‌شوند و چیزی از کار نمی‌افتد"}</small></div>
        <span className={`status-badge ${tg.online ? "status-delivered" : "status-pending"}`}>{tg.online ? "متصل" : "آزمایشی"}</span>
      </div>
      <div className={`notify-channel ${s.channelId ? "connected" : ""}`}>
        <Megaphone size={19} />
        <div><strong>کانال فروشگاه</strong><small>{s.channelId ? `${s.channelId} — انتشار خودکار ${s.autoPublish ? "روشن" : "خاموش"}` : "شناسهٔ کانال را تنظیم کنید تا محصول جدید و فروش ویژه خودکار پست شود"}</small></div>
      </div>
      <div className={`notify-channel ${tg.chatCount ? "connected" : ""}`}>
        <Users size={19} />
        <div><strong>کاربران ربات</strong><small>{tg.chatCount ? `${money(tg.chatCount)} گفتگوی فعال با ربات` : "هنوز کسی با ربات گفتگو نکرده است"}</small></div>
      </div>
    </div>

    {/* ---- تنظیمات ---- */}
    <section className="admin-card">
      <div className="admin-card-heading"><h2><RadioTower size={17} /> تنظیمات ربات و کانال</h2>
        <button className="button button-outline" disabled={busy === "test"} onClick={() => run("test", "tg.test", { chatId: testChat })}><MessageCircleMore size={15} />{busy === "test" ? "در حال ارسال..." : "پیام آزمایشی"}</button>
      </div>
      <div className="ai-card-body">
        <p className="muted">توکن را از @BotFather بگیرید و اینجا ذخیره کنید — ربات بدون سرور جدا، داخل خود سایت اجرا می‌شود و مشتری از تلگرام محصول می‌بیند، سبد می‌سازد و سفارشش مثل سفارش سایت ثبت می‌شود.</p>
        {notice && <p className={notice.ok ? "form-success" : "form-error"} role="alert">{notice.ok ? <Check size={15} /> : <TriangleAlert size={15} />} {notice.text}</p>}
        <div className="form-grid">
          <label className="editor-check"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />ربات فعال باشد</label>
          <label className="editor-check"><input type="checkbox" checked={form.autoPublish} onChange={e => setForm({ ...form, autoPublish: e.target.checked })} />انتشار خودکار محصول جدید و فروش ویژه در کانال</label>
          <label>توکن ربات<input dir="ltr" type="password" value={form.botToken === "__keep__" ? "" : form.botToken} onChange={e => setForm({ ...form, botToken: e.target.value })} placeholder={s.hasToken ? `ذخیره شده ${s.tokenHint} — برای تغییر تایپ کنید` : "123456:ABC-DEF..."} autoComplete="new-password" />{s.envToken && !s.hasToken && <small className="muted">در حال حاضر از env سرور خوانده می‌شود.</small>}</label>
          <label>نام کاربری ربات (بدون @)<input dir="ltr" value={form.botUsername} maxLength={100} onChange={e => setForm({ ...form, botUsername: e.target.value })} placeholder="KiyaShopBot" /></label>
          <label>شناسهٔ کانال<input dir="ltr" value={form.channelId} maxLength={100} onChange={e => setForm({ ...form, channelId: e.target.value })} placeholder={s.envChannel || "@KiyaAccessory یا -100xxxx"} /></label>
          <label>شناسهٔ چت مدیرها (با کاما)<input dir="ltr" value={form.adminChatIds} maxLength={300} onChange={e => setForm({ ...form, adminChatIds: e.target.value })} placeholder="123456789, 987654321" /><small className="muted">این چت‌ها به دستورهای /stats و /broadcast و /reply دسترسی دارند.</small></label>
          <label>آدرس عمومی سایت<input dir="ltr" value={form.siteUrl} maxLength={200} onChange={e => setForm({ ...form, siteUrl: e.target.value })} placeholder="https://kiya-shop.ir" /><small className="muted">برای لینک محصول‌ها داخل پیام‌ها و پست‌های کانال.</small></label>
          <label>چت مقصد پیام آزمایشی (اختیاری)<input dir="ltr" value={testChat} maxLength={50} onChange={e => setTestChat(e.target.value)} placeholder="خالی = چت مدیر یا کانال" /></label>
        </div>
        <div className="ai-card-actions"><button className="button button-lime" disabled={saving} onClick={async () => { const ok = await mutate("tg.settings", { settings: form }); if (ok) setForm(f => ({ ...f, botToken: "__keep__" })); }}>{saving ? "در حال ذخیره..." : "ذخیرهٔ تنظیمات"}</button></div>
      </div>
    </section>

    {/* ---- وبهوک ---- */}
    <section className="admin-card">
      <div className="admin-card-heading"><h2><Link2 size={17} /> اتصال وبهوک</h2></div>
      <div className="ai-card-body">
        <p className="muted">بعد از ذخیرهٔ توکن، دامنهٔ سایت را وارد و «ثبت وبهوک» را بزنید تا تلگرام پیام‌ها را مستقیم به سایت بفرستد. مسیر: <code dir="ltr">{tg.webhookPath}</code>{s.webhookUrl ? <> — آخرین ثبت: <code dir="ltr">{s.webhookUrl}</code></> : null}</p>
        <div className="form-grid">
          <label>دامنهٔ سایت (https)<input dir="ltr" value={webhookBase} maxLength={200} onChange={e => setWebhookBase(e.target.value)} placeholder="https://kiya-shop.ir" /></label>
        </div>
        <div className="ai-card-actions"><button className="button button-lime" disabled={busy === "webhook"} onClick={() => run("webhook", "tg.webhook.set", { url: webhookBase })}>{busy === "webhook" ? "در حال ثبت..." : "ثبت وبهوک"}</button></div>
      </div>
    </section>

    {/* ---- انتشار در کانال ---- */}
    <section className="admin-card">
      <div className="admin-card-heading"><h2><Send size={17} /> انتشار در کانال</h2></div>
      <div className="ai-card-body">
        <div className="ai-toolbar">
          <select value={publishId} onChange={e => setPublishId(Number(e.target.value))} aria-label="محصول برای انتشار در کانال">
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="button button-outline" disabled={busy === "publish" || !publishId} onClick={() => run("publish", "tg.publish", { productId: publishId })}>{busy === "publish" ? "در حال انتشار..." : "انتشار پست محصول"}</button>
        </div>
        <div className="form-grid">
          <label>پست متنی دلخواه<textarea rows={3} maxLength={2000} value={post} onChange={e => setPost(e.target.value)} placeholder="متن پست کانال..." /></label>
        </div>
        <div className="ai-card-actions"><button className="button button-lime" disabled={busy === "post" || post.trim().length < 5} onClick={async () => { await run("post", "tg.channel.post", { message: post }); setPost(""); }}>{busy === "post" ? "در حال ارسال..." : "ارسال پست به کانال"}</button></div>
      </div>
    </section>

    {/* ---- کاربران ربات ---- */}
    <section className="admin-card">
      <div className="admin-card-heading"><h2><Users size={17} /> کاربران ربات</h2><span className="muted">{money(tg.chatCount)} گفتگو</span></div>
      <div className="ai-card-body">
        {tg.chats.length ? <div className="admin-table-scroll"><table className="admin-table">
          <thead><tr><th>نام</th><th>شناسهٔ چت</th><th>موبایل</th><th>آخرین فعالیت</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>{tg.chats.map(chat => <tr key={chat.id}>
            <td><strong>{chat.name || "—"}</strong>{chat.username ? <small dir="ltr"> @{chat.username}</small> : null}</td>
            <td dir="ltr">{chat.chatId}</td>
            <td dir="ltr">{chat.phone || "—"}</td>
            <td>{date(chat.lastSeenAt)}</td>
            <td><span className={`status-badge ${chat.blocked ? "status-cancelled" : "status-delivered"}`}>{chat.blocked ? "مسدود کرده" : "فعال"}</span></td>
            <td><button className="icon-button danger-action" title="حذف گفتگو" aria-label={`حذف گفتگوی ${chat.name || chat.chatId}`} disabled={saving} onClick={async () => { if (window.confirm("این گفتگو و سبد آن حذف شود؟")) await mutate("tg.chat.delete", { id: chat.id }); }}><Trash2 size={15} /></button></td>
          </tr>)}</tbody>
        </table></div> : <p className="muted">هنوز کسی با ربات گفتگو نکرده است. بعد از ثبت وبهوک، ربات را در کانال و سایت معرفی کنید.</p>}
        <p className="muted">دستورهای مدیر داخل ربات: <code dir="ltr">/stats</code> آمار فروش · <code dir="ltr">/broadcast متن</code> پیام همگانی · <code dir="ltr">/reply_شناسه متن</code> پاسخ به پیام پشتیبانی (پاسخ کاربران تلگرامی داخل تلگرام و بقیه با پیامک می‌رود).</p>
      </div>
    </section>
  </div>;
}
