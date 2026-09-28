import "server-only";
import { db } from "@/db";
import { customers, customerSessions, otpCodes, pointsLogs, walletTxns, referrals, notifications, orders, reviews } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { type Customer, type CustomerTier, pointsForOrder, pointsRules, tierForSpending } from "./customer-types";
import { notifyWelcome, notifyFirstPurchase, recoverAbandonedCarts } from "./notify";

const SESSION_COOKIE = "kiya_customer_session";
const SESSION_DAYS = 30;

/* ============================================================
 *  ابزارهای امنیتی
 * ============================================================ */

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const hashPassword = (password: string) => scryptSync(password, "kiya-customer-salt", 64).toString("hex");
const verifyPassword = (password: string, hash: string) => {
  try { return timingSafeEqual(Buffer.from(hashPassword(password)), Buffer.from(hash, "hex")); } catch { return false; }
};
export const isValidIranPhone = (phone: string) => /^09\d{9}$/.test(phone);
export const isValidReferralCode = (code: string) => /^KIYA-[A-Z0-9]{4,8}$/.test(code.toUpperCase());

export function makeReferralCode() {
  return "KIYA-" + randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
}

/* ============================================================
 *  نشست مشتری
 * ============================================================ */

export async function createCustomerSession(customerId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(customerSessions).values({ tokenHash: hashToken(token), customerId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return token;
}

export async function destroyCustomerSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(customerSessions).where(eq(customerSessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** مشتری لاگین‌شده یا null */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [session] = await db.select().from(customerSessions).where(eq(customerSessions.tokenHash, hashToken(token))).limit(1);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
  const [customer] = await db.select().from(customers).where(eq(customers.id, session.customerId)).limit(1);
  return customer ? (customer as Customer) : null;
}

/* ============================================================
 *  ورود با کد یک‌بارمصرف (OTP)
 *  در محیط بدون پنل پیامک، کد در لاگ سرور و در پاسخ توسعه برمی‌گردد.
 * ============================================================ */

export async function requestOtp(phone: string) {
  if (!isValidIranPhone(phone)) return { ok: false as const, error: "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد." };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
  await db.update(otpCodes).set({ used: true }).where(and(eq(otpCodes.phone, phone), eq(otpCodes.used, false)));
  await db.insert(otpCodes).values({ phone, code, expiresAt });
  // در نسخهٔ نهایی اینجا پیامک ارسال می‌شود (پنل پیامکی ایرانی)
  if (process.env.NODE_ENV !== "production") console.log(`[OTP] ${phone} → ${code}`);
  return { ok: true as const, devCode: process.env.NODE_ENV === "production" ? undefined : code, expiresIn: 120 };
}

export async function verifyOtp(phone: string, code: string) {
  if (!isValidIranPhone(phone)) return { ok: false as const, error: "شماره موبایل معتبر نیست." };
  if (!/^\d{6}$/.test(code)) return { ok: false as const, error: "کد تأیید باید ۶ رقم باشد." };
  const [row] = await db.select().from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.used, false)))
    .orderBy(desc(otpCodes.id)).limit(1);
  if (!row) return { ok: false as const, error: "کد تأییدی برای این شماره ثبت نشده؛ دوباره درخواست دهید." };
  if (new Date(row.expiresAt).getTime() < Date.now()) return { ok: false as const, error: "کد تأیید منقضی شده؛ کد جدید بگیرید." };
  if (row.attempts >= 5) return { ok: false as const, error: "تعداد تلاش‌ها زیاد شد؛ کد جدید بگیرید." };
  if (row.code !== code) {
    await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
    return { ok: false as const, error: "کد تأیید نادرست است." };
  }
  await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, row.id));

  let [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  let isNew = false;
  if (!customer) {
    // ثبت‌نام جدید — با پاداش تکمیل پروفایل و بررسی دعوت‌نامه
    const jar = await cookies();
    const inviteCode = jar.get("kiya_invite")?.value ?? "";
    let referredBy: number | null = null;
    if (isValidReferralCode(inviteCode)) {
      const [referrer] = await db.select().from(customers).where(eq(customers.referralCode, inviteCode.toUpperCase())).limit(1);
      if (referrer) referredBy = referrer.id;
    }
    [customer] = await db.insert(customers).values({ phone, referralCode: makeReferralCode(), referredBy }).returning();
    isNew = true;
    await addPoints(customer.id, pointsRules.profile, "تکمیل ثبت‌نام و پروفایل");
    await notifyWelcome(customer.id);
    if (referredBy) {
      await db.insert(referrals).values({ referrerId: referredBy, referredId: customer.id, code: inviteCode.toUpperCase(), status: "registered" });
      await addPoints(referredBy, pointsRules.referralRegister, "دعوت دوست به کیا");
      await pushNotification(referredBy, "یک دوست با لینک شما عضو شد", "امتیاز دعوت به حساب شما اضافه شد.", "/account/panel?section=referral");
    }
  }
  await db.update(customers).set({ lastLoginAt: new Date() }).where(eq(customers.id, customer.id));
  await createCustomerSession(customer.id);
  return { ok: true as const, isNew, customerId: customer.id };
}

/* ============================================================
 *  ورود با رمز عبور (اختیاری)
 * ============================================================ */

export async function loginWithPassword(phone: string, password: string) {
  if (!isValidIranPhone(phone)) return { ok: false as const, error: "شماره موبایل معتبر نیست." };
  const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (!customer || !customer.passwordHash) return { ok: false as const, error: "برای این شماره رمز عبوری تنظیم نشده؛ با کد پیامکی وارد شوید." };
  if (!verifyPassword(password, customer.passwordHash)) return { ok: false as const, error: "رمز عبور نادرست است." };
  await db.update(customers).set({ lastLoginAt: new Date() }).where(eq(customers.id, customer.id));
  await createCustomerSession(customer.id);
  return { ok: true as const, customerId: customer.id };
}

export async function setCustomerPassword(customerId: number, password: string) {
  if (String(password).length < 6) return { ok: false as const, error: "رمز عبور باید حداقل ۶ نویسه باشد." };
  await db.update(customers).set({ passwordHash: hashPassword(String(password)) }).where(eq(customers.id, customerId));
  return { ok: true as const };
}

/* ============================================================
 *  امتیاز و کیف پول
 * ============================================================ */

export async function addPoints(customerId: number, points: number, reason: string, orderCode = "") {
  if (!points) return;
  await db.insert(pointsLogs).values({ customerId, points, reason, orderCode });
  await db.update(customers).set({
    points: sql`${customers.points} + ${points}`,
    lifetimePoints: sql`${customers.lifetimePoints} + ${points}`,
  }).where(eq(customers.id, customerId));
}

export async function convertPointsToWallet(customerId: number, points: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return { ok: false as const, error: "حساب پیدا نشد." };
  if (points < 100) return { ok: false as const, error: "حداقل ۱۰۰ امتیاز برای تبدیل لازم است." };
  if (customer.points < points) return { ok: false as const, error: "امتیاز کافی ندارید." };
  const amount = Math.floor(points / 100) * 1000;
  await db.insert(pointsLogs).values({ customerId, points: -points, reason: "تبدیل امتیاز به اعتبار کیف پول" });
  await db.update(customers).set({ points: sql`${customers.points} - ${points}`, walletBalance: sql`${customers.walletBalance} + ${amount}` }).where(eq(customers.id, customerId));
  await db.insert(walletTxns).values({ customerId, amount, kind: "credit", note: "تبدیل امتیاز به اعتبار" });
  return { ok: true as const, amount };
}

export async function spendWallet(customerId: number, amount: number, orderCode: string) {
  if (amount <= 0) return { ok: true as const, amount: 0 };
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer || customer.walletBalance < amount) return { ok: false as const, error: "اعتبار کیف پول کافی نیست." };
  await db.update(customers).set({ walletBalance: sql`${customers.walletBalance} - ${amount}` }).where(eq(customers.id, customerId));
  await db.insert(walletTxns).values({ customerId, amount: -amount, kind: "debit", note: "پرداخت سفارش با کیف پول", orderCode });
  return { ok: true as const, amount };
}

/* ============================================================
 *  ثبت سفارش مشتری — امتیاز، ارتقای سطح و پاداش
 * ============================================================ */

export async function recordCustomerOrder(customerId: number, total: number, orderCode: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return;

  const previousTier = tierForSpending(customer.totalSpent);
  await db.update(customers).set({
    totalSpent: sql`${customers.totalSpent} + ${total}`,
    orderCount: sql`${customers.orderCount} + 1`,
  }).where(eq(customers.id, customerId));

  const newTier = tierForSpending(customer.totalSpent + total);
  const earned = pointsForOrder(total, newTier);
  await addPoints(customerId, earned, `امتیاز خرید سفارش ${orderCode}`, orderCode);

  // ارتقای سطح + پاداش کد تخفیف
  if (newTier !== previousTier) {
    const meta = { bronze: "برنزی", silver: "نقره‌ای", gold: "طلایی", vip: "ویژه" }[newTier];
    await pushNotification(customerId, `ارتقا به سطح ${meta}!`, "پاداش ارتقا به کیف پول شما اضافه شد. با خریدهای بعدت امتیاز بیشتری بگیر.", "/account/panel?section=club");
    const bonus = { bronze: 0, silver: 50_000, gold: 150_000, vip: 400_000 }[newTier];
    if (bonus) {
      await db.update(customers).set({ walletBalance: sql`${customers.walletBalance} + ${bonus}` }).where(eq(customers.id, customerId));
      await db.insert(walletTxns).values({ customerId, amount: bonus, kind: "credit", note: `پاداش ارتقا به سطح ${meta}`, orderCode });
    }
  }

  // پاداش معرف اگر این اولین خرید دعوت‌شده است
  if (customer.referredBy) {
    const [pending] = await db.select().from(referrals)
      .where(and(eq(referrals.referrerId, customer.referredBy), eq(referrals.referredId, customerId)))
      .orderBy(desc(referrals.id)).limit(1);
    if (pending && pending.status !== "purchased" && pending.status !== "rewarded") {
      await db.update(referrals).set({ status: "purchased", rewardPoints: pointsRules.referralPurchase }).where(eq(referrals.id, pending.id));
      await addPoints(customer.referredBy, pointsRules.referralPurchase, "اولین خرید دوست دعوت‌شده");
      await pushNotification(customer.referredBy, "دعوت‌شدهٔ شما خرید کرد", "امتیاز پاداش به حساب شما اضافه شد.", "/account/panel?section=referral");
    }
  }

  await pushNotification(customerId, "سفارشت ثبت شد", `سفارش ${orderCode} با موفقیت ثبت شد؛ ${earned.toLocaleString("fa-IR")} امتیاز به حسابت اضافه شد.`, "/account/panel?section=orders");

  // فاز ۱۰ — اولین خرید + بازگرداندن سبد رهاشده
  await notifyFirstPurchase(customerId, orderCode, earned);
  await recoverAbandonedCarts(customer.phone);
}

/* ============================================================
 *  اعلان
 * ============================================================ */

export async function pushNotification(customerId: number, title: string, body: string, link = "") {
  await db.insert(notifications).values({ customerId, title, body, link });
}

/* ============================================================
 *  دادهٔ داشبورد مشتری
 * ============================================================ */

export async function getCustomerDashboard(customerId: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return null;

  const [customerOrders, myReviews, myPoints, myWallet, myReferrals, invited, myNotifications] = await Promise.all([
    db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt)).limit(100),
    db.select().from(reviews).where(eq(reviews.phone, customer.phone)).orderBy(desc(reviews.createdAt)).limit(50),
    db.select().from(pointsLogs).where(eq(pointsLogs.customerId, customerId)).orderBy(desc(pointsLogs.id)).limit(50),
    db.select().from(walletTxns).where(eq(walletTxns.customerId, customerId)).orderBy(desc(walletTxns.id)).limit(50),
    db.select().from(referrals).where(eq(referrals.referrerId, customerId)).orderBy(desc(referrals.id)).limit(100),
    db.select({ id: customers.id, name: customers.name, createdAt: customers.createdAt }).from(customers).where(eq(customers.referredBy, customerId)),
    db.select().from(notifications).where(eq(notifications.customerId, customerId)).orderBy(desc(notifications.id)).limit(50),
  ]);

  return { customer: customer as Customer, orders: customerOrders, reviews: myReviews, pointsLogs: myPoints, walletTxns: myWallet, referrals: myReferrals, invited, notifications: myNotifications };
}

/* ============================================================
 *  رصد کلیک لینک معرف
 * ============================================================ */

/** یافتن صاحب کد معرف — بدون ثبت کلیک */
export async function findReferrer(code: string) {
  if (!isValidReferralCode(code)) return null;
  const [referrer] = await db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.referralCode, code.toUpperCase())).limit(1);
  return referrer ?? null;
}

/** ثبت کلیک روی لینک معرف (کوکی در Route Handler ست می‌شود) */
export async function trackReferralClick(code: string) {
  if (!isValidReferralCode(code)) return false;
  const [referrer] = await db.select().from(customers).where(eq(customers.referralCode, code.toUpperCase())).limit(1);
  if (!referrer) return false;
  await db.insert(referrals).values({ referrerId: referrer.id, code: code.toUpperCase(), status: "clicked" });
  return true;
}
