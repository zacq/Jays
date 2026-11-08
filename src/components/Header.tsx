"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart";

export const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/offers", label: "Offers" },
  { href: "/rewards", label: "Rewards" },
  { href: "/delivery", label: "Delivery Info" },
  { href: "/track", label: "Track Order" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const { count } = useCart();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [points, setPoints] = useState<string | null>(null);

  useEffect(() => {
    setPoints(localStorage.getItem("jays_points"));
    const h = () => setPoints(localStorage.getItem("jays_points"));
    window.addEventListener("jays-points", h);
    return () => window.removeEventListener("jays-points", h);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-4">
        <button className="grid h-10 w-10 place-items-center rounded-full border border-line md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
          <span className="text-lg">{open ? "✕" : "☰"}</span>
        </button>
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-lg font-black text-black">J</span>
          <span className="hidden text-lg font-black tracking-tight sm:block">
            JAY&apos;S<span className="text-gold">.</span>
          </span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 text-sm font-semibold text-mute hover:bg-panel hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <form
          className="ml-auto flex-1 sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/shop?q=${encodeURIComponent(q)}`);
            setOpen(false);
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drinks…" className="field !rounded-full !py-2" aria-label="Search" />
        </form>
        <Link href="/rewards" className="hidden rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold sm:block">
          ★ {points ? `${points} pts` : "Rewards"}
        </Link>
        <Link href="/cart" className="relative grid h-10 w-10 place-items-center rounded-full bg-gold text-black" aria-label="Cart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="20" r="1.5" />
            <circle cx="18" cy="20" r="1.5" />
            <path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
          </svg>
          {count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-hot px-1 text-[11px] font-black text-white">{count}</span>}
        </Link>
      </div>
      {open && (
        <nav className="border-t border-line bg-ink px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-base font-bold hover:bg-panel">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
