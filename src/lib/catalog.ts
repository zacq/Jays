import { db } from "@/db";
import { products } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { ensureSeed } from "@/lib/seed";
import { unitPrice } from "@/lib/pricing";

export type Variant = {
  id: number;
  slug: string;
  name: string;
  sizeMl: number;
  price: number;
  basePrice: number;
  stock: number;
  points: number;
};
export type Group = { key: string; spirit: string; flavour: string; variants: Variant[]; sold: number; featured: boolean };

export async function getProducts() {
  await ensureSeed();
  return db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.sortOrder));
}

export async function soldCounts() {
  const res = await db.execute(
    sql`select i.product_id as id, sum(i.qty)::int as n from order_items i join orders o on o.id = i.order_id where o.status not in ('cancelled','refunded') group by i.product_id`,
  );
  const m = new Map<number, number>();
  for (const r of res.rows as { id: number; n: number }[]) m.set(r.id, r.n);
  return m;
}

export function toGroups(prods: (typeof products.$inferSelect)[], sold: Map<number, number>): Group[] {
  const map = new Map<string, Group>();
  for (const p of prods) {
    const key = `${p.spirit}-${p.flavour}`;
    const price = unitPrice(p);
    const g = map.get(key) ?? { key, spirit: p.spirit, flavour: p.flavour, variants: [], sold: 0, featured: false };
    g.variants.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      sizeMl: p.sizeMl,
      price,
      basePrice: p.priceKsh,
      stock: p.stockQty,
      points: Math.floor(price / 100) * p.pointsMultiplier,
    });
    g.sold += sold.get(p.id) ?? 0;
    g.featured = g.featured || p.featured;
    map.set(key, g);
  }
  for (const g of map.values()) g.variants.sort((a, b) => a.sizeMl - b.sizeMl);
  return [...map.values()];
}
