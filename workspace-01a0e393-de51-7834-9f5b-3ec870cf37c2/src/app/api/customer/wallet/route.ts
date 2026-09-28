import { validOrigin, allowRequest, clientIp, apiError } from "@/lib/server-store";
import { getCurrentCustomer, convertPointsToWallet } from "@/lib/customer";
export const dynamic = "force-dynamic";

/* فاز ۹ — تبدیل امتیاز به اعتبار کیف پول */
export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  if (!allowRequest(`customer-wallet:${clientIp(request)}`, 20)) return Response.json({ error: "تلاش‌های زیاد. کمی بعد دوباره امتحان کنید." }, { status: 429 });
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return Response.json({ error: "نشست شما منقضی شده است." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const points = Math.floor(Number(body.points || 0));
    const result = await convertPointsToWallet(customer.id, points);
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ ok: true, amount: result.amount, message: `${result.amount.toLocaleString("fa-IR")} تومان به کیف پول شما اضافه شد.` });
  } catch (error) {
    return apiError(error, "تبدیل امتیاز انجام نشد.");
  }
}
