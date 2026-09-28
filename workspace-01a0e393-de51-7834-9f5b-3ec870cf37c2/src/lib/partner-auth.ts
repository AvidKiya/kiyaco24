import "server-only";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { partnerSessions, partners } from "@/db/schema";
import { and, eq, gt, lt } from "drizzle-orm";

const cookieName = "kiya_partner_session";
const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

export type PartnerAccount = typeof partners.$inferSelect;

/** نشست جاری همکار (یا null) — نشست مدیر در این ماژول دیده نمی‌شود. */
export async function currentPartner(): Promise<PartnerAccount | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const sessions = await db.select().from(partnerSessions)
    .where(and(eq(partnerSessions.tokenHash, hashToken(token)), gt(partnerSessions.expiresAt, new Date()))).limit(1);
  if (!sessions.length) return null;
  const rows = await db.select().from(partners).where(eq(partners.id, sessions[0].partnerId)).limit(1);
  return rows[0] ?? null;
}

export async function createPartnerSession(partnerId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 86400000);
  await db.delete(partnerSessions).where(lt(partnerSessions.expiresAt, new Date()));
  await db.insert(partnerSessions).values({ tokenHash: hashToken(token), partnerId, expiresAt });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyPartnerSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.delete(partnerSessions).where(eq(partnerSessions.tokenHash, hashToken(token)));
  jar.delete(cookieName);
}

/** ورود همکار با موبایل و رمز؛ فقط حساب تأییدشده اجازهٔ ورود دارد. */
export async function loginPartner(phone: string, password: string): Promise<{ ok: boolean; reason?: string; partner?: PartnerAccount }> {
  const rows = await db.select().from(partners).where(eq(partners.phone, phone)).limit(1);
  const partner = rows[0];
  if (!partner || !partner.passwordHash || !verifyPartnerPassword(password, partner.passwordHash)) {
    return { ok: false, reason: "شماره موبایل یا رمز عبور درست نیست." };
  }
  if (partner.status === "pending") return { ok: false, reason: "درخواست همکاری شما هنوز بررسی نشده است." };
  if (partner.status === "rejected") return { ok: false, reason: "درخواست همکاری شما تأیید نشده است." };
  if (partner.status === "suspended") return { ok: false, reason: "حساب همکاری شما موقتاً غیرفعال است. با پشتیبانی تماس بگیرید." };
  await db.update(partners).set({ lastLoginAt: new Date() }).where(eq(partners.id, partner.id));
  await createPartnerSession(partner.id);
  return { ok: true, partner };
}

export function partnerPasswordHash(password: string) {
  const salt = randomBytes(24).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPartnerPassword(password: string, stored: string) {
  try {
    const [salt, hash] = stored.split(":");
    return timingSafeEqual(Buffer.from(hash, "hex"), scryptSync(password, salt, 64));
  } catch { return false; }
}
