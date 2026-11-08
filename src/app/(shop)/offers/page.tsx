import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { and, asc, eq, gt } from "drizzle-orm";
import { activeCampaigns, offerSummary } from "@/lib/pricing";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Offers & campaigns" };

export default async function OffersPage() {
  const [live, upcoming] = await Promise.all([
    activeCampaigns(),
    db.select().from(campaigns).where(and(eq(campaigns.active, true), gt(campaigns.startsAt, new Date()))).orderBy(asc(campaigns.startsAt)).limit(4),
  ]);
  return (
    <div>
      <h1 className="h1 !text-3xl sm:!text-4xl">Offers</h1>
      <p className="mt-1 text-sm text-mute">Scan a Jay&apos;s QR or use a promo code and the offer applies automatically.</p>
      {live.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="font-bold">No special offers running right now.</p>
          <p className="mt-1 text-sm text-mute">Earn points on every order while you wait for the next one.</p>
          <Link href="/shop" className="btn-gold mt-4">Shop now</Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {live.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="card block bg-gradient-to-br from-gold/15 to-transparent p-6 transition hover:border-gold">
              <span className="rounded-full bg-gold px-3 py-1 text-xs font-black text-black">{offerSummary(c) || c.type}</span>
              <h2 className="h2 mt-3">{c.name}</h2>
              <p className="mt-1 text-sm text-mute">{c.headline}</p>
              <p className="mt-3 text-xs text-mute">Until {fmtDate(c.endsAt)}{c.promoCode ? ` · Code ${c.promoCode}` : ""}</p>
            </Link>
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <>
          <h2 className="h2 mb-3 mt-10">Coming soon</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((c) => (
              <div key={c.id} className="card p-4">
                <p className="font-bold">{c.name}</p>
                <p className="text-sm text-mute">{c.headline}</p>
                <p className="mt-1 text-xs text-gold">Starts {fmtDate(c.startsAt)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
