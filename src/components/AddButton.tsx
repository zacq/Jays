"use client";

import { useState } from "react";
import { useCart, type CartItem } from "@/components/cart";
import { track } from "@/lib/analytics";

export default function AddButton({ item, label = "Add to cart", className = "btn-gold", withQty = false }: { item: Omit<CartItem, "qty">; label?: string; className?: string; withQty?: boolean }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const out = item.stock <= 0;
  return (
    <div className="flex items-center gap-2">
      {withQty && !out && (
        <div className="flex items-center rounded-full border border-line bg-panel2">
          <button className="h-10 w-10 text-lg" aria-label="Less" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </button>
          <span className="w-6 text-center text-sm font-bold">{qty}</span>
          <button className="h-10 w-10 text-lg" aria-label="More" onClick={() => setQty((q) => Math.min(item.stock, q + 1))}>
            +
          </button>
        </div>
      )}
      <button
        disabled={out}
        className={className}
        onClick={() => {
          add(item, qty);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }}
      >
        {out ? "Sold out" : done ? "Added ✓" : label}
      </button>
    </div>
  );
}
