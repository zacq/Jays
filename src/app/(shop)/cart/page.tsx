"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Bottle from "@/components/Bottle";
import { useCart } from "@/components/cart";
import { ksh } from "@/lib/format";
import type { Quote } from "@/lib/pricing";

export default function CartPage() {
  const { items, setQty, remove, add, minDelivery } = useCart();
  const [q, setQ] = useState<Quote | null>(null);

  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(async () => {
      const promo = localStorage.getItem("jays_promo") || undefined;
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((i) => ({ productId: i.productId, qty: i.qty })), fulfilment: "pickup", promoCode: promo }),
      });
      if (res.ok) setQ(await res.json());
    }, 150);
    return () => clearTimeout(t);
  }, [items]);

  if (!items.length)
    return (
      <div className="card mx-auto mt-6 max-w-md p-8 text-center">
        <p className="text-4xl">🛒</p>
        <h1 className="h2 mt-2">Your cart is empty</h1>
        <p className="mt-1 text-sm text-mute">Delivery unlocks from {ksh(minDelivery)}.</p>
        <Link href="/shop" className="btn-gold mt-4">Browse drinks</Link>
      </div>
    );

  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
  const gap = Math.max(0, minDelivery - subtotal);
  const pct = Math.min(100, (subtotal / minDelivery) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="h1 !text-3xl">Your cart</h1>
        <div className={`card mt-4 p-4 ${gap === 0 ? "border-mint/50" : "border-gold/40"}`}>
          <p className={`text-sm font-black ${gap === 0 ? "text-mint" : "text-gold"}`}>
            {gap === 0 ? "🚀 Delivery unlocked! Choose your zone at checkout." : `Add ${ksh(gap)} more to unlock delivery`}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div className={`h-full rounded-full ${gap === 0 ? "bg-mint" : "bg-gold"}`} style={{ width: `${pct}%` }} />
          </div>
          {gap > 0 && <p className="mt-2 text-xs text-mute">Below {ksh(minDelivery)} you can still order for pickup at our Kiamunyi shop.</p>}
          {gap > 0 && q && q.suggestions.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {q.suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => add({ productId: s.id, slug: s.slug, name: s.name, spirit: s.spirit, flavour: s.flavour, sizeMl: s.sizeMl, price: s.price, stock: 99 })}
                  className="rounded-xl border border-line bg-panel2 p-2 text-left text-xs hover:border-gold"
                >
                  <span className="block font-bold">+ {s.name}</span>
                  <span className="text-gold">{ksh(s.price)}{s.price >= gap ? " · unlocks delivery" : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="mt-4 space-y-3">
          {items.map((i) => (
            <li key={i.productId} className="card flex items-center gap-3 p-3">
              <Bottle spirit={i.spirit} flavour={i.flavour} sizeMl={i.sizeMl} className="h-20 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <Link href={`/product/${i.slug}`} className="block truncate font-bold hover:text-gold">{i.name}</Link>
                <p className="text-sm text-mute">{ksh(i.price)} each</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex items-center rounded-full border border-line bg-panel2">
                    <button className="h-8 w-8" aria-label="Less" onClick={() => (i.qty > 1 ? setQty(i.productId, i.qty - 1) : remove(i.productId))}>−</button>
                    <span className="w-6 text-center text-sm font-bold">{i.qty}</span>
                    <button className="h-8 w-8" aria-label="More" onClick={() => setQty(i.productId, i.qty + 1)}>+</button>
                  </div>
                  <button onClick={() => remove(i.productId)} className="text-xs text-mute hover:text-hot">Remove</button>
                </div>
              </div>
              <p className="font-black">{ksh(i.price * i.qty)}</p>
            </li>
          ))}
        </ul>
      </div>

      <aside className="card h-fit space-y-2 p-5 lg:sticky lg:top-20">
        <h2 className="font-black">Summary</h2>
        <Row l="Subtotal" v={ksh(subtotal)} />
        {q && q.discount > 0 && <Row l={`Offer: ${q.offerLabel}`} v={`− ${ksh(q.discount)}`} green />}
        {q?.notices.map((n) => (
          <p key={n} className="text-xs text-gold">{n}</p>
        ))}
        {q && <p className="text-sm font-semibold text-mint">★ You&apos;ll earn {q.pointsEarned} points</p>}
        <p className="text-xs text-mute">Delivery fee and promo codes are added at checkout.</p>
        <Link href="/checkout" className="btn-gold mt-3 w-full !py-3">Checkout</Link>
        <Link href="/shop" className="btn-ghost w-full">Keep shopping</Link>
      </aside>
    </div>
  );
}

function Row({ l, v, green }: { l: string; v: string; green?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${green ? "text-mint" : ""}`}>
      <span>{l}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}
