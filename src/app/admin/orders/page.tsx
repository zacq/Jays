import Link from "next/link";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { fmtDate, ksh, localPhone, STATUS_LABEL } from "@/lib/format";
import { OrderFeed } from "@/components/AdminBits";

const TABS = ["active", "received", "paid", "packed", "out_for_delivery", "delivered", "cancelled", "all"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await requireRole(["owner", "attendant", "rider"]);
  const sp = await searchParams;
  const tab = sp.status && TABS.includes(sp.status) ? sp.status : session.role === "rider" ? "active" : "active";
  const conds = [];
  if (session.role === "rider") conds.push(eq(orders.riderId, session.riderId ?? -1));
  if (tab === "active") conds.push(inArray(orders.status, ["received", "paid", "packed", "out_for_delivery"]));
  else if (tab === "cancelled") conds.push(inArray(orders.status, ["cancelled", "refunded"]));
  else if (tab !== "all") conds.push(eq(orders.status, tab));
  const list = await db.select().from(orders).where(conds.length ? and(...conds) : undefined).orderBy(desc(orders.createdAt)).limit(100);
  const [{ latest }] = await db.select({ latest: sql<number>`coalesce(max(${orders.id}),0)::int` }).from(orders);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">{session.role === "rider" ? "My deliveries" : "Orders"}</h1>
        {session.role !== "rider" && <OrderFeed initial={latest} />}
      </div>
      {session.role !== "rider" && (
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link key={t} href={`/admin/orders?status=${t}`} className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}>
              {t === "active" ? "Active" : t === "all" ? "All" : STATUS_LABEL[t] ?? t}
            </Link>
          ))}
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((o) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="a-card block hover:border-amber-400">
            <div className="flex items-baseline justify-between">
              <span className="font-black">{o.orderNo}</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{STATUS_LABEL[o.status]}</span>
            </div>
            <p className="text-sm">{o.name} · {localPhone(o.phone)}</p>
            <p className="text-xs text-slate-500">
              {o.fulfilment === "delivery" ? `🏍️ ${o.zoneName} · ${o.landmark ?? ""}` : "🏪 Pickup"} · {o.preferredTime}
            </p>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">{fmtDate(o.createdAt, true)} · {o.source}</span>
              <span className="font-bold">{ksh(o.total)} <span className={o.paymentStatus === "paid" ? "text-green-600" : "text-red-500"}>{o.paymentStatus === "paid" ? "paid" : o.paymentMethod === "pod" ? "POD" : "unpaid"}</span></span>
            </div>
          </Link>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-500">No orders here.</p>}
      </div>
    </div>
  );
}
