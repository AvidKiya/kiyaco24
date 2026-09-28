import { db } from "@/db";
import { media } from "@/db/schema";
import { eq } from "drizzle-orm";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f\d-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  try {
    const [image] = await db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!image) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(Buffer.from(image.data, "base64")), { headers: { "Content-Type": image.contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Image unavailable", { status: 503 }); }
}
