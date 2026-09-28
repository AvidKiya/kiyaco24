/* گرفتن بکاپ کامل داده از دیتابیس توسعه → kiya-db-backup.sql
 * اجرا: node scripts/dump-db.mjs   (از داخل پوشهٔ modern-accessory)
 * بازگردانی: node scripts/restore-db-backup.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/app_db";
const client = new pg.Client({ connectionString: url });
await client.connect();

const literal = value => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Array.isArray(value)) return `'{${value.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(",")}}'`;
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
};

const tables = (await client.query("select table_name from information_schema.tables where table_schema='public' and table_name like 'kiya_%' order by table_name")).rows;
let out = `-- بکاپ دادهٔ کیا — ${new Date().toISOString()}\n-- بازگردانی: node scripts/restore-db-backup.mjs\n`;
let total = 0;
for (const { table_name } of tables) {
  const rows = (await client.query(`select * from "${table_name}"`)).rows;
  out += `\n-- ${table_name}: ${rows.length} ردیف\n`;
  for (const row of rows) {
    const columns = Object.keys(row);
    out += `insert into "${table_name}" (${columns.map(column => `"${column}"`).join(", ")}) values (${columns.map(column => literal(row[column])).join(", ")}) on conflict do nothing;\n`;
    total++;
  }
}
writeFileSync(join(root, "kiya-db-backup.sql"), out);
console.log(`tables: ${tables.length} | rows: ${total} | dump size: ${Math.round(out.length / 1024)} KB`);
await client.end();
