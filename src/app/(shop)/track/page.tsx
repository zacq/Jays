import type { Metadata } from "next";
import { db } from "@/db";
import { orderItems, orders, riders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import TrackLive from "@/components/TrackLive";
import { fmtDate, ksh, localPhone, normalizePhone, STATUS_LABEL } from "@/lib/format";
import { darajaConfigured } from "@/lib/mpesa";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Track my order" };

const STEPS = ["received", "paid", "packed", "out_for_delivery", "delivered"];

export default async function TrackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const no = (sp.o || "").trim().toUpperCase();
  const phone = normalizePhone(sp.p);
  let order: typeof orders.$inferSelect | undefined;
  if (no && phone) [order] = await db.select().from(orders).where(and(eq(orders.orderNo, no), eq(orders.phone, phone)));
  const items = order ? await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)) : [];
  const [rider] = order?.riderId ? await db.select().from(riders).where(eq(riders.id, order.riderId)) : [];
  const s = await getSettings();
  const idx = order ? STEPS.indexOf(order.status) : -1;
  const dead = order && (order.status === "cancelled" || order.status === "refunded");
  const unpaidMpesa = !!order && order.paymentMethod === "mpesa" && order.paymentStatus === "unpaid" && !dead;
  const stepLabel = (st: string) => (st === "delivered" && order?.fulfilment === "pickup" ? "Picked up" : STATUS_LABEL[st]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1 !text-3xl sm:!text-4xl">Track my order</h1>
      <form className="card mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]" action="/track">
        <div>
          <label className="label" htmlFor="o">Order number</label>
          <input id="o" name="o" defaultValue={sp.o ?? ""} placeholder="JY12345" className="field uppercase" required />
        </div>
        <div>
          <label className="label" htmlFor="p">Phone</label>
          <input id="p" name="p" defaultValue={sp.p ?? ""} placeholder="0712 345 678" className="field" required inputMode="tel" />
        </div>
        <button className="btn-gold self-end">Track</button>
      </form>

      {no && !order && <p className="mt-4 rounded-xl border border-hot/50 bg-hot/10 p-3 text-sm text-hot">We couldn&apos;t find that order. Check the order number and the phone you used at checkout.</p>}

      {order && (
        <div className="mt-5 space-y-4">
          {sp.new && (
            <div className="rounded-xl border border-mint/50 bg-mint/10 p-3 text-sm text-mint">
              ✓ Order {order.orderNo} placed! {order.paymentMethod === "pod" ? "Pay by M-Pesa to the rider's Till on arrival." : "Complete payment below to confirm it."} Save this page or your order number.
            </div>
          )}
          <div className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-black">{order.orderNo}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${dead ? "bg-hot text-white" : "bg-gold text-black"}`}>{stepLabel(order.status)}</span>
            </div>
            <p className="mt-1 text-xs text-mute">Placed {fmtDate(order.createdAt, true)} · {order.fulfilment === "delivery" ? `Delivery to ${order.zoneName}` : "Pickup at Kiamunyi shop"} · {order.preferredTime}</p>
            {!dead ? (
              <ol className="mt-5 grid grid-cols-5 gap-1 text-center text-[11px]">
                {STEPS.filter((st) => st !== "out_for_delivery" || order.fulfilment === "delivery" || true).map((st, i) => (
                  <li key={st} className={i <= idx ? "font-bold text-gold" : "text-mute"}>
                    <div className={`mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full border-2 ${i <= idx ? "border-gold bg-gold text-black" : "border-line"}`}>{i <= idx ? "✓" : i + 1}</div>
                    {stepLabel(st)}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-hot">This order was {order.status}. {order.cancelReason ? `Reason: ${order.cancelReason}.` : ""} {order.paymentStatus === "refunded" ? "Your refund goes back to your M-Pesa number." : ""}</p>
            )}
            {order.status === "out_for_delivery" && rider && (
              <p className="mt-4 rounded-lg bg-panel2 p-3 text-sm">🏍️ Your rider is <b>{rider.name}</b> · <a className="font-bold text-gold" href={`tel:${rider.phone}`}>{localPhone(rider.phone)}</a>. Have your ID ready.</p>
            )}
            {order.status === "delivered" && <p className="mt-4 text-sm text-mint">Thank you! You earned {order.pointsEarned} points.</p>}
          </div>

          <TrackLive orderNo={order.orderNo} phone={localPhone(order.phone)} unpaidMpesa={unpaidMpesa} demo={!darajaConfigured()} total={order.total} initialStatus={order.status} initialPay={order.paymentStatus} autoPay={sp.pay} />

          <div className="card space-y-1 p-5 text-sm">
            <h3 className="mb-2 font-black">Items</h3>
            {items.map((i) => (
              <div key={i.id} className="flex justify-between"><span>{i.qty} × {i.name}</span><span>{ksh(i.qty * i.unitPrice)}</span></div>
            ))}
            <hr className="my-2 border-line" />
            <div className="flex justify-between text-mute"><span>Subtotal</span><span>{ksh(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-mint"><span>Offer {order.offerLabel}</span><span>− {ksh(order.discount)}</span></div>}
            {order.voucherDiscount > 0 && <div className="flex justify-between text-mint"><span>Voucher</span><span>− {ksh(order.voucherDiscount)}</span></div>}
            {order.pointsUsed > 0 && <div className="flex justify-between text-mint"><span>Points ({order.pointsUsed})</span><span>− {ksh(order.pointsUsed)}</span></div>}
            {order.fulfilment === "delivery" && <div className="flex justify-between text-mute"><span>Delivery</span><span>{ksh(order.deliveryFee)}</span></div>}
            <div className="flex justify-between pt-1 text-base font-black"><span>Total</span><span>{ksh(order.total)}</span></div>
            <p className="pt-2 text-xs text-mute">Payment: {order.paymentMethod === "mpesa" ? "M-Pesa" : "Pay on delivery/pickup"} · {order.paymentStatus}</p>
          </div>
          <p className="text-center text-xs text-mute">Need help? WhatsApp {s.shop.phone}. Drink responsibly.</p>
        </div>
      )}
    </div>
  );
}
