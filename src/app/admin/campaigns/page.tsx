import Link from "next/link";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { fmtDate, ksh, toLocalInput } from "@/lib/format";
import { offerSummary } from "@/lib/pricing";

type Stat = { id: number; scans: number; uniq: number; orders: number; revenue: number; new_orders: number };

const HOLIDAYS: [string, string][] = [
  ["Mashujaa Day", "2026-10-20"],
  ["Jamhuri Day", "2026-12-12"],
  ["Christmas", "2026-12-25"],
  ["New Year", "2027-01-01"],
  ["Valentine's Day", "2027-02-14"],
  ["Easter", "2027-03-28"],
  ["Madaraka Day", "2027-06-01"],
  ["Mashujaa Day", "2027-10-20"],
  ["Jamhuri Day", "2027-12-12"],
];

export default async function CampaignsAdmin() {
  await requireRole(["owner"]);
  const list = await db.select().from(campaigns).orderBy(desc(campaigns.startsAt));
  const res = await db.execute(sql`
    select c.id,
      (select count(*)::int from qr_scans s where s.campaign_id=c.id) as scans,
      (select count(distinct visitor_id)::int from qr_scans s where s.campaign_id=c.id) as uniq,
      (select count(*)::int from orders o where o.campaign_id=c.id and o.status not in ('cancelled','refunded')) as orders,
      (select coalesce(sum(total),0)::int from orders o where o.campaign_id=c.id and o.status not in ('cancelled','refunded')) as revenue,
      (select count(*)::int from orders o where o.campaign_id=c.id and o.is_new_customer and o.status not in ('cancelled','refunded')) as new_orders
    from campaigns c`);
  const stats = new Map((res.rows as unknown as Stat[]).map((r) => [r.id, r]));
  const now = new Date();
  const upcoming = HOLIDAYS.filter(([, d]) => new Date(`${d}T23:59:59+03:00`) >= now).slice(0, 6);
  const day = 86400000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Campaigns & QR codes</h1>
        <Link href="/admin/campaigns/new" className="a-btn">+ New campaign</Link>
      </div>

      <div className="a-card">
        <h2 className="mb-2 font-black">Campaign calendar – prepare early</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map(([name, d]) => {
            const date = new Date(`${d}T12:00:00+03:00`);
            const covered = list.find((c) => c.startsAt <= date && c.endsAt >= date);
            const start = new Date(date.getTime() - 5 * day);
            const end = new Date(date.getTime() + 1 * day);
            const qs = new URLSearchParams({ name: `${name} ${date.getFullYear()}`, start: toLocalInput(start), end: toLocalInput(end) });
            return (
              <div key={name + d} className="rounded-lg border border-slate-200 p-2 text-sm">
                <p className="font-bold">{name}</p>
                <p className="text-xs text-slate-500">{fmtDate(date)} · in {Math.max(0, Math.ceil((date.getTime() - now.getTime()) / day))} days</p>
                {covered ? <p className="text-xs font-semibold text-green-600">✓ {covered.name}</p> : <Link className="text-xs font-semibold text-blue-600 underline" href={`/admin/campaigns/new?${qs}`}>Create offer →</Link>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {list.map((c) => {
          const s = stats.get(c.id)!;
          const live = c.active && c.startsAt <= now && c.endsAt > now;
          const state = !c.active ? "Off" : live ? "LIVE" : c.startsAt > now ? "Scheduled" : "Ended";
          return (
            <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="a-card block hover:border-amber-400">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-black">{c.name} <span className="text-xs font-normal text-slate-500">/c/{c.slug} · {c.type}</span></p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${live ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{state}</span>
              </div>
              <p className="text-sm text-slate-500">{offerSummary(c)}{c.promoCode ? ` · code ${c.promoCode}` : ""} · {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)}</p>
              <p className="mt-1 text-sm">{s.scans} scans · {s.uniq} unique · <b>{s.orders} orders</b> · {ksh(s.revenue)} · AOV {ksh(s.orders ? s.revenue / s.orders : 0)} · new {s.new_orders} / returning {s.orders - s.new_orders}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
