"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart";
import { ksh } from "@/lib/format";
import { track } from "@/lib/analytics";
import type { Quote } from "@/lib/pricing";

type Zone = { id: number; name: string; areas: string; fee: number; minutes: number };

export default function CheckoutForm({ zones, minDelivery, deliveryHours, minRedeem }: { zones: Zone[]; minDelivery: number; deliveryHours: string; minRedeem: number }) {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [f, setF] = useState({
    name: "",
    phone: "",
    fulfilment: "pickup" as "delivery" | "pickup",
    zoneId: "",
    landmark: "",
    preferredTime: "ASAP",
    notes: "",
    promoCode: "",
    voucherCode: "",
    pointsToUse: 0,
    paymentMethod: "mpesa" as "mpesa" | "pod",
    ageConfirmed: false,
    marketingConsent: false,
    topBuyerConsent: false,
    website: "",
  });
  const [q, setQ] = useState<Quote | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const autoDelivery = useRef(false);
  const lastPromo = useRef("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    const p = localStorage.getItem("jays_promo");
    if (p) setF((s) => ({ ...s, promoCode: p }));
    track("begin_checkout", { currency: "KES" });
  }, []);

  // Default to delivery once unlocked (once), fall back to pickup if it locks again.
  useEffect(() => {
    if (subtotal >= minDelivery && !autoDelivery.current) {
      autoDelivery.current = true;
      setF((s) => ({ ...s, fulfilment: "delivery" }));
    }
    if (subtotal < minDelivery) setF((s) => (s.fulfilment === "delivery" ? { ...s, fulfilment: "pickup", paymentMethod: s.paymentMethod } : s));
  }, [subtotal, minDelivery]);

  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(async () => {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((i) => ({ productId: i.productId, qty: i.qty })), fulfilment: f.fulfilment, zoneId: f.zoneId || null, promoCode: f.promoCode, voucherCode: f.voucherCode, pointsToUse: f.pointsToUse, phone: f.phone }),
      });
      if (res.ok) {
        const data: Quote = await res.json();
        setQ(data);
        if (data.offerLabel && f.promoCode && !data.promoError && lastPromo.current !== f.promoCode) {
          lastPromo.current = f.promoCode;
          track("promo_applied", { code: f.promoCode });
        }
      }
    }, 300);
    return () => clearTimeout(t);
  }, [items, f.fulfilment, f.zoneId, f.promoCode, f.voucherCode, f.pointsToUse, f.phone]);

  // POD may become unavailable
  useEffect(() => {
    if (q && !q.podAllowed && f.paymentMethod === "pod") setF((s) => ({ ...s, paymentMethod: "mpesa" }));
  }, [q, f.paymentMethod]);

  if (!items.length)
    return (
      <div className="card mx-auto mt-6 max-w-md p-8 text-center">
        <h1 className="h2">Nothing to check out yet</h1>
        <Link href="/shop" className="btn-gold mt-4">Browse drinks</Link>
      </div>
    );

  const deliveryLocked = subtotal < minDelivery;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, items: items.map((i) => ({ productId: i.productId, qty: i.qty })) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Something went wrong. Please try again."]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      track("purchase", { currency: "KES", value: data.total, transaction_id: data.orderNo });
      if (f.pointsToUse > 0) track("points_redeemed", { points: q?.pointsUsed });
      clear();
      router.push(`/track?o=${data.orderNo}&p=${data.phone}&new=1${data.pay?.mode ? `&pay=${data.pay.mode}` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <h1 className="h1 !text-3xl">Checkout</h1>
        {errors.length > 0 && (
          <div className="rounded-xl border border-hot/50 bg-hot/10 p-3 text-sm text-hot" role="alert">
            {errors.map((er) => (
              <p key={er}>• {er}</p>
            ))}
          </div>
        )}

        <section className="card space-y-3 p-4">
          <h2 className="font-black">1. Your details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" required className="field" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
            </div>
            <div>
              <label className="label" htmlFor="phone">M-Pesa phone (07xx / 01xx)</label>
              <input id="phone" required inputMode="tel" placeholder="0712 345 678" className="field" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
            </div>
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-black">2. Delivery or pickup</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`rounded-xl border p-3 text-sm ${f.fulfilment === "delivery" ? "border-gold bg-gold/10" : "border-line"} ${deliveryLocked ? "opacity-60" : "cursor-pointer"}`}>
              <input type="radio" className="mr-2 accent-[#f7b500]" disabled={deliveryLocked} checked={f.fulfilment === "delivery"} onChange={() => set("fulfilment", "delivery")} />
              <b>Delivery</b>
              <span className="block text-xs text-mute">{deliveryLocked ? `Locked – add ${ksh(minDelivery - subtotal)} more (min ${ksh(minDelivery)})` : `Hours ${deliveryHours}`}</span>
            </label>
            <label className={`cursor-pointer rounded-xl border p-3 text-sm ${f.fulfilment === "pickup" ? "border-gold bg-gold/10" : "border-line"}`}>
              <input type="radio" className="mr-2 accent-[#f7b500]" checked={f.fulfilment === "pickup"} onChange={() => set("fulfilment", "pickup")} />
              <b>Pickup at Kiamunyi shop</b>
              <span className="block text-xs text-mute">Free · any order value</span>
            </label>
          </div>
          {f.fulfilment === "delivery" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="zone">Delivery zone</label>
                <select id="zone" required className="field" value={f.zoneId} onChange={(e) => set("zoneId", e.target.value)}>
                  <option value="">Choose your area…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} · {z.areas} · {ksh(z.fee)} · ~{z.minutes} min
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="landmark">Landmark / directions</label>
                <input id="landmark" required className="field" placeholder="e.g. Blue gate behind Kiamunyi Primary" value={f.landmark} onChange={(e) => set("landmark", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="time">Preferred time</label>
                <select id="time" className="field" value={f.preferredTime} onChange={(e) => set("preferredTime", e.target.value)}>
                  {["ASAP", "In about 1 hour", "Evening 6pm–8pm", "Late 8pm–10pm"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {q?.hoursMessage && <p className="rounded-lg bg-gold/10 p-2 text-xs text-gold">{q.hoursMessage}</p>}
          <div>
            <label className="label" htmlFor="notes">Notes (optional)</label>
            <input id="notes" className="field" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-black">3. Offers & rewards</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="promo">Promo code</label>
              <input id="promo" className="field uppercase" value={f.promoCode} onChange={(e) => set("promoCode", e.target.value.toUpperCase())} placeholder="e.g. JAYS10" />
              {q?.promoError && <p className="mt-1 text-xs text-hot">{q.promoError}</p>}
              {q?.offerLabel && !q.promoError && <p className="mt-1 text-xs text-mint">✓ {q.offerLabel} applied</p>}
            </div>
            <div>
              <label className="label" htmlFor="voucher">Voucher code</label>
              <input id="voucher" className="field uppercase" value={f.voucherCode} onChange={(e) => set("voucherCode", e.target.value.toUpperCase())} placeholder="JV-XXXXXX" />
              {q?.voucherLabel && <p className="mt-1 text-xs text-mint">✓ {q.voucherLabel}</p>}
            </div>
          </div>
          {q?.balance != null ? (
            <div>
              <label className="label" htmlFor="pts">Redeem points (balance {q.balance}, min {minRedeem})</label>
              <div className="flex gap-2">
                <input id="pts" type="number" min={0} className="field" value={f.pointsToUse || ""} onChange={(e) => set("pointsToUse", Number(e.target.value))} />
                <button type="button" className="btn-ghost" onClick={() => set("pointsToUse", q.balance ?? 0)}>Max</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-mute">
              Have points? <Link href="/rewards" className="font-bold text-gold">Verify your phone on the Rewards page</Link> to redeem them here.
            </p>
          )}
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-black">4. Payment</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`cursor-pointer rounded-xl border p-3 text-sm ${f.paymentMethod === "mpesa" ? "border-gold bg-gold/10" : "border-line"}`}>
              <input type="radio" className="mr-2 accent-[#f7b500]" checked={f.paymentMethod === "mpesa"} onChange={() => set("paymentMethod", "mpesa")} />
              <b>M-Pesa</b>
              <span className="block text-xs text-mute">STK prompt on your phone (or pay to our Till)</span>
            </label>
            <label className={`rounded-xl border p-3 text-sm ${f.paymentMethod === "pod" ? "border-gold bg-gold/10" : "border-line"} ${q && !q.podAllowed ? "opacity-50" : "cursor-pointer"}`}>
              <input type="radio" className="mr-2 accent-[#f7b500]" disabled={!!q && !q.podAllowed} checked={f.paymentMethod === "pod"} onChange={() => set("paymentMethod", "pod")} />
              <b>{f.fulfilment === "delivery" ? "Pay on Delivery" : "Pay at pickup"}</b>
              <span className="block text-xs text-mute">{q && !q.podAllowed ? "Only Zones 1–2 and orders under the cap" : "M-Pesa to the rider's Till on arrival"}</span>
            </label>
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <label className="flex gap-3 text-sm">
            <input type="checkbox" required className="mt-1 h-5 w-5 accent-[#f7b500]" checked={f.ageConfirmed} onChange={(e) => set("ageConfirmed", e.target.checked)} />
            <span><b>I am 18+ and will show ID on delivery.</b> Orders are cancelled if ID is not shown.</span>
          </label>
          <label className="flex gap-3 text-xs text-mute">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#f7b500]" checked={f.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
            <span>Send me Jay&apos;s offers and reward updates by SMS/WhatsApp. I can opt out any time (Data Protection Act, 2019).</span>
          </label>
          <label className="flex gap-3 text-xs text-mute">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#f7b500]" checked={f.topBuyerConsent} onChange={(e) => set("topBuyerConsent", e.target.checked)} />
            <span>Show my first name on the public Top Buyers list if I rank.</span>
          </label>
          <input type="text" tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} aria-hidden />
        </section>
      </div>

      <aside className="card h-fit space-y-2 p-5 lg:sticky lg:top-20">
        <h2 className="font-black">Order summary</h2>
        {items.map((i) => (
          <div key={i.productId} className="flex justify-between text-xs text-mute">
            <span>{i.qty} × {i.name}</span>
            <span>{ksh(i.price * i.qty)}</span>
          </div>
        ))}
        <hr className="border-line" />
        <L l="Subtotal" v={ksh(q?.subtotal ?? subtotal)} />
        {q && q.discount > 0 && <L l={`Offer: ${q.offerLabel}`} v={`− ${ksh(q.discount)}`} g />}
        {q && q.voucherDiscount > 0 && <L l="Voucher" v={`− ${ksh(q.voucherDiscount)}`} g />}
        {q && q.pointsUsed > 0 && <L l={`Points used (${q.pointsUsed})`} v={`− ${ksh(q.pointsDiscount)}`} g />}
        {f.fulfilment === "delivery" && <L l={`Delivery${q?.freeDelivery ? " (free!)" : ""}`} v={f.zoneId ? ksh(q?.deliveryFee ?? 0) : "Choose zone"} />}
        <hr className="border-line" />
        <div className="flex justify-between text-lg font-black">
          <span>Total</span>
          <span>{ksh(q?.total ?? subtotal)}</span>
        </div>
        {q && <p className="text-xs font-semibold text-mint">★ You&apos;ll earn {q.pointsEarned} points on delivery</p>}
        {q?.notices.map((n) => (
          <p key={n} className="text-xs text-gold">{n}</p>
        ))}
        {q && q.errors.length > 0 && (
          <div className="text-xs text-hot">
            {q.errors.map((er) => (
              <p key={er}>• {er}</p>
            ))}
          </div>
        )}
        <button disabled={busy} className="btn-gold mt-2 w-full !py-3 text-base">
          {busy ? "Placing order…" : f.paymentMethod === "mpesa" ? `Pay ${ksh(q?.total ?? subtotal)} with M-Pesa` : "Place order"}
        </button>
        <p className="text-center text-[11px] text-mute">Drink responsibly. 18+ only.</p>
      </aside>
    </form>
  );
}

function L({ l, v, g }: { l: string; v: string; g?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${g ? "text-mint" : ""}`}>
      <span>{l}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}
