import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import Bottle from "@/components/Bottle";
import { getProducts, soldCounts, toGroups } from "@/lib/catalog";
import { activeCampaigns, offerSummary } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { ksh } from "@/lib/format";
import { db } from "@/db";
import { deliveryZones } from "@/db/schema";
import { asc } from "drizzle-orm";

const GRAD: Record<string, string> = {
  amber: "from-gold/30 via-hot/20 to-transparent",
  rose: "from-hot/40 via-gold/10 to-transparent",
  green: "from-mint/30 via-gold/10 to-transparent",
};

export default async function HomePage() {
  const [prods, sold, camps, s, zones] = await Promise.all([
    getProducts(),
    soldCounts(),
    activeCampaigns(),
    getSettings(),
    db.select().from(deliveryZones).orderBy(asc(deliveryZones.sortOrder)),
  ]);
  const groups = toGroups(prods, sold);
  const best = [...groups].sort((a, b) => b.sold - a.sold || Number(b.featured) - Number(a.featured)).slice(0, 4);
  const hero = camps[0];
  const maxTime = Math.max(...zones.map((z) => z.targetMinutes));
  const minTime = Math.min(...zones.map((z) => z.targetMinutes));

  return (
    <div className="space-y-10">
      <section className={`relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br ${GRAD[hero?.bannerColor ?? "amber"] ?? GRAD.amber} p-6 sm:p-10`}>
        <div className="relative z-10 max-w-xl">
          <span className="inline-block rounded-full bg-gold px-3 py-1 text-xs font-black uppercase tracking-wide text-black">{hero ? hero.bannerText || hero.name : "Now delivering in Kiamunyi"}</span>
          <h1 className="h1 mt-4">{hero ? hero.headline : "Your drinks. Delivered from Kiamunyi."}</h1>
          <p className="mt-3 text-mute">Flavoured vodka, gin and whisky. Pay with M-Pesa, delivered in {minTime}–{maxTime} minutes from {ksh(s.minDelivery)}.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={hero ? `/c/${hero.slug}` : "/shop"} className="btn-gold !px-7 !py-3 text-base">
              {hero ? `Claim ${offerSummary(hero)}` : "Shop now"}
            </Link>
            <Link href="/shop" className="btn-ghost !py-3">
              Browse all drinks
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-4 bottom-0 hidden items-end gap-1 sm:flex">
          <Bottle spirit="Vodka" flavour="Strawberry" sizeMl={750} className="h-56" />
          <Bottle spirit="Whisky" flavour="Honey" sizeMl={750} className="h-64" />
          <Bottle spirit="Gin" flavour="Ginger" sizeMl={750} className="h-56" />
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-line bg-panel p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="font-black text-gold">🏍️ Delivered from Kiamunyi</p>
          <p className="text-mute">{zones.length} zones: {zones.map((z) => z.name).join(", ")}</p>
        </div>
        <div>
          <p className="font-black text-gold">⏱️ {minTime}–{maxTime} minutes</p>
          <p className="text-mute">Target times by zone, {s.deliveryOpen}–{s.deliveryClose}</p>
        </div>
        <div>
          <p className="font-black text-gold">🛒 {ksh(s.minDelivery)} minimum</p>
          <p className="text-mute">Below that? Pick up in store or add one more bottle.</p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="h2">Best sellers</h2>
          <Link href="/shop?sort=popular" className="text-sm font-bold text-gold">
            See all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {best.map((g) => (
            <ProductCard key={g.key} group={g} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="h2 mb-3">Shop by spirit</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Vodka", "Strawberry"],
            ["Whisky", "Honey"],
            ["Gin", "Ginger"],
          ].map(([sp, fl]) => (
            <Link key={sp} href={`/shop?spirit=${sp}`} className="card group flex flex-col items-center p-3 transition hover:border-gold">
              <Bottle spirit={sp} flavour={fl} sizeMl={750} className="h-28 transition group-hover:scale-105 sm:h-40" />
              <span className="mt-2 text-sm font-black sm:text-lg">{sp}</span>
              <span className="text-[11px] text-mute">from {ksh(Math.min(...prods.filter((p) => p.spirit === sp).map((p) => p.priceKsh)))}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Strawberry", "Ginger", "Pineapple", "Honey"].map((f) => (
            <Link key={f} href={`/shop?flavour=${f}`} className="chip !px-4 !py-2 !text-sm">
              {f}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card bg-gradient-to-br from-gold/15 to-transparent p-6">
          <h2 className="h2">★ Earn on every order</h2>
          <p className="mt-2 text-sm text-mute">1 point per KSh {s.pointsPerKsh} spent. Redeem {s.minRedeemPoints} points for KSh {s.minRedeemPoints * s.redeemKshPerPoint} off. Bottle rewards and a monthly <b className="text-white">Top Buyers</b> reward for our biggest fans.</p>
          <Link href="/rewards" className="btn-gold mt-4">
            How rewards work
          </Link>
        </div>
        <div className="card p-6">
          <h2 className="h2">🎵 Follow Jay&apos;s on TikTok</h2>
          <p className="mt-2 text-sm text-mute">Nights out, events and the Kiamunyi delivery crew. Spot a Jay&apos;s QR at an event? Scan it and your offer applies automatically.</p>
          <a href={s.shop.tiktok} target="_blank" rel="noreferrer" className="btn-ghost mt-4">
            Watch on TikTok
          </a>
        </div>
      </section>
    </div>
  );
}
