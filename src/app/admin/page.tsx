import Link from "next/link";
import { db } from "@/db";
import { orders, products } from "@/db/schema";
import { and, desc, gte, inArray, lte, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ksh, fmtDate, STATUS_LABEL } from "@/lib/format";
import { maybeRunJobs } from "@/lib/loyalty";
import { runJobsAction } from "@/app/admin/actions";
import { OrderFeed } from "@/components/AdminBits";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ jobs?: string }> }) {
  const session = await requireRole(["owner", "attendant", "rider"]);
  const { redirect } = await import("next/navigation");
  if (session.role === "rider") redirect("/admin/orders");
  const sp = await searchParams;
  await maybeRunJobs();
  const startToday = new Date();
  startToday.setUTCHours(-3, 0, 0, 0);
  if (startToday.getTime() > Date.now()) startToday.setUTCDate(startToday.getUTCDate() - 1);
  const since30 = new Date(Date.now() - 30 * 86400000);

  const [todayRows, pending, lows, latest, byZone, bySource, byProduct, [{ latestId }]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`, rev: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.paymentStatus} = 'paid'),0)::int` }).from(orders).where(gte(orders.createdAt, startToday)),
    db.select().from(orders).where(inArray(orders.status, ["received", "paid", "packed", "out_for_delivery"])).orderBy(desc(orders.createdAt)).limit(8),
    db.select().from(products).where(and(sql`${products.stockQty} <= ${products.lowStockAt}`, sql`${products.active}`)).orderBy(products.stockQty),
    db.select({ n: sql<number>`count(*)::int`, rev: sql<number>`coalesce(sum(${orders.total}),0)::int`, aov: sql<number>`coalesce(avg(${orders.total}),0)::int`, del: sql<number>`count(*) filter (where ${orders.fulfilment}='delivery')::int` }).from(orders).where(and(gte(orders.createdAt, since30), sql`${orders.status} not in ('cancelled','refunded')`)),
    db.select({ k: sql<string>`coalesce(${orders.zoneName},'Pickup')`, n: sql<number>`count(*)::int`, rev: sql<number>`sum(${orders.total})::int` }).from(orders).where(and(gte(orders.createdAt, since30), sql`${orders.status} not in ('cancelled','refunded')`)).groupBy(sql`coalesce(${orders.zoneName},'Pickup')`),
    db.select({ k: orders.source, n: sql<number>`count(*)::int`, rev: sql<number>`sum(${orders.total})::int` }).from(orders).where(and(gte(orders.createdAt, since30), sql`${orders.status} not in ('cancelled','refunded')`)).groupBy(orders.source).orderBy(desc(sql`sum(${orders.total})`)).limit(8),
    db.execute(sql`select i.name as k, sum(i.qty)::int as n from order_items i join orders o on o.id=i.order_id where o.created_at >= ${since30} and o.status not in ('cancelled','refunded') group by i.name order by n desc limit 5`),
    db.select({ latestId: sql<number>`coalesce(max(${orders.id}),0)::int` }).from(orders),
  ]);
  void lte;
  const stockValue = (await db.execute(sql`select coalesce(sum(stock_qty*price_ksh),0)::int as v from products`)).rows[0] as { v: number };
  const m = latest[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Dashboard</h1>
        <OrderFeed initial={latestId} />
      </div>
      {sp.jobs && <p className="rounded bg-green-50 p-2 text-sm text-green-700">Jobs run: {sp.jobs}</p>}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat l="Orders today" v={String(todayRows[0].n)} />
        <Stat l="Paid revenue today" v={ksh(todayRows[0].rev)} />
        <Stat l="Open orders" v={String(pending.length)} />
        <Stat l="Low / sold-out items" v={String(lows.length)} warn={lows.length > 0} />
        <Stat l="30d orders" v={String(m.n)} />
        <Stat l="30d revenue" v={ksh(m.rev)} />
        <Stat l="Avg order value" v={ksh(m.aov)} />
        <Stat l="Delivery share" v={m.n ? `${Math.round((m.del / m.n) * 100)}%` : "–"} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="a-card">
          <div className="mb-2 flex justify-between"><h2 className="font-black">Open orders</h2><Link href="/admin/orders" className="text-sm underline">All</Link></div>
          {pending.length === 0 && <p className="text-sm text-slate-500">Nothing waiting 🎉</p>}
          {pending.map((o) => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex justify-between border-t border-slate-100 py-1.5 text-sm hover:bg-slate-50">
              <span><b>{o.orderNo}</b> · {o.name} · {STATUS_LABEL[o.status]}</span><span>{ksh(o.total)} · {fmtDate(o.createdAt, true)}</span>
            </Link>
          ))}
        </div>
        <div className="a-card">
          <div className="mb-2 flex justify-between"><h2 className="font-black">Low stock</h2><Link href="/admin/stock" className="text-sm underline">Stock</Link></div>
          {lows.length === 0 && <p className="text-sm text-slate-500">All stocked up.</p>}
          {lows.slice(0, 8).map((p) => (
            <p key={p.id} className="flex justify-between border-t border-slate-100 py-1 text-sm"><span>{p.name}</span><b className={p.stockQty === 0 ? "text-red-600" : "text-amber-600"}>{p.stockQty === 0 ? "SOLD OUT" : `${p.stockQty} left`}</b></p>
          ))}
          <p className="mt-2 text-xs text-slate-500">Stock value (at retail): {ksh(stockValue.v)}</p>
        </div>
        <Table title="Sales by zone (30d)" rows={byZone.map((r) => [r.k, `${r.n} orders`, ksh(r.rev)])} />
        <Table title="Sales by source / campaign (30d)" rows={bySource.map((r) => [r.k, `${r.n} orders`, ksh(r.rev)])} />
        <Table title="Top products (30d)" rows={(byProduct.rows as { k: string; n: number }[]).map((r) => [r.k, `${r.n} sold`, ""])} />
        {session.role === "owner" && (
          <div className="a-card">
            <h2 className="font-black">Scheduled jobs</h2>
            <p className="my-1 text-xs text-slate-500">Payment reminders (15 min), points expiry, monthly Top Buyers proposal. Also runs on cron via /api/cron/daily.</p>
            <form action={runJobsAction}><button className="a-btn">Run now</button></form>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <a className="a-btn2" href="/api/admin/export/orders">Export orders CSV</a>
              <a className="a-btn2" href="/api/admin/export/customers">Export customers CSV</a>
              <a className="a-btn2" href="/api/admin/export/stock">Export stock CSV</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ l, v, warn }: { l: string; v: string; warn?: boolean }) {
  return (
    <div className="a-card !p-3">
      <p className="text-xs font-semibold text-slate-500">{l}</p>
      <p className={`text-xl font-black ${warn ? "text-red-600" : ""}`}>{v}</p>
    </div>
  );
}
function Table({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="a-card">
      <h2 className="mb-1 font-black">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-slate-500">No data yet.</p>}
      {rows.map((r, i) => (
        <p key={i} className="flex justify-between gap-2 border-t border-slate-100 py-1 text-sm"><span className="truncate">{r[0]}</span><span className="shrink-0 text-slate-500">{r[1]} {r[2] && <b className="text-slate-900">· {r[2]}</b>}</span></p>
      ))}
    </div>
  );
}
