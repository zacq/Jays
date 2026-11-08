import type { Metadata } from "next";
import ProductCard from "@/components/ProductCard";
import { getProducts, soldCounts, toGroups } from "@/lib/catalog";
import Link from "next/link";

export const metadata: Metadata = { title: "Shop flavoured vodka, gin & whisky – Nakuru delivery" };

type SP = Record<string, string | undefined>;

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [prods, sold] = await Promise.all([getProducts(), soldCounts()]);
  let groups = toGroups(prods, sold);
  const size = sp.size ? Number(sp.size) : undefined;
  const max = sp.max ? Number(sp.max) : undefined;
  const q = sp.q?.trim().toLowerCase();

  const cards = groups
    .filter((g) => (!sp.spirit || g.spirit === sp.spirit) && (!sp.flavour || g.flavour === sp.flavour))
    .filter((g) => !q || `${g.spirit} ${g.flavour}`.toLowerCase().includes(q) || q.split(/\s+/).every((w) => `${g.spirit} ${g.flavour}`.toLowerCase().includes(w)))
    .map((g) => {
      const ok = g.variants.filter((v) => (!size || v.sizeMl === size) && (!max || v.price <= max));
      return { g, ok };
    })
    .filter((x) => x.ok.length > 0);

  const minPrice = (x: (typeof cards)[number]) => Math.min(...x.ok.map((v) => v.price));
  if (sp.sort === "price_asc") cards.sort((a, b) => minPrice(a) - minPrice(b));
  else if (sp.sort === "price_desc") cards.sort((a, b) => minPrice(b) - minPrice(a));
  else cards.sort((a, b) => b.g.sold - a.g.sold || Number(b.g.featured) - Number(a.g.featured));
  groups = [];

  return (
    <div>
      <h1 className="h1 !text-3xl sm:!text-4xl">Shop</h1>
      <p className="mt-1 text-sm text-mute">{cards.length} drinks · every flavour in 100ml, 200ml and 750ml</p>

      <form className="card mt-4 grid grid-cols-2 gap-2 p-3 sm:grid-cols-6" action="/shop">
        <input type="hidden" name="q" value={sp.q ?? ""} />
        <select name="spirit" defaultValue={sp.spirit ?? ""} className="field" aria-label="Spirit">
          <option value="">All spirits</option>
          {["Vodka", "Gin", "Whisky"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select name="flavour" defaultValue={sp.flavour ?? ""} className="field" aria-label="Flavour">
          <option value="">All flavours</option>
          {["Strawberry", "Ginger", "Pineapple", "Honey"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select name="size" defaultValue={sp.size ?? ""} className="field" aria-label="Size">
          <option value="">Any size</option>
          {[100, 200, 750].map((x) => (
            <option key={x} value={x}>
              {x}ml
            </option>
          ))}
        </select>
        <select name="max" defaultValue={sp.max ?? ""} className="field" aria-label="Max price">
          <option value="">Any price</option>
          {[300, 500, 1000, 1500].map((x) => (
            <option key={x} value={x}>
              Under KSh {x}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sp.sort ?? "popular"} className="field" aria-label="Sort">
          <option value="popular">Most popular</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        <button className="btn-gold">Apply</button>
      </form>
      {sp.q && (
        <p className="mt-3 text-sm text-mute">
          Results for “{sp.q}” ·{" "}
          <Link href="/shop" className="font-bold text-gold">
            clear
          </Link>
        </p>
      )}

      {cards.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="font-bold">No drinks match those filters.</p>
          <Link href="/shop" className="btn-gold mt-4">
            Reset filters
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {cards.map(({ g, ok }) => (
            <ProductCard key={g.key} group={g} size={size ?? ok[0].sizeMl} />
          ))}
        </div>
      )}
    </div>
  );
}
