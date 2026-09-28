import { getStore, apiError } from "@/lib/server-store";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await getStore()); } catch (error) { return apiError(error); }
}
