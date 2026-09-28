/* یک‌بارمصرف — ساخت کلیدهای VAPID برای اعلان مرورگر (Web Push)
 * اجرا: node scripts/generate-vapid.mjs
 * خروجی در .env.local نوشته می‌شود (gitignore شده) و برای سرور واقعی
 * باید در متغیرهای محیطی هاست هم تنظیم شود.
 */
import webPush from "web-push";

const { generateVAPIDKeys } = webPush;
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const keys = generateVAPIDKeys();
const lines = [
  "",
  "# ---- فاز ۱۰: اعلان مرورگر (Web Push) ----",
  `VAPID_PUBLIC_KEY=${keys.publicKey}`,
  `VAPID_PRIVATE_KEY=${keys.privateKey}`,
  "VAPID_SUBJECT=mailto:support@kiya-accessories.ir",
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`,
];
if (existsSync(".env.local")) {
  const current = readFileSync(".env.local", "utf8");
  const cleaned = current.replace(/\n*# ---- فاز ۱۰: اعلان مرورگر \(Web Push\) ----[\s\S]*$/, "").trimEnd();
  writeFileSync(".env.local", cleaned + lines.join("\n") + "\n");
} else {
  writeFileSync(".env.local", lines.join("\n").trimStart() + "\n");
}
console.log("VAPID keys written to .env.local");
console.log("public:", keys.publicKey);
