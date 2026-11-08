import { db } from "@/db";
import { campaigns, promoCodes } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { savePromo, togglePromo } from "@/app/admin/actions";
import { ksh } from "@/lib/format";

export default async function PromosAdmin() {
  await requireRole(["owner"]);
  const [codes, camps, stats] = await Promise.all([
    db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)),
    db.select().from(campaigns),
    db.execute(sql`select promo_code as code, count(*)::int as uses, coalesce(sum(total),0)::int as revenue from orders where promo_code is not null and status not in ('cancelled','refunded') group by promo_code`),
  ]);
  const st = new Map((stats.rows as { code: string; uses: number; revenue: number }[]).map((r) => [r.code, r]));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">Promo codes (creators & partners)</h1>
      <p className="text-xs text-slate-500">Give each TikTok creator or partner their own code. Usage and revenue below can drive creator payouts. Campaign codes (set on the campaign) are also tracked.</p>
      <div className="a-card overflow-x-auto !p-0">
        <table className="w-full min-w-[640px]">
          <thead className="border-b bg-slate-50"><tr><th className="a-th">Code</th><th className="a-th">Owner</th><th className="a-th">Offer</th><th className="a-th">Uses</th><th className="a-th">Revenue</th><th className="a-th">Live</th></tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="a-td font-black">{c.code}</td>
                <td className="a-td">{c.ownerName ?? "—"}</td>
                <td className="a-td">{c.offerType === "percent" ? `${c.offerValue}% off` : c.offerType === "fixed" ? `KSh ${c.offerValue} off` : c.offerType === "free_delivery" ? "Free delivery" : `${c.offerValue}x points`}{c.minSpend ? ` · min ${ksh(c.minSpend)}` : ""}{c.usageLimitPerPhone ? ` · ${c.usageLimitPerPhone}/phone` : ""}</td>
                <td className="a-td">{st.get(c.code)?.uses ?? 0}</td>
                <td className="a-td">{ksh(st.get(c.code)?.revenue ?? 0)}</td>
                <td className="a-td"><form action={togglePromo}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={String(!c.active)} /><button className="a-btn2">{c.active ? "Disable" : "Enable"}</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={savePromo} className="a-card grid grid-cols-2 items-end gap-2 md:grid-cols-4">
        <h2 className="col-span-full font-black">New code</h2>
        <div><label className="a-lbl">Code</label><input name="code" required className="a-in uppercase" placeholder="MWANGI10" /></div>
        <div><label className="a-lbl">Creator / partner</label><input name="ownerName" className="a-in" /></div>
        <div><label className="a-lbl">Offer</label><select name="offerType" className="a-in"><option value="percent">% off</option><option value="fixed">KSh off</option><option value="free_delivery">Free delivery</option><option value="points">Points multiplier</option></select></div>
        <div><label className="a-lbl">Value</label><input name="offerValue" type="number" defaultValue={10} className="a-in" /></div>
        <div><label className="a-lbl">Min spend</label><input name="minSpend" type="number" defaultValue={500} className="a-in" /></div>
        <div><label className="a-lbl">Uses per phone (0 = ∞)</label><input name="usageLimitPerPhone" type="number" defaultValue={1} className="a-in" /></div>
        <div><label className="a-lbl">Tag to campaign</label><select name="campaignId" className="a-in"><option value="">None</option>{camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <button className="a-btn">Create</button>
      </form>
    </div>
  );
}
