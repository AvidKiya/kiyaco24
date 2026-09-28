"use client";
import { useState } from "react";
import { BellRing, Send, RefreshCw, Trash2, Pencil, Plus, Clock3, Check, TriangleAlert, MessageSquare, Zap, Users, ShoppingCart, Tag, Info } from "lucide-react";
import { Modal, EmptyState } from "./ui";
import { useShop } from "./shop-provider";
import { money } from "@/lib/catalog";

export type AdminAlertRule = { id: number; key: string; title: string; trigger: string; channels: string[]; smsBody: string; emailSubject: string; emailBody: string; pushBody: string; delayMinutes: number; active: boolean; position: number; createdAt: string };
export type AdminOutboxMessage = { id: number; channel: string; recipient: string; subject: string; body: string; link: string; status: string; attempts: number; provider: string; error: string; ruleKey: string; customerId: number | null; createdAt: string; sentAt: string | null };
export type AdminAbandonedCart = { id: number; phone: string; customerId: number | null; items: { productId: number; name: string; image: string; price: number; quantity: number; size: string; color: string }[]; total: number; step: string; reminders: number; lastReminderAt: string | null; recoveredAt: string | null; createdAt: string; updatedAt: string };
export type AdminStockAlert = { id: number; productId: number; type: string; phone: string; email: string; priceAtRequest: number; notifiedAt: string | null; createdAt: string };
export type AdminPushSubscription = { id: number; phone: string; customerId: number | null; createdAt: string };
export type AdminChannelStatus = { id: string; title: string; connected: boolean; hint: string };

const triggerLabels: Record<string, string> = {
  order_status: "تغییر وضعیت سفارش", payment: "پرداخت سفارش", shipping: "ارسال سفارش",
  welcome: "خوش‌آمدگویی عضو جدید", first_purchase: "اولین خرید مشتری", returning: "بازگشت مشتری",
  birthday: "تبریک تولد", price_drop: "کاهش قیمت محصول", back_in_stock: "موجود شدن محصول",
  new_collection: "کالکشن جدید", partner_update: "به‌روزرسانی همکاری عمده", abandoned_cart: "سبد رهاشده", manual: "ارسال دستی",
};
const channelLabels: Record<string, string> = { sms: "پیامک", email: "ایمیل", push: "Push مرورگر", telegram: "تلگرام", web: "اعلان درون‌برنامه" };
const allChannels = ["sms", "email", "push", "telegram", "web"];
const variables = "{name} {order} {status} {amount} {tracking} {product} {points} {code} {link}";
const statusLabels: Record<string, string> = { pending: "در صف", sent: "ارسال شد", failed: "ناموفق" };
const statusClass: Record<string, string> = { pending: "status-pending", sent: "status-delivered", failed: "status-cancelled" };
const date = (value: string | null) => value ? new Date(value).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }) : "—";

type Props = {
  rules: AdminAlertRule[]; messages: AdminOutboxMessage[]; carts: AdminAbandonedCart[]; alerts: AdminStockAlert[];
  pushSubscriptions: AdminPushSubscription[]; channels: AdminChannelStatus[]; products: { id: number; name: string }[];
  saving: boolean; mutate: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onRefresh: () => Promise<void>;
};

export default function NotificationsEditor({ rules, messages, carts, alerts, pushSubscriptions, channels, products, saving, onRefresh }: Props) {
  const shop = useShop();
  const [editing, setEditing] = useState<AdminAlertRule | "new" | null>(null);
  const [testing, setTesting] = useState<AdminAlertRule | null>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  const sentToday = messages.filter(m => m.status === "sent" && new Date(m.createdAt).toDateString() === new Date().toDateString()).length;
  const failed = messages.filter(m => m.status === "failed").length;
  const pending = messages.filter(m => m.status === "pending").length;
  const visible = filter === "all" ? messages : messages.filter(m => m.status === filter);
  const productName = (id: number) => products.find(p => p.id === id)?.name ?? `محصول ${id}`;

  async function act(action: string, payload: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "انجام نشد.");
      await onRefresh();
      shop.toast(result.message || message);
    } catch (error) { shop.toast(error instanceof Error ? error.message : "انجام نشد.", "error"); }
    finally { setBusy(false); }
  }

  return <div className="notify-admin">
    <div className="admin-stats">
      {[
        { title: "ارسال‌شدهٔ امروز", value: money(sentToday), unit: "پیام", caption: "تمام کانال‌ها", icon: Check },
        { title: "در صف ارسال", value: money(pending), unit: "پیام", caption: "با اولین درخواست ارسال می‌شود", icon: Clock3 },
        { title: "ارسال ناموفق", value: money(failed), unit: "پیام", caption: "قابل ارسال مجدد", icon: TriangleAlert },
        { title: "قوانین فعال", value: money(rules.filter(r => r.active).length), unit: "قانون", caption: `از ${money(rules.length)} قانون خودکار`, icon: Zap },
        { title: "سبد رهاشده", value: money(carts.filter(c => !c.recoveredAt).length), unit: "سبد", caption: `${money(carts.filter(c => c.recoveredAt).length)} سبد بازیابی شده`, icon: ShoppingCart },
        { title: "در انتظار اطلاع‌رسانی", value: money(alerts.filter(a => !a.notifiedAt).length), unit: "درخواست", caption: "موجودی و کاهش قیمت", icon: Tag },
        { title: "مشترک Push", value: money(pushSubscriptions.length), unit: "مرورگر", caption: "اعلان مرورگر (PWA)", icon: BellRing },
      ].map((stat, i) => <div className="admin-stat" key={stat.title}><div><span>{stat.title}</span><span className={`stat-icon stat-icon-${i}`}><stat.icon size={20} /></span></div><strong>{stat.value}<small>{stat.unit}</small></strong><p>{stat.caption}</p></div>)}
    </div>

    <section className="admin-card">
      <div className="admin-card-heading"><h2>کانال‌های اطلاع‌رسانی</h2><BellRing size={18} /></div>
      <div className="notify-channels">
        {channels.map(channel => <article key={channel.id} className={`notify-channel ${channel.connected ? "connected" : ""}`}>
          <div><h3>{channel.title}</h3><span className={channel.connected ? "connected" : "disconnected"}>{channel.connected ? "متصل است" : "در حالت آزمایشی (لاگ سرور)"}</span></div>
          <code dir="ltr">{channel.hint}</code>
        </article>)}
        <article className="notify-channel connected"><div><h3>اعلان درون‌برنامه</h3><span className="connected">همیشه فعال</span></div><p>پیام‌های پنل مشتری، بدون نیاز به سرویس بیرونی ثبت می‌شود.</p></article>
      </div>
      <p className="admin-hint"><Info size={15} /> تا زمانی که کلید سرویس پیامک/ایمیل وارد نشده، پیام‌ها در لاگ سرور ثبت و با وضعیت «ارسال شد» ذخیره می‌شوند؛ پس از اتصال پنل پیامکی، بدون تغییر کد ارسال واقعی شروع می‌شود.</p>
    </section>

    <section className="admin-card">
      <div className="admin-card-heading"><h2>قوانین خودکار اعلان</h2><button className="button button-lime" onClick={() => setEditing("new")}><Plus size={17} />قانون جدید</button></div>
      <div className="admin-table-scroll"><table className="admin-table">
        <thead><tr><th>رویداد</th><th>کانال‌ها</th><th>تأخیر</th><th>وضعیت</th><th>مدیریت</th></tr></thead>
        <tbody>
          {rules.map(rule => <tr key={rule.id}>
            <td><strong>{rule.title}</strong><small className="muted"> {triggerLabels[rule.trigger] ?? rule.trigger}</small><small dir="ltr" className="rule-key">{rule.key}</small></td>
            <td>{rule.channels.map(channel => <span className="inline-badge" key={channel}>{channelLabels[channel] ?? channel}</span>)}</td>
            <td>{rule.delayMinutes ? `${money(rule.delayMinutes)} دقیقه` : "بی‌درنگ"}</td>
            <td><span className={`status-badge ${rule.active ? "status-delivered" : "status-cancelled"}`}>{rule.active ? "فعال" : "غیرفعال"}</span></td>
            <td><div className="table-actions">
              <button className="icon-button" title="ویرایش قانون" aria-label={`ویرایش ${rule.title}`} onClick={() => setEditing(rule)}><Pencil size={16} /></button>
              <button className="icon-button" title="ارسال پیام آزمایشی" aria-label={`ارسال آزمایشی ${rule.title}`} onClick={() => setTesting(rule)}><Send size={16} /></button>
              <button className="icon-button danger-action" title="حذف قانون" aria-label={`حذف ${rule.title}`} disabled={saving || busy} onClick={() => { if (window.confirm(`قانون «${rule.title}» حذف شود؟`)) void act("rule.delete", { key: rule.key }, "قانون حذف شد."); }}><Trash2 size={16} /></button>
            </div></td>
          </tr>)}
        </tbody>
      </table></div>
      <div className="admin-form-footer"><p>متغیرهای قابل استفاده در متن پیام: <code dir="ltr">{variables}</code></p><button className="button button-outline" disabled={saving || busy} onClick={() => { if (window.confirm("همهٔ قوانین به حالت پیش‌فرض برگردانده شوند؟")) void act("rule.reset", {}, "قوانین پیش‌فرض بازگردانی شد."); }}><RefreshCw size={16} />بازگردانی قوانین پیش‌فرض</button></div>
    </section>

    <section className="admin-card">
      <div className="admin-card-heading"><h2>پیام‌های ارسالی</h2>
        <div className="admin-heading-actions">
          <button className="button button-outline" disabled={saving || busy} onClick={() => void act("outbox.retry", {}, "ارسال مجدد پیام‌های ناموفق انجام شد.")}><RefreshCw size={16} />ارسال مجدد ناموفق‌ها</button>
          <button className="button button-outline" disabled={saving || busy} onClick={() => { if (window.confirm("تاریخچهٔ پیام‌های ارسال‌شده و ناموفق پاک شود؟")) void act("outbox.clear", { days: 0 }, "صف پیام‌ها پاک‌سازی شد."); }}><Trash2 size={16} />پاک‌سازی تاریخچه</button>
        </div>
      </div>
      <div className="admin-table-toolbar">
        <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="فیلتر وضعیت پیام">
          <option value="all">همهٔ پیام‌ها</option><option value="pending">در صف</option><option value="sent">ارسال‌شده</option><option value="failed">ناموفق</option>
        </select>
        <span>{money(visible.length)} پیام</span>
      </div>
      {visible.length ? <div className="admin-table-scroll"><table className="admin-table">
        <thead><tr><th>کانال</th><th>مقصد</th><th>متن</th><th>وضعیت</th><th>زمان</th><th>ارسال مجدد</th></tr></thead>
        <tbody>{visible.map(message => <tr key={message.id}>
          <td><span className="inline-badge">{channelLabels[message.channel] ?? message.channel}</span><small className="muted"> {message.ruleKey}</small></td>
          <td dir="ltr">{message.recipient || "—"}</td>
          <td className="notify-body">{message.body}{message.error && <small className="notify-error">{message.error}</small>}</td>
          <td><span className={`status-badge ${statusClass[message.status] ?? ""}`}>{statusLabels[message.status] ?? message.status}</span><small className="muted"> {money(message.attempts)} تلاش</small></td>
          <td>{date(message.sentAt || message.createdAt)}</td>
          <td>{message.status === "failed" && <button className="icon-button" title="ارسال مجدد" aria-label="ارسال مجدد پیام" disabled={busy} onClick={() => void act("outbox.retry", { ids: [message.id] }, "پیام دوباره ارسال شد.")}><RefreshCw size={16} /></button>}</td>
        </tr>)}</tbody>
      </table></div> : <EmptyState icon={<MessageSquare size={30} />} title="هنوز پیامی ارسال نشده" text="با اولین سفارش، ثبت‌نام مشتری یا تغییر وضعیت سفارش، پیام‌ها اینجا ثبت می‌شوند." />}
    </section>

    <div className="notify-grid">
      <section className="admin-card">
        <div className="admin-card-heading"><h2>سبدهای رهاشده</h2><ShoppingCart size={18} /></div>
        {carts.length ? <div className="admin-table-scroll"><table className="admin-table">
          <thead><tr><th>موبایل</th><th>اقلام</th><th>مبلغ</th><th>مرحله</th><th>یادآوری</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>{carts.map(cart => <tr key={cart.id}>
            <td dir="ltr">{cart.phone || "—"}</td>
            <td>{cart.items.map(item => <span className="inline-badge" key={item.productId}>{item.name} ×{money(item.quantity)}</span>)}</td>
            <td>{money(cart.total)} تومان</td>
            <td>{cart.step === "checkout" ? "تکمیل خرید" : "سبد خرید"}</td>
            <td>{money(cart.reminders)} بار</td>
            <td><span className={`status-badge ${cart.recoveredAt ? "status-delivered" : "status-pending"}`}>{cart.recoveredAt ? "بازیابی شده" : "در انتظار"}</span></td>
            <td>{!cart.recoveredAt && <button className="icon-button" title="یادآوری دستی" aria-label="ارسال یادآوری" disabled={busy} onClick={() => void act("cart.remind", { id: cart.id }, "یادآوری ارسال شد.")}><Send size={16} /></button>}</td>
          </tr>)}</tbody>
        </table></div> : <EmptyState icon={<ShoppingCart size={30} />} title="سبد رهاشده‌ای ثبت نشده" text="اگر مشتری سبدش را بدون خرید ببندد، اینجا ثبت و به‌صورت خودکار یادآوری می‌شود." />}
      </section>

      <section className="admin-card">
        <div className="admin-card-heading"><h2>درخواست اطلاع‌رسانی مشتریان</h2><Tag size={18} /></div>
        {alerts.length ? <div className="admin-table-scroll"><table className="admin-table">
          <thead><tr><th>محصول</th><th>نوع</th><th>موبایل</th><th>ایمیل</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
          <tbody>{alerts.map(alert => <tr key={alert.id}>
            <td>{productName(alert.productId)}</td>
            <td>{alert.type === "price_drop" ? "کاهش قیمت" : "موجود شدن"}</td>
            <td dir="ltr">{alert.phone || "—"}</td>
            <td dir="ltr">{alert.email || "—"}</td>
            <td><span className={`status-badge ${alert.notifiedAt ? "status-delivered" : "status-pending"}`}>{alert.notifiedAt ? "اعلام شد" : "در انتظار"}</span></td>
            <td>{date(alert.createdAt)}</td>
          </tr>)}</tbody>
        </table></div> : <EmptyState icon={<Tag size={30} />} title="درخواستی ثبت نشده" text="دکمهٔ «وقت که موجود شد بگو» و «کاهش قیمت را بگو» در صفحهٔ محصول، درخواست‌ها را اینجا ذخیره می‌کند." />}
      </section>
    </div>

    <BroadcastCard saving={saving} busy={busy} onSend={(title, message, audience, link) => act("broadcast", { title, message, audience, link }, "پیام همگانی ارسال شد.")} />

    <section className="admin-card">
      <div className="admin-card-heading"><h2>مشترکین اعلان مرورگر</h2><span className="muted">{money(pushSubscriptions.length)} مرورگر</span></div>
      {pushSubscriptions.length ? <div className="admin-table-scroll"><table className="admin-table">
        <thead><tr><th>موبایل</th><th>حساب مشتری</th><th>تاریخ عضویت</th></tr></thead>
        <tbody>{pushSubscriptions.map(subscription => <tr key={subscription.id}><td dir="ltr">{subscription.phone || "مهمان"}</td><td>{subscription.customerId ? `#${money(subscription.customerId)}` : "مهمان"}</td><td>{date(subscription.createdAt)}</td></tr>)}</tbody>
      </table></div> : <EmptyState icon={<Users size={30} />} title="هنوز کسی اعلان مرورگر را فعال نکرده" text="با نصب سایت به‌عنوان اپلیکیشن (PWA) و زدن دکمهٔ «فعال‌سازی اعلان»، مشترکین اینجا ثبت می‌شوند." />}
    </section>

    {editing && <RuleEditor rule={editing === "new" ? null : editing} saving={saving} busy={busy} onClose={() => setEditing(null)} onSave={values => act("rule.save", values as unknown as Record<string, unknown>, "قانون ذخیره شد.")} />}
    {testing && <TestDialog rule={testing} onClose={() => setTesting(null)} onSend={(channel, recipient) => act("rule.test", { key: testing.key, channel, recipient }, "پیام آزمایشی ارسال شد.")} />}
  </div>;
}

function RuleEditor({ rule, saving, busy, onClose, onSave }: { rule: AdminAlertRule | null; saving: boolean; busy: boolean; onClose: () => void; onSave: (values: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState<AdminAlertRule>(rule || { id: 0, key: "", title: "", trigger: "manual", channels: ["sms", "web"], smsBody: "", emailSubject: "", emailBody: "", pushBody: "", delayMinutes: 0, active: true, position: 0, createdAt: "" });
  const set = <K extends keyof AdminAlertRule>(key: K, value: AdminAlertRule[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleChannel = (channel: string) => set("channels", form.channels.includes(channel) ? form.channels.filter(c => c !== channel) : [...form.channels, channel]);

  return <Modal title={rule ? `ویرایش قانون: ${rule.title}` : "قانون اعلان جدید"} onClose={onClose} wide>
    <form className="form-stack" onSubmit={e => { e.preventDefault(); void onSave(form); onClose(); }}>
      <div className="form-grid">
        <label>کلید قانون (انگلیسی، یکتا)<input required dir="ltr" pattern="[a-zA-Z0-9_]{3,40}" value={form.key} disabled={!!rule} onChange={e => set("key", e.target.value.replace(/[^a-zA-Z0-9_]/g, "_"))} placeholder="order_status" /></label>
        <label>عنوان قانون<input required maxLength={120} value={form.title} onChange={e => set("title", e.target.value)} placeholder="مثلاً: اطلاع‌رسانی ارسال سفارش" /></label>
        <label>رویداد<select value={form.trigger} onChange={e => set("trigger", e.target.value)}>{Object.entries(triggerLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>تأخیر ارسال (دقیقه)<input type="number" min={0} max={10080} value={form.delayMinutes} onChange={e => set("delayMinutes", Number(e.target.value))} /></label>
      </div>
      <fieldset className="notify-channels-field"><legend>کانال‌های ارسال</legend>
        {allChannels.map(channel => <label className="editor-check" key={channel}><input type="checkbox" checked={form.channels.includes(channel)} onChange={() => toggleChannel(channel)} />{channelLabels[channel]}</label>)}
      </fieldset>
      <label>متن پیامک<textarea rows={3} maxLength={700} value={form.smsBody} onChange={e => set("smsBody", e.target.value)} placeholder="سلام {name}، وضعیت سفارش {order}: {status}" /></label>
      <label>عنوان ایمیل<input maxLength={200} value={form.emailSubject} onChange={e => set("emailSubject", e.target.value)} placeholder="وضعیت سفارش {order} در کیا" /></label>
      <label>متن ایمیل<textarea rows={4} maxLength={3000} value={form.emailBody} onChange={e => set("emailBody", e.target.value)} placeholder="سلام {name}، سفارش {order} به وضعیت {status} تغییر کرد. مبلغ: {amount} تومان" /></label>
      <label>متن اعلان مرورگر<input maxLength={300} value={form.pushBody} onChange={e => set("pushBody", e.target.value)} placeholder="{product} دوباره موجود شد" /></label>
      <label className="editor-check"><input type="checkbox" checked={form.active} onChange={e => set("active", e.target.checked)} />این قانون فعال باشد</label>
      <div className="admin-form-footer"><p>متغیرها: <code dir="ltr">{variables}</code></p><button className="button button-lime" disabled={saving || busy || !form.channels.length}><Check size={17} />{busy ? "در حال ذخیره..." : "ذخیرهٔ قانون"}</button></div>
    </form>
  </Modal>;
}

function TestDialog({ rule, onClose, onSend }: { rule: AdminAlertRule; onClose: () => void; onSend: (channel: string, recipient: string) => Promise<void> }) {
  const [channel, setChannel] = useState("sms");
  const [recipient, setRecipient] = useState("");
  return <Modal title={`ارسال آزمایشی: ${rule.title}`} onClose={onClose}>
    <form className="form-stack" onSubmit={e => { e.preventDefault(); void onSend(channel, recipient); onClose(); }}>
      <label>کانال<select value={channel} onChange={e => setChannel(e.target.value)}>
        <option value="sms">پیامک</option><option value="email">ایمیل</option><option value="push">Push مرورگر</option><option value="telegram">تلگرام</option>
      </select></label>
      <label>{channel === "email" ? "ایمیل مقصد" : "شماره موبایل مقصد"}<input required dir="ltr" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={channel === "email" ? "name@example.com" : "09121234567"} /></label>
      <p className="admin-hint"><Info size={15} /> متن پیام با دادهٔ نمونه پر می‌شود؛ اگر سرویس پیامک/ایمیل متصل نباشد، پیام در لاگ سرور ثبت می‌شود.</p>
      <button className="button button-lime"><Send size={17} />ارسال پیام آزمایشی</button>
    </form>
  </Modal>;
}

function BroadcastCard({ saving, busy, onSend }: { saving: boolean; busy: boolean; onSend: (title: string, message: string, audience: string, link: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [link, setLink] = useState("/shop");
  return <section className="admin-card">
    <div className="admin-card-heading"><h2>پیام همگانی</h2><Send size={18} /></div>
    <form className="form-stack" onSubmit={e => { e.preventDefault(); void onSend(title, message, audience, link); setTitle(""); setMessage(""); }}>
      <div className="form-grid">
        <label>عنوان<input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="کالکشن جدید رسید" /></label>
        <label>مخاطبان<select value={audience} onChange={e => setAudience(e.target.value)}>
          <option value="all">همهٔ مشتریان (پیامک، ایمیل و درون‌برنامه)</option>
          <option value="customers">فقط اعلان درون‌برنامه مشتریان</option>
          <option value="push">فقط مرورگرهای مشترک‌شده (Push)</option>
        </select></label>
        <label>لینک<input dir="ltr" maxLength={200} value={link} onChange={e => setLink(e.target.value)} placeholder="/shop" /></label>
      </div>
      <label>متن پیام<textarea required rows={3} minLength={5} maxLength={900} value={message} onChange={e => setMessage(e.target.value)} placeholder="متن پیام را بنویسید..." /></label>
      <div className="admin-form-footer"><p>ارسال همگانی به صف خروجی اضافه می‌شود و با اولین اجرای کرون یا درخواست بعدی ارسال می‌شود.</p><button className="button button-lime" disabled={saving || busy}><Send size={17} />ارسال پیام همگانی</button></div>
    </form>
  </section>;
}
