import type { Metadata } from "next";
import { db } from "@/db";
import { rewardRules, topBuyersMonths } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import BalanceCheck from "@/components/BalanceCheck";
import { getSettings } from "@/lib/settings";
import { getBalance, getCustomerByPhone, publicTopList, recentVouchers, rewardFor, rewardProgress, winnersOf, type TopEntry } from "@/lib/loyalty";
import { verifiedPhone } from "@/lib/source";
import { ksh, localPhone, firstNameInitial, monthKey } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";

export const metadata: Metadata = { title: "Rewards & Top Buyers" };

export default async function RewardsPage() {
  await ensureSeed();
  const [s, rules, top, past, vp] = await Promise.all([
    getSettings(),
    db.select().from(rewardRules).where(eq(rewardRules.active, true)),
    publicTopList(),
    db.select().from(topBuyersMonths).where(eq(topBuyersMonths.status, "approved")).orderBy(desc(topBuyersMonths.month)).limit(6),
    verifiedPhone(),
  ]);
  const customer = vp ? await getCustomerByPhone(vp) : null;
  const balance = customer ? await getBalance(customer.id) : 0;
  const progress = customer ? await rewardProgress(customer.id) : [];
  const vouchers = customer ? (await recentVouchers(customer.id)).filter((v) => !v.redeemedAt) : [];
  const tb = s.topBuyers;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h1 !text-3xl sm:!text-4xl">Rewards</h1>
        <p className="mt-1 text-sm text-mute">Every order earns points. Buy more bottles, unlock more rewards, and climb the monthly Top Buyers list.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 p-5 text-sm">
          <h2 className="h2">★ How points work</h2>
          <ul className="list-disc space-y-1 pl-5 text-mute">
            <li>Earn <b className="text-white">1 point per {ksh(s.pointsPerKsh)}</b> spent on drinks (delivery fees excluded).</li>
            <li>Points are credited when your order is delivered or picked up.</li>
            <li>Redeem at checkout: <b className="text-white">{s.minRedeemPoints} points = {ksh(s.minRedeemPoints * s.redeemKshPerPoint)} off</b>, minimum {s.minRedeemPoints} points, up to {s.maxRedeemPct}% of the order.</li>
            <li>Some products and campaigns earn double or triple points.</li>
            <li>Points expire after {s.pointsExpiryMonths} months without an order (we warn you 14 days before).</li>
          </ul>
        </div>
        <div className="card space-y-2 p-5 text-sm">
          <h2 className="h2">🍾 Bottle rewards</h2>
          <ul className="space-y-2 text-mute">
            {rules.map((r) => (
              <li key={r.id} className="rounded-lg bg-panel2 p-2">
                <b className="text-white">{r.name}</b>
                <br />→ {r.rewardLabel}
              </li>
            ))}
          </ul>
          <p className="text-xs text-mute">Unlocked rewards arrive as a voucher code by SMS/WhatsApp and apply at checkout.</p>
        </div>
      </div>

      {customer ? (
        <div className="card space-y-4 border-gold/40 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="h2">Hi {customer.name?.split(" ")[0] ?? "there"} 👋</h2>
            <p className="text-sm text-mute">{localPhone(customer.phone)}</p>
          </div>
          <p className="text-4xl font-black text-gold">{balance} <span className="text-base text-mute">points = {ksh(balance * s.redeemKshPerPoint)}</span></p>
          {progress.map((p) => (
            <div key={p.rule.id}>
              <p className="text-sm font-semibold">{p.rule.name}: {p.count} of {p.target} {p.unit}</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-mint" style={{ width: `${(p.count / p.target) * 100}%` }} />
              </div>
            </div>
          ))}
          {vouchers.length > 0 && (
            <div>
              <p className="label">Your vouchers</p>
              {vouchers.map((v) => (
                <p key={v.id} className="text-sm"><b className="text-gold">{v.code}</b> · {v.label}</p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <BalanceCheck />
      )}

      <section className="space-y-4">
        <h2 className="h2">🏆 Monthly Top Buyers</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card space-y-2 p-5 text-sm text-mute">
            <p><b className="text-white">Not a lottery.</b> Each month we rank customers by {tb.measure === "spend" ? "total spend" : "bottles bought"} (paid and delivered orders only; refunds excluded). Top {tb.topN} are rewarded after the owner approves the list.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>You need at least {tb.minOrders} orders in the month.</li>
              <li>Ties: more orders wins, then the earliest qualifying order.</li>
              {tb.rewards.map((r) => (
                <li key={r.from}>{r.from === r.to ? `#${r.from}` : `#${r.from}–${r.to}`}: {r.label}</li>
              ))}
              <li>Your name only shows if you tick the consent box at checkout.</li>
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="mb-2 font-black">This month so far ({monthKey()})</h3>
            {top.length === 0 ? (
              <p className="text-sm text-mute">No delivered orders yet this month. Be the first on the board!</p>
            ) : (
              <ol className="space-y-1.5 text-sm">
                {top.map((t) => (
                  <li key={t.rank} className="flex justify-between rounded-lg bg-panel2 px-3 py-2">
                    <span><b className="text-gold">#{t.rank}</b> {t.label}</span>
                    <span className="text-mute">{tb.measure === "spend" ? ksh(t.spend) : `${t.bottles} bottles`} · {t.orders} orders</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        {past.length > 0 && (
          <div className="card p-5">
            <h3 className="mb-2 font-black">Past winners</h3>
            {past.map((m) => {
              const w = winnersOf(m.entries as TopEntry[], m.topN);
              return (
                <div key={m.id} className="mb-2 text-sm">
                  <b className="text-gold">{m.month}</b>:{" "}
                  {w.map((x) => `#${x.rank} ${x.consent ? firstNameInitial(x.name) : "Jay's customer"}${rewardFor(x.rank, tb.rewards) ? ` (${rewardFor(x.rank, tb.rewards)!.label})` : ""}`).join(" · ")}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
