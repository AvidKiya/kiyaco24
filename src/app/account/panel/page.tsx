import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentCustomer, getCustomerDashboard } from "@/lib/customer";
import { getStore } from "@/lib/server-store";
import { AccountPanel } from "@/components/account";

export const metadata: Metadata = { title: "پنل کاربری", description: "داشبورد مشتری، سفارش‌ها، امتیازها و کیف پول" };
export const dynamic = "force-dynamic";

/* فاز ۹ — پنل مشتری (داشبورد، سفارش‌ها، امتیازها، کیف پول، دعوت) */
export default async function AccountPanelPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account");
  const data = await getCustomerDashboard(customer.id);
  if (!data) redirect("/account");
  const { products } = await getStore();

  const orders = data.orders.map(order => ({
    id: String(order.id), code: order.code, items: order.items.map(item => ({
      productId: item.productId, name: item.name, image: item.image, price: item.price, quantity: item.quantity, size: item.size, color: item.color,
    })),
    total: order.total, status: order.status, paymentStatus: order.paymentStatus,
    createdAt: new Date(order.createdAt).toISOString(), trackingNumber: order.trackingNumber,
  }));

  return (
    <AccountPanel
      customer={data.customer}
      orders={orders}
      products={products}
      reviews={data.reviews.map(review => ({
        id: review.id, productId: review.productId, name: review.name, rating: review.rating, text: review.text,
        approved: review.approved, createdAt: new Date(review.createdAt).toISOString(),
      }))}
      pointsLogs={data.pointsLogs.map(log => ({
        id: log.id, points: log.points, reason: log.reason, orderCode: log.orderCode, createdAt: new Date(log.createdAt).toISOString(),
      }))}
      walletTxns={data.walletTxns.map(txn => ({
        id: txn.id, amount: txn.amount, kind: txn.kind, note: txn.note, orderCode: txn.orderCode, createdAt: new Date(txn.createdAt).toISOString(),
      }))}
      referrals={data.referrals.map(referral => ({
        id: referral.id, code: referral.code, status: referral.status, rewardPoints: referral.rewardPoints, createdAt: new Date(referral.createdAt).toISOString(),
      }))}
      invited={data.invited.map(person => ({ id: person.id, name: person.name, createdAt: new Date(person.createdAt).toISOString() }))}
      notifications={data.notifications.map(item => ({
        id: item.id, title: item.title, body: item.body, link: item.link, read: item.read, createdAt: new Date(item.createdAt).toISOString(),
      }))}
    />
  );
}
