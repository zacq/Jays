import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { campaigns, customers, orderItems, orders, payments, riders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { orderAction } from "@/app/admin/actions";
import { fmtDate, ksh, localPhone, STATUS_LABEL, waLink } from "@/lib/format";
import { getBalance } from "@/lib/loyalty";
import { PrintButton } from "@/components/AdminBits";

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  const session = await requireRole(["owner", "attendant", "rider"]);
  const { id } = await params;
  const sp = await searchParams;
  const [o] = await db.select().from(orders).where(eq(orders.id, Number(id)));
  if (!o) notFound();
  if (session.role === "rider" && o.riderId !== session.riderId) notFound();
  const [items, pays, rs, [cust], [camp]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, o.id)),
    db.select().from(payments).where(eq(payments.orderId, o.id)).orderBy(desc(payments.createdAt)),
    db.select().from(riders).where(eq(riders.active, true)),
    db.select().from(customers).where(eq(customers.id, o.customerId)),
    o.campaignId ? db.select().from(campaigns).where(eq(campaigns.id, o.campaignId)) : Promise.resolve([]),
  ]);
  const rider = rs.find((r) => r.id === o.riderId);
  const bal = cust ? await getBalance(cust.id) : 0;
  const dead = o.status === "cancelled" || o.status === "refunded";
  const done = o.status === "delivered";
  const isRider = session.role === "rider";
  const slip = `Jay's order ${o.orderNo}\n${o.name} ${localPhone(o.phone)}\n${o.fulfilment === "delivery" ? `${o.zoneName}: ${o.landmark}` : "PICKUP"}\n${items.map((i) => `${i.qty}x ${i.name}`).join("\n")}\nTotal ${ksh(o.total)} (${o.paymentStatus === "paid" ? "PAID" : "COLLECT via M-Pesa"})`;

  return (
    <div className="space-y-3">
      <Link href="/admin/orders" className="no-print text-sm font-semibold text-slate-600 underline">← Orders</Link>
      {sp.err && <p className="rounded bg-red-50 p-2 text-sm font-semibold text-red-600">{sp.err}</p>}
      <div className="a-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-black">{o.orderNo}</h1>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">{STATUS_LABEL[o.status]}</span>
        </div>
        <p className="text-sm text-slate-500">{fmtDate(o.createdAt, true)} · Source: {o.source}{camp ? ` (campaign ${camp.name})` : ""}{o.promoCode ? ` · code ${o.promoCode}` : ""}</p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="font-bold">{o.name}</p>
            <p><a className="text-blue-600 underline" href={`tel:${localPhone(o.phone)}`}>{localPhone(o.phone)}</a> · <a className="text-green-700 underline" href={waLink(o.phone, `Hi ${o.name}, this is Jay's about order ${o.orderNo}.`)} target="_blank" rel="noreferrer">WhatsApp</a></p>
            {cust && <p className="text-xs text-slate-500">Points balance {bal}{o.isNewCustomer ? " · NEW customer" : ""}</p>}
          </div>
          <div>
            <p className="font-bold">{o.fulfilment === "delivery" ? `Delivery – ${o.zoneName}` : "Pickup at shop"}</p>
            {o.landmark && <p>📍 {o.landmark}</p>}
            <p>⏰ {o.preferredTime}</p>
            {o.notes && <p>📝 {o.notes}</p>}
            {rider && <p>🏍️ Rider: {rider.name} ({localPhone(rider.phone)})</p>}
          </div>
        </div>
        <table className="mt-3 w-full">
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100"><td className="a-td">{i.qty} × {i.name}</td><td className="a-td text-right">{ksh(i.qty * i.unitPrice)}</td></tr>
            ))}
            <tr className="border-t"><td className="a-td text-slate-500">Subtotal</td><td className="a-td text-right">{ksh(o.subtotal)}</td></tr>
            {o.discount > 0 && <tr><td className="a-td text-slate-500">Offer {o.offerLabel}</td><td className="a-td text-right">− {ksh(o.discount)}</td></tr>}
            {o.voucherDiscount > 0 && <tr><td className="a-td text-slate-500">Voucher {o.voucherCode}</td><td className="a-td text-right">− {ksh(o.voucherDiscount)}</td></tr>}
            {o.pointsUsed > 0 && <tr><td className="a-td text-slate-500">Points used ({o.pointsUsed})</td><td className="a-td text-right">− {ksh(o.pointsUsed)}</td></tr>}
            {o.deliveryFee > 0 && <tr><td className="a-td text-slate-500">Delivery</td><td className="a-td text-right">{ksh(o.deliveryFee)}</td></tr>}
            <tr className="border-t"><td className="a-td font-black">Total</td><td className="a-td text-right font-black">{ksh(o.total)}</td></tr>
          </tbody>
        </table>
        <p className="text-sm">Payment: <b>{o.paymentMethod === "mpesa" ? "M-Pesa" : "Pay on delivery/pickup"}</b> · <b className={o.paymentStatus === "paid" ? "text-green-600" : "text-red-600"}>{o.paymentStatus}</b> · Points to earn {o.pointsEarned} · ID checked: {o.idChecked ? "yes" : "no"}</p>
        {pays.length > 0 && (
          <ul className="mt-1 text-xs text-slate-500">
            {pays.map((p) => (
              <li key={p.id}>{p.method.toUpperCase()} {ksh(p.amount)} – {p.status}{p.receipt ? ` · ${p.receipt}` : ""}{p.resultDesc ? ` · ${p.resultDesc}` : ""}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <PrintButton />
          <a className="a-btn2 no-print" href={`https://wa.me/?text=${encodeURIComponent(slip)}`} target="_blank" rel="noreferrer">Share slip on WhatsApp</a>
        </div>
      </div>

      {!dead && !done && (
        <div className="a-card no-print space-y-3">
          <h2 className="font-black">Actions</h2>
          {!isRider && o.paymentStatus !== "paid" && o.paymentMethod === "mpesa" && (
            <form action={orderAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={o.id} /><input type="hidden" name="action" value="paid" />
              <div><label className="a-lbl">M-Pesa code (from Till statement)</label><input name="receipt" className="a-in" placeholder={pays.find((p) => p.method === "till")?.receipt ?? "optional"} defaultValue={pays.find((p) => p.method === "till")?.receipt ?? ""} /></div>
              <button className="a-btn">Mark as paid</button>
            </form>
          )}
          {!isRider && o.fulfilment === "delivery" && (
            <form action={orderAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={o.id} /><input type="hidden" name="action" value="assign" />
              <div>
                <label className="a-lbl">Rider</label>
                <select name="riderId" defaultValue={o.riderId ?? ""} className="a-in">
                  <option value="">Unassigned</option>
                  {rs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <button className="a-btn2">Assign</button>
            </form>
          )}
          {!isRider && (o.status === "received" || o.status === "paid") && (
            <form action={orderAction}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="action" value="packed" /><button className="a-btn">Mark packed</button></form>
          )}
          {!isRider && o.fulfilment === "delivery" && (o.status === "packed" || o.status === "paid" || o.status === "received") && (
            <form action={orderAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={o.id} /><input type="hidden" name="action" value="out_for_delivery" />
              <select name="riderId" defaultValue={o.riderId ?? ""} className="a-in w-auto" required>
                <option value="">Choose rider…</option>
                {rs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button className="a-btn">Out for delivery</button>
            </form>
          )}
          {(o.status !== "received" || o.paymentMethod === "pod") && (
            <form action={orderAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={o.id} /><input type="hidden" name="action" value="delivered" />
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="idChecked" className="h-5 w-5" /> ID checked (customer is 18+)</label>
              <button className="a-btn">{o.fulfilment === "pickup" ? "Mark picked up" : "Mark delivered"}</button>
            </form>
          )}
          {!isRider && (
            <form action={orderAction} className="flex flex-wrap items-end gap-2 border-t pt-3">
              <input type="hidden" name="id" value={o.id} />
              <div><label className="a-lbl">Cancel / refund reason</label><input name="reason" className="a-in" placeholder="e.g. No valid ID shown" required /></div>
              <button name="action" value="cancelled" className="a-btn2 !text-red-600">Cancel order</button>
              {o.paymentStatus === "paid" && <button name="action" value="refunded" className="a-btn2 !text-red-600">Cancel & mark refunded</button>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
