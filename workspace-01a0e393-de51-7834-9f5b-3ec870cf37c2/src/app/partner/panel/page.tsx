import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/server-store";
import { currentPartner } from "@/lib/partner-auth";
import { getPartnerTiers, normalizeTier } from "@/lib/partner";
import { db } from "@/db";
import { partnerOrders, partnerTiers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { PartnerPanel } from "@/components/partner";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "پنل همکار عمده | کیا اکسسوری" };

export default async function PartnerPanelPage() {
  const partner = await currentPartner();
  if (!partner) redirect("/partner/login");
  const [store, tiers, orders, tierRow] = await Promise.all([
    getStore(),
    getPartnerTiers(),
    db.select().from(partnerOrders).where(eq(partnerOrders.partnerId, partner.id)).orderBy(desc(partnerOrders.createdAt)).limit(100),
    partner.tierId ? db.select().from(partnerTiers).where(eq(partnerTiers.id, partner.tierId)).limit(1) : Promise.resolve([]),
  ]);
  const tier = normalizeTier(tierRow[0] ?? tiers.find(t => t.key === "retail") ?? tiers[0] ?? null);
  return <PartnerPanel
    products={store.products}
    tier={tier}
    partner={{ id: partner.id, phone: partner.phone, businessName: partner.businessName, contactName: partner.contactName, city: partner.city, status: partner.status, tierName: tier?.name ?? "—" }}
    orders={orders.map(order => ({ ...order, createdAt: order.createdAt.toISOString() }))}
  />;
}
