import "server-only";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { adminSessions } from "@/db/schema";
import { and, eq, gt, lt } from "drizzle-orm";

const cookieName = "kiya_admin_session";
export function hashPassword(password: string) {
  const salt = randomBytes(24).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  try { const [salt, hash] = stored.split(":"); return timingSafeEqual(Buffer.from(hash, "hex"), scryptSync(password, salt, 64)); } catch { return false; }
}
const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export async function isAdmin() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  const session = await db.select().from(adminSessions).where(and(eq(adminSessions.tokenHash, hashToken(token)), gt(adminSessions.expiresAt, new Date()))).limit(1);
  return session.length > 0;
}
export async function createSession() {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  await db.insert(adminSessions).values({ tokenHash: hashToken(token), expiresAt });
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hashToken(token)));
  jar.delete(cookieName);
}
