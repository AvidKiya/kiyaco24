"use client";
import { useState } from "react";
import { Users, Search, Wallet, Trophy, Gift, ChevronLeft, Crown, Medal, TrendingUp, Filter, X, Save } from "lucide-react";
import { money } from "@/lib/catalog";
import { clubTiers, tierForSpending, tierMeta, type CustomerTier } from "@/lib/customer-types";
import { EmptyState, Modal } from "./ui";

/* ============================================================
 *  فاز ۹ — مدیریت اعضای باشگاه مشتریان در پنل مدیریت
 *  امتیاز، کیف پول، سطح و دعوت‌ها بدون دست‌زدن به کد
 * ============================================================ */

export type AdminClubMember = {
  id: number; phone: string; name: string; birthDate: string; city: string; email: string;
  walletBalance: number; points: number; lifetimePoints: number; totalSpent: number;
  orderCount: number; reviewCount: number; referralCode: string; referredBy: number | null;
  createdAt: string; lastLoginAt: string | null;
};

export type AdminReferral = { id: number; referrerId: number; referredId: number | null; code: string; status: string; rewardPoints: number; createdAt: string };
export type AdminWalletTxn = { id: number; customerId: number; amount: number; kind: string; note: string; orderCode: string; createdAt: string };
export type AdminPointLog = { id: number; customerId: number; points: number; reason: string; orderCode: string; createdAt: string };

export function ClubMembersEditor({
  members, referrals, walletTxns, pointsLogs, mutate,
}: {
  members: AdminClubMember[]; referrals: AdminReferral[]; walletTxns: AdminWalletTxn[]; pointsLogs: AdminPointLog[];
  mutate: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<CustomerTier | "all">("all");
  const [walletFor, setWalletFor] = useState<AdminClubMember | null>(null);
  const [pointsFor, setPointsFor] = useState<AdminClubMember | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = members.filter(member => {
    const matchesQuery = `${member.name} ${member.phone} ${member.referralCode} ${member.city}`.includes(query);
    const matchesTier = tier === "all" || tierForSpending(member.totalSpent) === tier;
    return matchesQuery && matchesTier;
  });

  const walletOf = (id: number) => walletTxns.filter(txn => txn.customerId === id);
  const pointsOf = (id: number) => pointsLogs.filter(log => log.customerId === id);

  async function run(action: string, payload: Record<string, unknown>, close: () => void) {
    setBusy(true);
    try { if (await mutate(action, payload)) close(); } finally { setBusy(false); }
  }

  return (
    <>
      <section className="admin-card">
        <div className="admin-card-heading">
          <div><h2>باشگاه مشتریان کیا</h2><p className="muted">سطح هر عضو بر اساس مجموع خرید محاسبه می‌شود؛ امتیاز و اعتبار کیف پول را از همین‌جا مدیریت کن.</p></div>
          <span className="inline-badge">{members.length.toLocaleString("fa-IR")} عضو</span>
        </div>

        <div className="admin-tier-summary">
          {clubTiers.map(item => {
            const count = members.filter(member => tierForSpending(member.totalSpent) === item.id).length;
            return (
              <button key={item.id} className={`admin-tier-card ${tier === item.id ? "active" : ""}`} style={{ "--tier-color": item.color } as React.CSSProperties} onClick={() => setTier(tier === item.id ? "all" : item.id)}>
                <span className="admin-tier-icon">{item.id === "vip" ? <Crown size={18} /> : <Medal size={18} />}</span>
                <strong>{item.name}</strong>
                <span className="admin-tier-count">{count.toLocaleString("fa-IR")} عضو</span>
                <small>{item.minSpent ? `از ${money(item.minSpent)} تومان` : "همهٔ اعضا"}</small>
              </button>
            );
          })}
          <button className={`admin-tier-card all ${tier === "all" ? "active" : ""}`} onClick={() => setTier("all")}>
            <span className="admin-tier-icon"><Filter size={18} /></span>
            <strong>همه</strong>
            <span className="admin-tier-count">{members.length.toLocaleString("fa-IR")} عضو</span>
            <small>بدون فیلتر سطح</small>
          </button>
        </div>

        <div className="admin-table-toolbar">
          <div className="admin-search"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="نام، موبایل، کد معرف یا شهر..." aria-label="جستجوی عضو باشگاه" /></div>
          <span>{filtered.length.toLocaleString("fa-IR")} عضو نمایش داده می‌شود</span>
        </div>

        {filtered.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>عضو</th><th>موبایل</th><th>سطح</th><th>امتیاز</th><th>اعتبار کیف پول</th><th>مجموع خرید</th><th>سفارش/نظر/دعوت</th><th>کد معرف</th><th>عملیات</th></tr></thead>
              <tbody>
                {filtered.map(member => {
                  const meta = tierMeta(tierForSpending(member.totalSpent));
                  const invited = referrals.filter(referral => referral.referrerId === member.id && referral.referredId).length;
                  return (
                    <tr key={member.id}>
                      <td><strong>{member.name || "بدون نام"}</strong><br /><small className="muted">{member.city || "—"}</small></td>
                      <td><a dir="ltr" href={`tel:${member.phone}`}>{member.phone}</a></td>
                      <td><span className="inline-badge" style={{ background: meta.color, color: "#14150f" }}>{meta.name}</span></td>
                      <td><b>{member.points.toLocaleString("fa-IR")}</b><br /><small className="muted">کل: {member.lifetimePoints.toLocaleString("fa-IR")}</small></td>
                      <td style={{ color: member.walletBalance > 0 ? "var(--accent-text)" : undefined }}>{money(member.walletBalance)} تومان</td>
                      <td>{money(member.totalSpent)} تومان</td>
                      <td><small>{member.orderCount.toLocaleString("fa-IR")} / {member.reviewCount.toLocaleString("fa-IR")} / {invited.toLocaleString("fa-IR")}</small></td>
                      <td><code dir="ltr">{member.referralCode}</code></td>
                      <td>
                        <div className="table-actions">
                          <button className="icon-button" aria-label={`کیف پول ${member.name}`} onClick={() => setWalletFor(member)}><Wallet size={15} /></button>
                          <button className="icon-button" aria-label={`امتیاز ${member.name}`} onClick={() => setPointsFor(member)}><Trophy size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Users size={34} />} title="هنوز عضوی در باشگاه نیست" text="با اولین ورود مشتریان با کد پیامکی، حساب و باشگاه مشتریان به‌صورت خودکار ساخته می‌شود." />
        )}
      </section>

      <section className="admin-card">
        <div className="admin-card-heading"><div><h2>آخرین دعوت‌ها</h2><p className="muted">وضعیت هر دعوت: کلیک روی لینک، ثبت‌نام، خرید و پاداش.</p></div><TrendingUp size={18} /></div>
        {referrals.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>تاریخ</th><th>کد</th><th>معرف</th><th>وضعیت</th><th>امتیاز پاداش</th></tr></thead>
              <tbody>
                {referrals.slice(0, 40).map(referral => {
                  const referrer = members.find(member => member.id === referral.referrerId);
                  return (
                    <tr key={referral.id}>
                      <td><small>{new Date(referral.createdAt).toLocaleDateString("fa-IR")}</small></td>
                      <td><code dir="ltr">{referral.code}</code></td>
                      <td>{referrer ? referrer.name || referrer.phone : `#${referral.referrerId}`}</td>
                      <td><span className="inline-badge">{referral.status === "clicked" ? "کلیک روی لینک" : referral.status === "registered" ? "ثبت‌نام دوست" : referral.status === "purchased" ? "خرید دوست" : "پاداش داده شد"}</span></td>
                      <td>{referral.rewardPoints ? `+${referral.rewardPoints.toLocaleString("fa-IR")}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<Gift size={30} />} title="دعوتی ثبت نشده" text="با اشتراک‌گذاری لینک اختصاصی توسط مشتریان، دعوت‌ها اینجا دیده می‌شود." />}
      </section>

      {walletFor && (
        <Modal title={`کیف پول ${walletFor.name || walletFor.phone}`} onClose={() => setWalletFor(null)}>
          <WalletModal member={walletFor} transactions={walletOf(walletFor.id)} busy={busy} onClose={() => setWalletFor(null)}
            onSubmit={(amount, note) => run("customer.wallet", { customerId: walletFor.id, amount, note }, () => setWalletFor(null))} />
        </Modal>
      )}

      {pointsFor && (
        <Modal title={`امتیاز ${pointsFor.name || pointsFor.phone}`} onClose={() => setPointsFor(null)}>
          <PointsModal member={pointsFor} logs={pointsOf(pointsFor.id)} busy={busy} onClose={() => setPointsFor(null)}
            onSubmit={(points, reason) => run("customer.points", { customerId: pointsFor.id, points, reason }, () => setPointsFor(null))} />
        </Modal>
      )}
    </>
  );
}

/* ============================================================
 *  کیف پول عضو
 * ============================================================ */
function WalletModal({ member, transactions, busy, onClose, onSubmit }: { member: AdminClubMember; transactions: AdminWalletTxn[]; busy: boolean; onClose: () => void; onSubmit: (amount: number, note: string) => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const value = Number(amount.replace(/[^\d-]/g, "")) || 0;
  return (
    <div className="admin-modal-form">
      <p className="muted" dir="ltr">{member.phone} · موجودی فعلی: {member.walletBalance.toLocaleString("fa-IR")} تومان</p>
        <form onSubmit={e => { e.preventDefault(); onSubmit(value, note); }} className="form-grid">
          <label className="full-width">مبلغ تغییر (تومان) — برای شارژ مثبت و برای کسر منفی وارد کنید<input required inputMode="numeric" dir="ltr" value={amount} onChange={e => setAmount(e.target.value)} placeholder="مثلاً ۵۰۰۰۰ یا −۵۰۰۰۰" /></label>
          <label className="full-width">توضیح برای مشتری<input maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder="مثلاً پاداش نظر شما" /></label>
          <div className="admin-form-footer full-width">
            <button type="button" className="button button-outline" onClick={onClose}>انصراف</button>
            <button className="button button-lime" disabled={busy || !value}><Save size={16} />ثبت تغییر</button>
          </div>
        </form>
        {transactions.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>تاریخ</th><th>نوع</th><th>توضیح</th><th>مبلغ</th></tr></thead>
              <tbody>
                {transactions.slice(0, 12).map(txn => (
                  <tr key={txn.id}>
                    <td><small>{new Date(txn.createdAt).toLocaleDateString("fa-IR")}</small></td>
                    <td>{txn.kind === "debit" ? "برداشت" : "واریز"}</td>
                    <td className="muted"><small>{txn.note}{txn.orderCode ? ` · ${txn.orderCode}` : ""}</small></td>
                    <td style={{ color: txn.kind === "debit" ? "var(--danger)" : "var(--accent-text)" }}>{txn.amount > 0 ? "+" : ""}{money(txn.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">تراکنشی برای این عضو ثبت نشده است.</p>}
    </div>
  );
}

/* ============================================================
 *  امتیاز عضو
 * ============================================================ */
function PointsModal({ member, logs, busy, onClose, onSubmit }: { member: AdminClubMember; logs: AdminPointLog[]; busy: boolean; onClose: () => void; onSubmit: (points: number, reason: string) => void }) {
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const value = Number(points.replace(/[^\d-]/g, "")) || 0;
  return (
    <div className="admin-modal-form">
      <p className="muted">امتیاز فعلی: {member.points.toLocaleString("fa-IR")} · مجموع کسب‌شده: {member.lifetimePoints.toLocaleString("fa-IR")}</p>
        <form onSubmit={e => { e.preventDefault(); onSubmit(value, reason); }} className="form-grid">
          <label className="full-width">مقدار امتیاز (برای کسر، منفی وارد کنید)<input required inputMode="numeric" dir="ltr" value={points} onChange={e => setPoints(e.target.value)} placeholder="مثلاً ۱۰۰ یا −۵۰" /></label>
          <label className="full-width">دلیل<input maxLength={200} value={reason} onChange={e => setReason(e.target.value)} placeholder="مثلاً پاداش جشنواره" /></label>
          <div className="admin-form-footer full-width">
            <button type="button" className="button button-outline" onClick={onClose}>انصراف</button>
            <button className="button button-lime" disabled={busy || !value}><Save size={16} />ثبت امتیاز</button>
          </div>
        </form>
        <p className="muted"><ChevronLeft size={14} /> هر ۱۰۰ امتیاز معادل ۱٬۰۰۰ تومان اعتبار کیف پول است.</p>
        {logs.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>تاریخ</th><th>دلیل</th><th>امتیاز</th></tr></thead>
              <tbody>
                {logs.slice(0, 12).map(log => (
                  <tr key={log.id}>
                    <td><small>{new Date(log.createdAt).toLocaleDateString("fa-IR")}</small></td>
                    <td className="muted"><small>{log.reason}{log.orderCode ? ` · ${log.orderCode}` : ""}</small></td>
                    <td style={{ color: log.points > 0 ? "var(--accent-text)" : "var(--danger)" }}>{log.points > 0 ? "+" : ""}{log.points.toLocaleString("fa-IR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">سابقه‌ای برای این عضو ثبت نشده است.</p>}
    </div>
  );
}
