import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { deliveryZones } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { ksh } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";

export const metadata: Metadata = { title: "Delivery info – Kiamunyi, Nakuru", description: "Delivery zones, fees and hours for drinks delivery from Kiamunyi, Nakuru." };

export default async function DeliveryPage() {
  await ensureSeed();
  const [zones, s] = await Promise.all([db.select().from(deliveryZones).where(eq(deliveryZones.active, true)).orderBy(asc(deliveryZones.sortOrder)), getSettings()]);
  return (
    <div className="space-y-6">
      <h1 className="h1 !text-3xl sm:!text-4xl">Delivery info</h1>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-mute">
            <tr><th className="p-3">Zone</th><th className="p-3">Areas</th><th className="p-3">Fee</th><th className="p-3">Target time</th></tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} className="border-b border-line/50 last:border-0">
                <td className="p-3 font-black text-gold">{z.name}</td>
                <td className="p-3">{z.areas}</td>
                <td className="p-3 font-bold">{ksh(z.feeKsh)}</td>
                <td className="p-3">{z.targetMinutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-black">🛒 {ksh(s.minDelivery)} minimum for delivery</h2>
          <p className="mt-1 text-sm text-mute">Delivery unlocks once your cart reaches {ksh(s.minDelivery)}. Any one 750ml bottle, or two 200ml bottles, gets you there. Your cart tells you exactly how much more to add.</p>
        </div>
        <div className="card p-5">
          <h2 className="font-black">⏰ Delivery hours</h2>
          <p className="mt-1 text-sm text-mute">{s.deliveryOpen} – {s.deliveryClose} daily. Orders placed outside these hours are scheduled for the next slot, or you can pick up in store.</p>
        </div>
        <div className="card p-5">
          <h2 className="font-black">🪪 ID check on delivery</h2>
          <p className="mt-1 text-sm text-mute">You must be 18+. Our rider checks your ID before handing over. No valid ID means no delivery, and the order is cancelled and refunded per our policy.</p>
        </div>
        <div className="card p-5">
          <h2 className="font-black">🏪 Pickup at the shop</h2>
          <p className="mt-1 text-sm text-mute">Any order value works for pickup. {s.shop.address}. {s.shopHoursText}.</p>
        </div>
      </div>
      <p className="text-sm text-mute">Pay with M-Pesa (STK prompt or Till). Pay on Delivery is available in Zones 1–2 for orders up to {ksh(s.podMaxKsh)}. Zone fees and areas are dummy values until confirmed with our rider routes.</p>
      <Link href="/shop" className="btn-gold">Start shopping</Link>
    </div>
  );
}
