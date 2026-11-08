"use client";

import Link from "next/link";
import { useState } from "react";
import Bottle from "@/components/Bottle";
import { useCart } from "@/components/cart";
import { ksh } from "@/lib/format";
import type { Group } from "@/lib/catalog";

export default function ProductCard({ group, size }: { group: Group; size?: number }) {
  const first = group.variants.find((v) => (size ? v.sizeMl === size : v.sizeMl === 200)) ?? group.variants[0];
  const [sel, setSel] = useState(first.sizeMl);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const v = group.variants.find((x) => x.sizeMl === sel) ?? first;
  const out = v.stock <= 0;
  return (
    <div className="card flex flex-col overflow-hidden p-3">
      <Link href={`/product/${v.slug}`} className="relative block rounded-xl bg-gradient-to-b from-panel2 to-panel py-3">
        <Bottle spirit={group.spirit} flavour={group.flavour} sizeMl={v.sizeMl} className="mx-auto h-36 sm:h-44" />
        {group.featured && <span className="absolute left-2 top-2 rounded-full bg-hot px-2 py-0.5 text-[10px] font-black uppercase">Hot</span>}
        {out ? <span className="absolute right-2 top-2 rounded-full bg-line px-2 py-0.5 text-[10px] font-bold">Sold out</span> : v.stock <= 6 && <span className="absolute right-2 top-2 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">Only {v.stock} left</span>}
      </Link>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-gold">{group.spirit}</p>
      <Link href={`/product/${v.slug}`} className="text-base font-extrabold leading-tight hover:text-gold">
        {group.flavour} {group.spirit}
      </Link>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {group.variants.map((x) => (
          <button key={x.id} onClick={() => setSel(x.sizeMl)} className={`chip ${x.sizeMl === sel ? "chip-on" : ""} ${x.stock <= 0 ? "opacity-50 line-through" : ""}`} aria-pressed={x.sizeMl === sel}>
            {x.sizeMl}ml
          </button>
        ))}
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <div>
          <p className="text-lg font-black">{ksh(v.price)}</p>
          {v.price < v.basePrice && <p className="text-xs text-mute line-through">{ksh(v.basePrice)}</p>}
          <p className="text-[11px] text-mint">+{v.points} pts</p>
        </div>
        <button
          disabled={out}
          className="btn-gold !px-4"
          onClick={() => {
            add({ productId: v.id, slug: v.slug, name: v.name, spirit: group.spirit, flavour: group.flavour, sizeMl: v.sizeMl, price: v.price, stock: v.stock });
            setAdded(true);
            setTimeout(() => setAdded(false), 1200);
          }}
        >
          {added ? "Added ✓" : out ? "Sold out" : "+ Add"}
        </button>
      </div>
    </div>
  );
}
