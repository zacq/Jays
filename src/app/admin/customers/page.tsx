import { db } from "@/db";
import { customers } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { saveCustomer } from "@/app/admin/actions";
import { fmtDate, ksh, localPhone, waLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";

type Row = { id: number; phone: string; name: string | null; zone_name: string | null; tags: string; first_source: string | null; marketing_consent: boolean; opted_out: boolean; last_order_at: string | null; orders: number; spend: number; bottles: number; points: number; abandoned: number };

export default async function CustomersAdmin({ searchParams }: { searchParams: Promise<{ list?: string; q?: string }> }) {
  await requireRole(["owner", "attendant"]);
  const sp = await searchParams;
  const s = await getSettings();
  void customers; void desc;
  const res = await db.execute(sql`
    select c.id, c.phone, c.name, c.zone_name, c.tags, c.first_source, c.marketing_consent, c.opted_out, c.last_order_at,
      (select count(*)::int from orders o where o.customer_id=c.id and o.status='delivered') as orders,
      (select coalesce(sum(o.total),0)::int from orders o where o.customer_id=c.id and o.status='delivered') as spend,
      (select coalesce(sum(o.bottles),0)::int from orders o where o.customer_id=c.id and o.status='delivered') as bottles,
      (select coalesce(sum(p.points),0)::int from points_ledger p where p.customer_id=c.id) as points,
      (select count(*)::int from orders o where o.customer_id=c.id and o.payment_method='mpesa' and o.payment_status='unpaid' and o.status='received') as abandoned
    from customers c order by c.last_order_at desc nulls last, c.created_at desc limit 300`);
  let rows = res.rows as unknown as Row[];
  const q = sp.q?.toLowerCase();
  if (q) rows = rows.filter((r) => `${r.name} ${r.phone}`.toLowerCase().includes(q));
  const d30 = Date.now() - 30 * 86400000;
  if (sp.list === "lapsed") rows = rows.filter((r) => r.orders > 0 && r.last_order_at && new Date(r.last_order_at).getTime() < d30);
  if (sp.list === "near") rows = rows.filter((r) => r.points >= 60 && r.points < s.minRedeemPoints * 2);
  if (sp.list === "abandoned") rows = rows.filter((r) => r.abandoned > 0);
  const tpl: Record<string, (n: string) => string> = {
    lapsed: (n) => `Hi ${n}, it's Jay's in Kiamunyi! We miss you. Order today and earn points on every bottle. Reply STOP to opt out.`,
    near: (n) => `Hi ${n}, you're close to a Jay's reward! One more order and you can redeem your points. Reply STOP to opt out.`,
    abandoned: (n) => `Hi ${n}, your Jay's order is waiting for payment. Need help completing it via M-Pesa?`,
  };
  const lists = [["", "All"], ["lapsed", "No order in 30 days"], ["near", "Near a reward"], ["abandoned", "Abandoned checkout"]];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-black">Customers & follow-up</h1>
        <a className="a-btn2" href="/api/admin/export/customers">Export CSV</a>
      </div>
      <div className="flex flex-wrap gap-1">
        {lists.map(([k, l]) => (
          <a key={k} href={`/admin/customers?list=${k}`} className={`rounded-full px-3 py-1 text-sm font-semibold ${(sp.list ?? "") === k ? "bg-slate-900 text-white" : "bg-white"}`}>{l}</a>
        ))}
        <form className="ml-auto"><input name="q" defaultValue={sp.q} placeholder="Search name / phone" className="a-in" /></form>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="a-card !p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold">{r.name ?? "—"} <span className="font-normal text-slate-500">{localPhone(r.phone)} · {r.zone_name ?? "no zone"}</span></p>
              <p className="text-xs text-slate-500">Last order {fmtDate(r.last_order_at)} · first source: {r.first_source ?? "—"}</p>
            </div>
            <p className="text-sm">{r.orders} orders · {ksh(r.spend)} · {r.bottles} bottles · <b>{r.points} pts</b> · consent: {r.marketing_consent ? "marketing ✓" : "no marketing"}{r.opted_out ? " · OPTED OUT" : ""}</p>
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <form action={saveCustomer} className="flex items-center gap-1">
                <input type="hidden" name="id" value={r.id} />
                <input name="tags" defaultValue={r.tags} placeholder="tags: VIP, event, partner" className="a-in w-52" />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="optedOut" defaultChecked={r.opted_out} /> opted out</label>
                <button className="a-btn2">Save</button>
              </form>
              {sp.list && tpl[sp.list] && !r.opted_out && <a className="a-btn" target="_blank" rel="noreferrer" href={waLink(r.phone, tpl[sp.list]((r.name ?? "there").split(" ")[0]))}>WhatsApp template</a>}
              <a className="a-btn2" target="_blank" rel="noreferrer" href={waLink(r.phone, `Hi ${(r.name ?? "there").split(" ")[0]}, it's Jay's.`)}>WhatsApp</a>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-500">No customers in this list.</p>}
      </div>
    </div>
  );
}
