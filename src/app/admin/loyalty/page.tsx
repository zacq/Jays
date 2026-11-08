import { db } from "@/db";
import { rewardRules, topBuyersMonths, vouchers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { adjustPoints, saveLoyaltySettings, saveRule, topBuyersAction } from "@/app/admin/actions";
import { getSettings } from "@/lib/settings";
import { fmtDate, ksh, localPhone, monthKey, prevMonthKey } from "@/lib/format";
import { rewardFor, winnersOf, type TopEntry } from "@/lib/loyalty";

export default async function LoyaltyAdmin({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireRole(["owner"]);
  const sp = await searchParams;
  const s = await getSettings();
  const month = sp.month || prevMonthKey();
  const [rules, [tb], vs] = await Promise.all([
    db.select().from(rewardRules),
    db.select().from(topBuyersMonths).where(eq(topBuyersMonths.month, month)),
    db.select().from(vouchers).orderBy(desc(vouchers.createdAt)).limit(15),
  ]);
  const entries = (tb?.entries ?? []) as TopEntry[];
  const winnerIds = new Map(winnersOf(entries, tb?.topN ?? s.topBuyers.topN).map((w) => [w.customerId, w.rank]));
  const t = s.topBuyers;
  const rw = [...t.rewards, ...Array(3).fill({ from: 0, to: 0, label: "", voucherKsh: 0 })].slice(0, 3);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">Loyalty & Top Buyers</h1>

      <div className="a-card space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-black">Monthly Top Buyers – {month}</h2>
          <form className="flex items-end gap-2"><input name="month" defaultValue={month} placeholder={monthKey()} className="a-in w-28" /><button className="a-btn2">View month</button></form>
        </div>
        <p className="text-xs text-slate-500">Ranked by {t.measure === "spend" ? "total spend" : "bottles"} (delivered orders only; refunds excluded), min {t.minOrders} orders, ties → more orders → earliest order. Winners are not random.</p>
        <form action={topBuyersAction} className="flex gap-2">
          <input type="hidden" name="month" value={month} />
          <button name="action" value="generate" className="a-btn2" disabled={tb?.status === "approved"}>{tb ? "Re-generate proposal" : "Generate proposal"}</button>
          {tb && tb.status !== "approved" && <button name="action" value="approve" className="a-btn">Approve & send rewards</button>}
          {tb?.status === "approved" && <span className="rounded bg-green-100 px-2 py-1 text-sm font-bold text-green-700">Approved {fmtDate(tb.approvedAt)}</span>}
        </form>
        {!tb && <p className="text-sm text-slate-500">No list yet for this month. It is also proposed automatically on the 1st.</p>}
        {entries.map((e, i) => {
          const rank = winnerIds.get(e.customerId);
          const reward = rank ? rewardFor(rank, t.rewards) : null;
          return (
            <div key={e.customerId} className={`rounded-lg border p-2 text-sm ${e.disqualified ? "border-red-200 bg-red-50" : rank ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p><b>{rank ? `#${rank}` : `(${i + 1})`}</b> {e.name} · {localPhone(e.phone)} · consent {e.consent ? "✓" : "✗"}</p>
                <p>{e.orders} orders · {ksh(e.spend)} · {e.bottles} bottles</p>
              </div>
              {reward && <p className="text-xs font-semibold text-amber-700">Reward: {reward.label}{reward.voucherKsh ? ` (voucher ${ksh(reward.voucherKsh)})` : ""}</p>}
              {e.disqualified && <p className="text-xs text-red-600">Disqualified: {e.reason}</p>}
              {tb?.status !== "approved" && (
                <form action={topBuyersAction} className="mt-1 flex flex-wrap gap-1">
                  <input type="hidden" name="month" value={month} /><input type="hidden" name="customerId" value={e.customerId} />
                  {e.disqualified ? <button name="action" value="requalify" className="a-btn2">Re-qualify</button> : (
                    <>
                      <input name="reason" placeholder="Reason to disqualify" className="a-in w-48" />
                      <button name="action" value="disqualify" className="a-btn2 !text-red-600">Disqualify</button>
                    </>
                  )}
                </form>
              )}
            </div>
          );
        })}
      </div>

      <form action={saveLoyaltySettings} className="a-card grid grid-cols-2 gap-2 md:grid-cols-4">
        <h2 className="col-span-full font-black">Points & Top Buyers settings</h2>
        <N l="1 point per KSh" name="pointsPerKsh" v={s.pointsPerKsh} />
        <N l="KSh per point (redeem)" name="redeemKshPerPoint" v={s.redeemKshPerPoint} />
        <N l="Min points to redeem" name="minRedeemPoints" v={s.minRedeemPoints} />
        <N l="Max % of order" name="maxRedeemPct" v={s.maxRedeemPct} />
        <N l="Points expire after (months)" name="pointsExpiryMonths" v={s.pointsExpiryMonths} />
        <div><label className="a-lbl">Top Buyers measure</label><select name="measure" defaultValue={t.measure} className="a-in"><option value="spend">Total spend</option><option value="bottles">Bottles bought</option></select></div>
        <N l="Top N winners" name="topN" v={t.topN} />
        <N l="Min orders in month" name="minOrders" v={t.minOrders} />
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="allowStacking" defaultChecked={s.allowStacking} /> Allow stacking offers</label>
        {rw.map((r, i) => (
          <div key={i} className="col-span-full grid grid-cols-2 gap-2 md:grid-cols-[80px_80px_1fr_140px]">
            <N l={`Rank from`} name={`from${i + 1}`} v={r.from || ""} />
            <N l="to" name={`to${i + 1}`} v={r.to || ""} />
            <div><label className="a-lbl">Reward label</label><input name={`label${i + 1}`} defaultValue={r.label} className="a-in" /></div>
            <N l="Voucher KSh" name={`voucher${i + 1}`} v={r.voucherKsh || 0} />
          </div>
        ))}
        <button className="a-btn col-span-2 md:col-span-1">Save settings</button>
      </form>

      <div className="a-card space-y-2">
        <h2 className="font-black">Bottle-count & spend reward rules</h2>
        {rules.map((r) => <RuleForm key={r.id} r={r} />)}
        <RuleForm />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <form action={adjustPoints} className="a-card grid grid-cols-2 items-end gap-2">
          <h2 className="col-span-full font-black">Adjust points manually</h2>
          <div><label className="a-lbl">Customer phone</label><input name="phone" className="a-in" required /></div>
          <N l="Points (+/−)" name="points" v="" />
          <div className="col-span-2"><label className="a-lbl">Note</label><input name="note" className="a-in" /></div>
          <button className="a-btn">Apply</button>
        </form>
        <div className="a-card">
          <h2 className="mb-1 font-black">Recent vouchers</h2>
          {vs.map((v) => <p key={v.id} className="border-t border-slate-100 py-1 text-xs"><b>{v.code}</b> · {localPhone(v.phone)} · {v.label} · {v.redeemedAt ? "redeemed" : "open"}</p>)}
        </div>
      </div>
    </div>
  );
}

function N({ l, name, v }: { l: string; name: string; v: number | string }) {
  return <div><label className="a-lbl">{l}</label><input name={name} type="number" defaultValue={v} className="a-in" /></div>;
}

function RuleForm({ r }: { r?: typeof rewardRules.$inferSelect }) {
  return (
    <form action={saveRule} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1.3fr_110px_80px_80px_90px_110px_80px_1.5fr_auto_auto]">
      <input type="hidden" name="id" value={r?.id ?? ""} />
      <div><label className="a-lbl">{r ? "Rule" : "New rule"}</label><input name="name" defaultValue={r?.name} placeholder="10 x 750ml" className="a-in" /></div>
      <div><label className="a-lbl">Kind</label><select name="kind" defaultValue={r?.kind ?? "bottles"} className="a-in"><option value="bottles">Bottles</option><option value="spend_month">Spend/month</option></select></div>
      <N l="Target" name="threshold" v={r?.threshold ?? 10} />
      <N l="Size ml" name="sizeMl" v={r?.sizeMl ?? ""} />
      <div><label className="a-lbl">Spirit</label><input name="spirit" defaultValue={r?.spirit ?? ""} className="a-in" /></div>
      <div><label className="a-lbl">Reward</label><select name="rewardType" defaultValue={r?.rewardType ?? "cash"} className="a-in"><option value="cash">Cash voucher</option><option value="free_delivery">Free delivery</option></select></div>
      <N l="Value KSh" name="rewardValue" v={r?.rewardValue ?? 0} />
      <div><label className="a-lbl">Reward text</label><input name="rewardLabel" defaultValue={r?.rewardLabel} placeholder="Free 200ml" className="a-in" /></div>
      {r ? <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={r.active} /> on</label> : <span />}
      <button className="a-btn">{r ? "Save" : "Add"}</button>
    </form>
  );
}
