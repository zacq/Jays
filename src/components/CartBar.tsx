"use client";

import Link from "next/link";
import { useCart } from "@/components/cart";
import { ksh } from "@/lib/format";
import { track } from "@/lib/analytics";

export default function CartBar() {
  const { subtotal, count, minDelivery, whatsapp, phone } = useCart();
  const gap = Math.max(0, minDelivery - subtotal);
  const pct = Math.min(100, (subtotal / minDelivery) * 100);
  const tel = phone.replace(/\s/g, "");
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
        <Link href="/cart" className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-black">
              {count > 0 ? `${count} item${count > 1 ? "s" : ""} · ${ksh(subtotal)}` : "Your cart is empty"}
            </span>
            <span className={`truncate text-[11px] font-semibold ${gap === 0 && count > 0 ? "text-mint" : "text-gold"}`}>
              {count === 0 ? `Delivery from ${ksh(minDelivery)}` : gap > 0 ? `${ksh(gap)} more to unlock delivery` : "🚀 Delivery unlocked"}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div className={`h-full rounded-full transition-all ${gap === 0 && count > 0 ? "bg-mint" : "bg-gold"}`} style={{ width: `${pct}%` }} />
          </div>
        </Link>
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hi Jay's, I'd like to order.")}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("whatsapp_click", { place: "bar" })}
          className="grid h-10 w-10 place-items-center rounded-full bg-[#25d366] text-lg"
          aria-label="WhatsApp"
        >
          💬
        </a>
        <a href={`tel:${tel}`} onClick={() => track("call_click")} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel2 text-lg" aria-label="Call">
          📞
        </a>
        <Link href={count > 0 ? "/checkout" : "/shop"} className="btn-gold !px-4">
          {count > 0 ? "Checkout" : "Shop"}
        </Link>
      </div>
    </div>
  );
}
