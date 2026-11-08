import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { stockAction } from "@/app/admin/actions";
import { fmtDate } from "@/lib/format";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ err?: string; q?: string }> }) {
  await requireRole(["owner", "attendant"]);
  const sp = await searchParams;
  const [prods, moves] = await Promise.all([
    db.select().from(products).orderBy(asc(products.sortOrder)),
    db.select({ m: stockMovements, name: products.name }).from(stockMovements).innerJoin(products, eq(products.id, stockMovements.productId)).orderBy(desc(stockMovements.createdAt)).limit(25),
  ]);
  const q = sp.q?.toLowerCase();
  const list = prods.filter((p) => !q || p.name.toLowerCase().includes(q));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">Stock</h1>
      {sp.err && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{sp.err}</p>}
      <form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Search product…" className="a-in max-w-xs" /><button className="a-btn2">Search</button></form>
      <p className="text-xs text-slate-500">Stock deducts automatically when an order is paid, and the shop shows “Sold out” at 0. Use <b>Count</b> to set the exact shelf quantity during the weekly count.</p>
      <div className="a-card overflow-x-auto !p-0">
        <table className="w-full min-w-[640px]">
          <thead className="border-b bg-slate-50"><tr><th className="a-th">Product</th><th className="a-th">Qty</th><th className="a-th">Update</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="a-td font-semibold">{p.name}{!p.active && <span className="ml-1 text-xs text-slate-400">(hidden)</span>}</td>
                <td className="a-td"><b className={p.stockQty === 0 ? "text-red-600" : p.stockQty <= p.lowStockAt ? "text-amber-600" : ""}>{p.stockQty}</b><span className="text-xs text-slate-400"> / alert {p.lowStockAt}</span></td>
                <td className="a-td">
                  <form action={stockAction} className="flex flex-wrap gap-1">
                    <input type="hidden" name="productId" value={p.id} />
                    <select name="type" className="a-in w-auto"><option value="stock_in">Stock in (+)</option><option value="adjustment">Adjust (± reason)</option><option value="count">Count (set to)</option></select>
                    <input name="qty" type="number" required className="a-in w-20" placeholder="Qty" />
                    <input name="reason" className="a-in w-40" placeholder="Reason / supplier" />
                    <button className="a-btn">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="a-card">
        <h2 className="mb-1 font-black">Recent stock movements (audit)</h2>
        {moves.map(({ m, name }) => (
          <p key={m.id} className="border-t border-slate-100 py-1 text-xs"><b>{name}</b> {m.delta > 0 ? "+" : ""}{m.delta} · {m.type} · {m.reason} · {m.userName} · {fmtDate(m.createdAt, true)}</p>
        ))}
      </div>
    </div>
  );
}
