import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzle?: NodePgDatabase;
};

/**
 * اتصال دیتابیس به‌صورت تنبل (lazy) ساخته می‌شود.
 * این‌طوری صرفِ import کردن این ماژول هنگام build (مرحلهٔ جمع‌آوری اطلاعات صفحات)
 * خطای «DATABASE_URL is required» نمی‌دهد؛ نبود متغیر فقط هنگام استفادهٔ واقعی
 * در زمان اجرا (runtime) گزارش می‌شود.
 */
function getPool(): Pool {
  if (globalForDb.__arenaNextJsPostgresqlPool) return globalForDb.__arenaNextJsPostgresqlPool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }
  return pool;
}

function getDb(): NodePgDatabase {
  if (globalForDb.__arenaNextJsDrizzle) return globalForDb.__arenaNextJsDrizzle;
  const instance = drizzle(getPool());
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsDrizzle = instance;
  }
  return instance;
}

// پراکسی‌ها تا زمان اولین دسترسی به یک ویژگی، اتصال ساخته نشود.
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(getPool(), prop, receiver);
  },
}) as Pool;

export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
}) as NodePgDatabase;
