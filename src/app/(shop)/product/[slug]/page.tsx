import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import Bottle from "@/components/Bottle";
import AddButton from "@/components/AddButton";
import { getProducts } from "@/lib/catalog";
import { unitPrice } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { ksh, waLink } from "@/lib/format";
import TrackView from "@/components/TrackView";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [p] = await db.select().from(products).where(eq(products.slug, slug));
  if (!p) return {};
  return { title: p.seoTitle || p.name, description: `${p.name} for ${ksh(p.priceKsh)}. Pay with M-Pesa, delivered from Kiamunyi, Nakuru.` };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [p] = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.active, true)));
  if (!p) notFound();
  const [all, s] = await Promise.all([getProducts(), getSettings()]);
  const siblings = all.filter((x) => x.spirit === p.spirit && x.flavour === p.flavour).sort((a, b) => a.sizeMl - b.sizeMl);
  const price = unitPrice(p);
  const points = Math.floor(price / 100) * p.pointsMultiplier;
  const pairs = all
    .filter((x) => x.id !== p.id && x.stockQty > 0 && x.sizeMl <= 200 && (x.flavour !== p.flavour || x.spirit !== p.spirit))
    .sort((a, b) => Number(b.spirit === p.spirit) - Number(a.spirit === p.spirit))
    .slice(0, 3);
  const out = p.stockQty <= 0;
  const gap = Math.max(0, s.minDelivery - price);
  const item = { productId: p.id, slug: p.slug, name: p.name, spirit: p.spirit, flavour: p.flavour, sizeMl: p.sizeMl, price, stock: p.stockQty };

  const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description, brand: p.brand, offers: { "@type": "Offer", priceCurrency: "KES", price, availability: out ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" } };

  return (
    <div>
      <TrackView id={p.slug} />
      <p className="mb-3 text-sm text-mute">
        <Link href="/shop" className="hover:text-gold">Shop</Link> / <Link href={`/shop?spirit=${p.spirit}`} className="hover:text-gold">{p.spirit}</Link> / {p.name}
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card grid place-items-center bg-gradient-to-b from-panel2 to-panel py-8">
          <Bottle spirit={p.spirit} flavour={p.flavour} sizeMl={p.sizeMl} className="h-72 sm:h-96" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gold">{p.spirit} · {p.flavour}</p>
          <h1 className="h1 !text-3xl mt-1">{p.name}</h1>
          <p className="mt-2 text-sm text-mute">{p.brand} · {p.abv} ABV</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-black">{ksh(price)}</span>
            {price < p.priceKsh && <span className="text-mute line-through">{ksh(p.priceKsh)}</span>}
          </div>
          <p className="mt-1 text-sm font-semibold text-mint">Earn {points} points{p.pointsMultiplier > 1 ? ` (${p.pointsMultiplier}x bonus!)` : ""}</p>

          <div className="mt-5">
            <p className="label">Size</p>
            <div className="flex gap-2">
              {siblings.map((x) => (
                <Link key={x.id} href={`/product/${x.slug}`} className={`chip !px-4 !py-2 !text-sm ${x.id === p.id ? "chip-on" : ""} ${x.stockQty <= 0 ? "opacity-50 line-through" : ""}`}>
                  {x.sizeMl}ml · {ksh(unitPrice(x))}
                </Link>
              ))}
            </div>
          </div>

          <p className={`mt-4 text-sm font-bold ${out ? "text-hot" : p.stockQty <= p.lowStockAt ? "text-gold" : "text-mint"}`}>
            {out ? "Sold out" : p.stockQty <= p.lowStockAt ? `Only ${p.stockQty} left` : "In stock"}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <AddButton item={item} withQty className="btn-gold !px-8 !py-3" />
            <a href={waLink(s.shop.whatsapp, `Hi Jay's, I'd like to order 1 x ${p.name} (${ksh(price)}).`)} target="_blank" rel="noreferrer" className="btn-green !py-3">
              💬 Order on WhatsApp
            </a>
          </div>
          {gap > 0 && <p className="mt-3 text-sm text-gold">Add {ksh(gap)} more to unlock delivery (minimum {ksh(s.minDelivery)}).</p>}
          <p className="mt-5 text-sm leading-relaxed text-mute">{p.description}</p>
          <p className="mt-3 text-xs text-mute">18+ only. ID checked on delivery. Drink responsibly.</p>
        </div>
      </div>

      {pairs.length > 0 && (
        <section className="mt-10">
          <h2 className="h2 mb-3">Pairs well with</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {pairs.map((x) => (
              <div key={x.id} className="card flex items-center gap-3 p-3">
                <Bottle spirit={x.spirit} flavour={x.flavour} sizeMl={x.sizeMl} className="h-20 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${x.slug}`} className="block truncate text-sm font-bold hover:text-gold">{x.name}</Link>
                  <p className="text-sm font-black">{ksh(unitPrice(x))}</p>
                  <AddButton item={{ productId: x.id, slug: x.slug, name: x.name, spirit: x.spirit, flavour: x.flavour, sizeMl: x.sizeMl, price: unitPrice(x), stock: x.stockQty }} label="+ Add" className="btn-ghost !px-3 !py-1.5 !text-xs" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </div>
  );
}
