import { db } from "@/db";
import {
  customers,
  messages,
  orders,
  pointsLedger,
  rewardRules,
  topBuyersMonths,
  vouchers,
  orders as ordersT,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getSettings, type TopBuyerReward } from "@/lib/settings";
import { monthKey, monthRange, nairobiParts, prevMonthKey, localPhone, ksh, firstNameInitial } from "@/lib/format";
import { notify } from "@/lib/notify";

export async function getBalance(customerId: number) {
  const [r] = await db
    .select({ s: sql<number>`coalesce(sum(${pointsLedger.points}),0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.customerId, customerId));
  return r.s;
}

export async function getCustomerByPhone(phone: string) {
  const [c] = await db.select().from(customers).where(eq(customers.phone, phone));
  return c ?? null;
}

export function genVoucherCode(prefix = "JV") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

export async function issueVoucher(customerId: number, phone: string, v: { type: "cash" | "free_delivery"; valueKsh: number; label: string; ruleId?: number | null; note?: string }) {
  for (let i = 0; i < 5; i++) {
    try {
      const code = genVoucherCode();
      await db
        .insert(vouchers)
        .values({ code, customerId, phone, type: v.type, valueKsh: v.valueKsh, label: v.label, ruleId: v.ruleId ?? null, note: v.note });
      await notify(phone, `Jay's: you unlocked a reward – ${v.label}. Voucher code ${code}. Apply it at checkout.`, "voucher", { marketing: true });
      return code;
    } catch {
      /* retry */
    }
  }
  return null;
}

/** Counts bottles from delivered orders, optionally filtered by size/spirit. */
async function bottleCount(customerId: number, rule: { sizeMl: number | null; spirit: string | null }) {
  const cond = [sql`o.customer_id = ${customerId}`, sql`o.status = 'delivered'`];
  if (rule.sizeMl) cond.push(sql`i.size_ml = ${rule.sizeMl}`);
  if (rule.spirit) cond.push(sql`i.spirit = ${rule.spirit}`);
  const res = await db.execute(
    sql`select coalesce(sum(i.qty),0)::int as n from order_items i join orders o on o.id = i.order_id where ${sql.join(cond, sql` and `)}`,
  );
  return (res.rows[0] as { n: number }).n;
}

async function monthSpend(customerId: number, key: string) {
  const { start, end } = monthRange(key);
  const [r] = await db
    .select({ s: sql<number>`coalesce(sum(${orders.subtotal} - ${orders.discount}),0)::int` })
    .from(orders)
    .where(and(eq(orders.customerId, customerId), eq(orders.status, "delivered"), gte(orders.deliveredAt, start), lt(orders.deliveredAt, end)));
  return r.s;
}

export async function rewardProgress(customerId: number) {
  const rules = await db.select().from(rewardRules).where(eq(rewardRules.active, true));
  const out: { rule: typeof rules[number]; count: number; target: number; unit: string }[] = [];
  for (const rule of rules) {
    if (rule.kind === "bottles") {
      const n = await bottleCount(customerId, rule);
      out.push({ rule, count: n % rule.threshold, target: rule.threshold, unit: "bottles" });
    } else {
      out.push({ rule, count: Math.min(await monthSpend(customerId, monthKey()), rule.threshold), target: rule.threshold, unit: "KSh this month" });
    }
  }
  return out;
}

export async function evaluateRewards(customerId: number, phone: string) {
  const rules = await db.select().from(rewardRules).where(eq(rewardRules.active, true));
  const unlocked: string[] = [];
  for (const rule of rules) {
    const issued = await db.select({ id: vouchers.id, note: vouchers.note }).from(vouchers).where(and(eq(vouchers.customerId, customerId), eq(vouchers.ruleId, rule.id)));
    if (rule.kind === "bottles") {
      const n = await bottleCount(customerId, rule);
      if (Math.floor(n / rule.threshold) > issued.length) {
        await issueVoucher(customerId, phone, { type: rule.rewardType as "cash" | "free_delivery", valueKsh: rule.rewardValue, label: rule.rewardLabel, ruleId: rule.id });
        unlocked.push(rule.rewardLabel);
      }
    } else {
      const key = monthKey();
      if (issued.some((v) => v.note === key)) continue;
      if ((await monthSpend(customerId, key)) >= rule.threshold) {
        await issueVoucher(customerId, phone, { type: rule.rewardType as "cash" | "free_delivery", valueKsh: rule.rewardValue, label: rule.rewardLabel, ruleId: rule.id, note: key });
        unlocked.push(rule.rewardLabel);
      }
    }
  }
  return unlocked;
}

/* ---------- Top Buyers ---------- */

export type TopEntry = {
  customerId: number;
  name: string;
  phone: string;
  consent: boolean;
  orders: number;
  spend: number;
  bottles: number;
  firstOrderAt: string;
  disqualified: boolean;
  reason: string;
};

export async function rankMonth(key: string, measure: "spend" | "bottles", minOrders: number): Promise<TopEntry[]> {
  const { start, end } = monthRange(key);
  const rows = await db
    .select({
      o: orders,
      name: customers.name,
      consent: customers.topBuyerConsent,
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(and(eq(orders.status, "delivered"), gte(orders.deliveredAt, start), lt(orders.deliveredAt, end)));
  const map = new Map<number, TopEntry>();
  for (const r of rows) {
    const e = map.get(r.o.customerId) ?? {
      customerId: r.o.customerId,
      name: r.name || r.o.name,
      phone: r.o.phone,
      consent: r.consent,
      orders: 0,
      spend: 0,
      bottles: 0,
      firstOrderAt: (r.o.createdAt ?? new Date()).toISOString(),
      disqualified: false,
      reason: "",
    };
    e.orders += 1;
    e.spend += r.o.total - r.o.deliveryFee;
    e.bottles += r.o.bottles;
    if (r.o.createdAt.toISOString() < e.firstOrderAt) e.firstOrderAt = r.o.createdAt.toISOString();
    map.set(r.o.customerId, e);
  }
  const key2 = measure === "spend" ? "spend" : "bottles";
  return [...map.values()]
    .filter((e) => e.orders >= minOrders)
    .sort((a, b) => b[key2] - a[key2] || b.orders - a.orders || a.firstOrderAt.localeCompare(b.firstOrderAt))
    .slice(0, 30);
}

export async function proposeMonth(key: string, force = false) {
  const s = await getSettings();
  const existing = await db.select().from(topBuyersMonths).where(eq(topBuyersMonths.month, key));
  if (existing[0] && (existing[0].status === "approved" || !force)) return existing[0];
  const entries = await rankMonth(key, s.topBuyers.measure, s.topBuyers.minOrders);
  const vals = { month: key, measure: s.topBuyers.measure, topN: s.topBuyers.topN, entries, status: "proposed" };
  const [row] = await db.insert(topBuyersMonths).values(vals).onConflictDoUpdate({ target: topBuyersMonths.month, set: vals }).returning();
  return row;
}

export const rewardFor = (rank: number, rewards: TopBuyerReward[]) => rewards.find((r) => rank >= r.from && rank <= r.to) ?? null;

export function winnersOf(entries: TopEntry[], topN: number) {
  return entries.filter((e) => !e.disqualified).slice(0, topN).map((e, i) => ({ ...e, rank: i + 1 }));
}

export async function approveMonth(key: string) {
  const s = await getSettings();
  const [row] = await db.select().from(topBuyersMonths).where(eq(topBuyersMonths.month, key));
  if (!row || row.status === "approved") return;
  const winners = winnersOf(row.entries as TopEntry[], row.topN);
  for (const w of winners) {
    const rw = rewardFor(w.rank, s.topBuyers.rewards);
    if (!rw) continue;
    if (rw.voucherKsh > 0) {
      await issueVoucher(w.customerId, w.phone, { type: "cash", valueKsh: rw.voucherKsh, label: `Top Buyer #${w.rank} (${key}): ${rw.label}`, note: `topbuyers-${key}` });
    } else {
      await notify(w.phone, `Jay's: congratulations! You are Top Buyer #${w.rank} for ${key}. Reward: ${rw.label}.`, "top_buyers", { marketing: true });
    }
  }
  await db.update(topBuyersMonths).set({ status: "approved", approvedAt: new Date() }).where(eq(topBuyersMonths.id, row.id));
}

/** Live current-month ranking for the public page: only customers who consented, first names/initials. */
export async function publicTopList() {
  const s = await getSettings();
  const list = await rankMonth(monthKey(), s.topBuyers.measure, 1);
  return list.slice(0, s.topBuyers.topN + 2).map((e, i) => ({ rank: i + 1, label: e.consent ? firstNameInitial(e.name) : "Jay's customer", orders: e.orders, spend: e.spend, bottles: e.bottles }));
}

/* ---------- Scheduled jobs ---------- */

export async function expirePoints() {
  const s = await getSettings();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - s.pointsExpiryMonths);
  const warnFrom = new Date(cutoff.getTime() + 14 * 86400000);
  const stale = await db.select().from(customers).where(lt(customers.lastOrderAt, warnFrom));
  let expired = 0;
  let warned = 0;
  for (const c of stale) {
    const bal = await getBalance(c.id);
    if (bal <= 0 || !c.lastOrderAt) continue;
    if (c.lastOrderAt < cutoff) {
      await db.insert(pointsLedger).values({ customerId: c.id, points: -bal, type: "expire", note: `No orders in ${s.pointsExpiryMonths} months` });
      expired++;
    } else {
      const recent = await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.phone, c.phone), eq(messages.kind, "points_expiry"), gte(messages.createdAt, new Date(Date.now() - 14 * 86400000))));
      if (!recent.length) {
        await notify(c.phone, `Jay's: your ${bal} points expire within 14 days. Order any time to keep them.`, "points_expiry", { marketing: true });
        warned++;
      }
    }
  }
  return { expired, warned };
}

export async function sendPaymentReminders() {
  const cutoff = new Date(Date.now() - 15 * 60000);
  const rows = await db
    .select()
    .from(ordersT)
    .where(and(eq(ordersT.paymentMethod, "mpesa"), eq(ordersT.paymentStatus, "unpaid"), eq(ordersT.reminderSent, false), eq(ordersT.status, "received"), lt(ordersT.createdAt, cutoff)));
  for (const o of rows) {
    await notify(o.phone, `Jay's: your order ${o.orderNo} (${ksh(o.total)}) is not paid yet. Track and pay at ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track?o=${o.orderNo}&p=${localPhone(o.phone)}`, "payment_reminder");
    await db.update(ordersT).set({ reminderSent: true }).where(eq(ordersT.id, o.id));
  }
  return rows.length;
}

export async function runJobs() {
  const reminders = await sendPaymentReminders();
  const exp = await expirePoints();
  let proposed = false;
  const p = nairobiParts();
  const prev = prevMonthKey();
  const have = await db.select().from(topBuyersMonths).where(eq(topBuyersMonths.month, prev));
  if (!have[0] && p.day >= 1) {
    await proposeMonth(prev);
    proposed = true;
  }
  return { reminders, ...exp, proposedTopBuyers: proposed ? prev : null };
}

let lastRun = 0;
export async function maybeRunJobs() {
  if (Date.now() - lastRun < 10 * 60000) return;
  lastRun = Date.now();
  try {
    await runJobs();
  } catch (e) {
    console.error("jobs failed", e);
  }
}

export async function recentVouchers(customerId: number) {
  return db.select().from(vouchers).where(eq(vouchers.customerId, customerId)).orderBy(desc(vouchers.createdAt)).limit(10);
}

export { inArray };
