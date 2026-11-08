import type { Metadata } from "next";
import { db } from "@/db";
import { deliveryZones } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import CheckoutForm from "@/components/CheckoutForm";
import { getSettings } from "@/lib/settings";
import { ensureSeed } from "@/lib/seed";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  await ensureSeed();
  const [zones, s] = await Promise.all([db.select().from(deliveryZones).where(eq(deliveryZones.active, true)).orderBy(asc(deliveryZones.sortOrder)), getSettings()]);
  return (
    <CheckoutForm
      zones={zones.map((z) => ({ id: z.id, name: z.name, areas: z.areas, fee: z.feeKsh, minutes: z.targetMinutes }))}
      minDelivery={s.minDelivery}
      deliveryHours={`${s.deliveryOpen}–${s.deliveryClose}`}
      minRedeem={s.minRedeemPoints}
    />
  );
}
