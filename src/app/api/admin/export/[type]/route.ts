import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(_req: Request, ctx: { params: Promise<{ type: string }> }) {
  const s = await getSession();
  if (!s || s.role !== "owner") return new Response("Unauthorized", { status: 401 });
  const { type } = await ctx.params;
  let rows: Record<string, unknown>[];
  if (type === "orders") {
    rows = (await db.execute(sql`select order_no, created_at, name, phone, fulfilment, zone_name, status, payment_status, payment_method, subtotal, discount, delivery_fee, total, bottles, points_earned, source, promo_code from orders order by created_at desc`)).rows;
  } else if (type === "customers") {
    rows = (await db.execute(sql`select c.name, c.phone, c.zone_name, c.tags, c.first_source, c.marketing_consent, c.opted_out, c.last_order_at, (select count(*) from orders o where o.customer_id=c.id and o.status='delivered') as orders, (select coalesce(sum(total),0) from orders o where o.customer_id=c.id and o.status='delivered') as spend, (select coalesce(sum(points),0) from points_ledger p where p.customer_id=c.id) as points from customers c order by c.created_at desc`)).rows;
  } else if (type === "stock") {
    rows = (await db.execute(sql`select name, spirit, flavour, size_ml, price_ksh, stock_qty, low_stock_at, stock_qty*price_ksh as stock_value from products order by sort_order`)).rows;
  } else return new Response("Unknown export", { status: 404 });
  const head = rows[0] ? Object.keys(rows[0]) : [];
  const csv = [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="jays-${type}.csv"` } });
}
