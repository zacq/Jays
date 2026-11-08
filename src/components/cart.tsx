"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";

export type CartItem = {
  productId: number;
  slug: string;
  name: string;
  spirit: string;
  flavour: string;
  sizeMl: number;
  price: number;
  qty: number;
  stock: number;
};

type Ctx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  minDelivery: number;
  whatsapp: string;
  phone: string;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
};

const CartCtx = createContext<Ctx | null>(null);

export function CartProvider({ children, minDelivery, whatsapp, phone }: { children: ReactNode; minDelivery: number; whatsapp: string; phone: string }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const unlocked = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("jays_cart");
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("jays_cart", JSON.stringify(items));
  }, [items, ready]);

  const subtotal = useMemo(() => items.reduce((a, i) => a + i.price * i.qty, 0), [items]);
  const count = useMemo(() => items.reduce((a, i) => a + i.qty, 0), [items]);

  useEffect(() => {
    if (!ready) return;
    const now = subtotal >= minDelivery;
    if (now && !unlocked.current) track("delivery_unlocked", { value: subtotal });
    unlocked.current = now;
  }, [subtotal, minDelivery, ready]);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((cur) => {
      const ex = cur.find((c) => c.productId === item.productId);
      if (ex) return cur.map((c) => (c.productId === item.productId ? { ...c, ...item, qty: Math.min(item.stock || 99, c.qty + qty) } : c));
      return [...cur, { ...item, qty: Math.min(item.stock || 99, qty) }];
    });
    track("add_to_cart", { currency: "KES", value: item.price * qty, items: [{ item_id: item.slug, item_name: item.name, quantity: qty }] });
  }, []);
  const setQty = useCallback((id: number, qty: number) => setItems((cur) => cur.map((c) => (c.productId === id ? { ...c, qty: Math.max(1, Math.min(c.stock || 99, qty)) } : c))), []);
  const remove = useCallback((id: number) => setItems((cur) => cur.filter((c) => c.productId !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({ items, count, subtotal, minDelivery, whatsapp, phone, add, setQty, remove, clear }), [items, count, subtotal, minDelivery, whatsapp, phone, add, setQty, remove, clear]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
