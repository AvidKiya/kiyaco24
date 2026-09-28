/* ============================================================
 *  بازگردانی بکاپ دادهٔ دیتابیس توسعه
 *  اجرا:  node scripts/restore-db-backup.mjs [مسیر فایل sql]
 *  پیش‌نیاز: PostgreSQL بالا باشد و جداول ساخته شده باشند
 *             (drizzle-kit push --force)
 *  نکته: مقادیر متنی ممکن استnewline داشته باشند؛ به همین دلیل
 *  دستورها خط‌به‌خط شکانده نمی‌شوند و تا توازن نقل‌قول جمع می‌شوند.
 * ============================================================ */
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const file = process.argv[2] || "kiya-db-backup.sql";
const url = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/app_db";

/** آیا نقل‌قول‌های رشته در متن متوازن است؟ ('' یک نقل‌قول فرار است) */
function balanced(text) {
  return (text.replace(/''/g, "").match(/'/g) || []).length % 2 === 0;
}

const raw = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
const statements = [];
let buffer = "";
for (const line of raw.split("\n")) {
  if (!buffer && !line.trim().startsWith("insert into")) continue;
  buffer = buffer ? `${buffer}\n${line}` : line.trim();
  if (buffer.endsWith(";") && balanced(buffer)) { statements.push(buffer); buffer = ""; }
}
if (buffer.trim()) statements.push(buffer);

if (!statements.length) {
  console.error("هیچ دستور insert در فایل بکاپ پیدا نشد:", file);
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
let done = 0;
for (const statement of statements) {
  try { await client.query(statement); done++; }
  catch (error) { console.error("رد شد:", statement.slice(0, 50).replace(/\n/g, " "), "→", error.message); }
}
const tables = await client.query("select table_name from information_schema.tables where table_schema='public' and table_name like 'kiya_%' order by table_name");
console.log(`بازگردانی انجام شد: ${done}/${statements.length} ردیف در ${tables.rows.length} جدول.`);
for (const { table_name } of tables.rows) {
  const count = await client.query(`select count(*)::int as n from "${table_name}"`);
  if (count.rows[0].n) console.log(`  ${table_name}: ${count.rows[0].n}`);
}

  // همگام‌سازی sequence ها با بیشینهٔ id هر جدول (وگرنه insert بعدی با خطای کلید تکراری می‌شکند)
  const sequences = (await client.query(`
    select s.relname as seq, t.relname as tab, a.attname as col
    from pg_class s
    join pg_depend d on d.objid = s.oid and d.deptype = 'a'
    join pg_class t on t.oid = d.refobjid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
    where s.relkind = 'S'`)).rows;
  for (const { seq, tab, col } of sequences) {
    await client.query(`select setval('${seq}', greatest(coalesce((select max(${col}) from ${tab}), 0), 1))`);
  }
  console.log(`sequence ها همگام شدند (${sequences.length})`);
  await client.end();
