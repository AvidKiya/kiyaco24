import { db } from "@/db";
import { media } from "@/db/schema";
import { isAdmin } from "@/lib/auth";
import { apiError, validOrigin } from "@/lib/server-store";
import { desc } from "drizzle-orm";
import sharp from "sharp";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!await isAdmin()) return Response.json({ error: "وارد پنل شوید." }, { status: 401 });
    const images = await db.select({ id: media.id, filename: media.filename, createdAt: media.createdAt }).from(media).orderBy(desc(media.createdAt)).limit(100);
    return Response.json({ images: images.map(i => ({ ...i, url: `/api/media/${i.id}` })) });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر" }, { status: 403 });
  try {
    if (!await isAdmin()) return Response.json({ error: "وارد پنل شوید." }, { status: 401 });
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(file.type)) return Response.json({ error: "تصویر PNG، JPG، WebP یا AVIF حداکثر ۵ مگابایت انتخاب کنید." }, { status: 400 });
    let output: Buffer;
    try {
      const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24000000 });
      const metadata = await input.metadata();
      if (!metadata.format || !["jpeg", "png", "webp", "heif", "avif"].includes(metadata.format)) return Response.json({ error: "محتوای فایل باید یک تصویر معتبر PNG، JPG، WebP یا AVIF باشد." }, { status: 400 });
      output = await input.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
    }
    catch { return Response.json({ error: "فایل تصویر معتبر نیست یا ابعاد آن بیش از حد بزرگ است." }, { status: 400 }); }
    const [image] = await db.insert(media).values({ filename: file.name.slice(0, 150), contentType: "image/webp", data: output.toString("base64") }).returning({ id: media.id });
    return Response.json({ url: `/api/media/${image.id}`, id: image.id });
  } catch (error) { return apiError(error); }
}
