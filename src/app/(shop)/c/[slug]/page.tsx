import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { eq } from "drizzle-orm";
import ProductCard from "@/components/ProductCard";
import SourceCapture from "@/components/SourceCapture";
import { getProducts, soldCounts, toGroups } from "@/lib/catalog";
import { activeCampaigns, offerSummary } from "@/lib/pricing";
import { fmtDate, ksh } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [c] = await db.select().from(campaigns).where(eq(campaigns.slug, slug));
  return c ? { title: c.name, description: c.headline } : {};
}

export default async function CampaignPage({ params }: Props) {
  const { slug } = await params;
  const [c] = await db.select().from(campaigns).where(eq(campaigns.slug, slug));
  const now = new Date();
  const live = c && c.active && c.startsAt <= now && c.endsAt > now;
  if (!live) {
    // Expired / unknown campaigns never show an error: send visitors to the current offer.
    const cur = (await activeCampaigns(now))[0];
    redirect(cur ? `/c/${cur.slug}` : "/offers");
  }
  const [prods, sold] = await Promise.all([getProducts(), soldCounts()]);
  const ids = (c.featuredProductIds || "").split(",").map(Number).filter(Boolean);
  let list = prods;
  if (ids.length) list = prods.filter((p) => ids.includes(p.id));
  else if (c.appliesTo === "spirit" && c.appliesValue) list = prods.filter((p) => p.spirit.toLowerCase() === c.appliesValue!.toLowerCase());
  else if (c.appliesTo === "flavour" && c.appliesValue) list = prods.filter((p) => p.flavour.toLowerCase() === c.appliesValue!.toLowerCase());
  else if (c.appliesTo === "size" && c.appliesValue) list = prods.filter((p) => String(p.sizeMl) === c.appliesValue!.replace(/\D/g, ""));
  const groups = toGroups(list, sold).sort((a, b) => b.sold - a.sold || Number(b.featured) - Number(a.featured)).slice(0, 8);

  return (
    <div className="space-y-8">
      <Suspense>
        <SourceCapture campaign={c.slug} />
      </Suspense>
      <section className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/25 via-hot/10 to-transparent p-6 sm:p-10">
        <span className="rounded-full bg-gold px-3 py-1 text-xs font-black uppercase text-black">{c.bannerText || c.name}</span>
        <h1 className="h1 mt-4 max-w-2xl">{c.headline}</h1>
        <p className="mt-3 text-sm text-mute">
          {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)} · {offerSummary(c)}
          {c.minSpend > 0 ? ` on orders from ${ksh(c.minSpend)}` : ""}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-mint/40 bg-mint/10 px-3 py-2 text-sm font-bold text-mint">✓ Offer applied automatically at checkout{c.promoCode ? ` · Code ${c.promoCode}` : ""}</div>
        <div className="mt-5 flex gap-3">
          <Link href="/shop" className="btn-gold !px-7 !py-3">Shop the offer</Link>
          <Link href="/cart" className="btn-ghost !py-3">View cart</Link>
        </div>
      </section>
      <section>
        <h2 className="h2 mb-3">Featured for this offer</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {groups.map((g) => (
            <ProductCard key={g.key} group={g} />
          ))}
        </div>
      </section>
      {c.terms && (
        <section className="card p-5 text-sm text-mute">
          <h2 className="mb-1 font-bold text-white">Offer terms</h2>
          {c.terms}
        </section>
      )}
    </div>
  );
}
