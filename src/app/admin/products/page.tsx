import { db } from "@/db";
import { auditLogs, products } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { createProduct, saveProduct } from "@/app/admin/actions";
import { fmtDate, toLocalInput } from "@/lib/format";

export default async function ProductsAdmin() {
  await requireRole(["owner"]);
  const [prods, logs] = await Promise.all([
    db.select().from(products).orderBy(asc(products.sortOrder)),
    db.select().from(auditLogs).where(eq(auditLogs.action, "price_change")).orderBy(desc(auditLogs.createdAt)).limit(10),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">Products & prices</h1>
      <p className="text-xs text-slate-500">Dummy prices from the PRD — update to the real supplier price list. Every price change is logged.</p>
      <div className="space-y-2">
        {prods.map((p) => (
          <form key={p.id} action={saveProduct} className="a-card grid grid-cols-2 items-end gap-2 !p-3 md:grid-cols-6 lg:grid-cols-[1.4fr_repeat(7,minmax(0,1fr))_auto]">
            <input type="hidden" name="id" value={p.id} />
            <div className="col-span-2 md:col-span-6 lg:col-span-1"><p className="font-bold">{p.name}</p><p className="text-xs text-slate-400">{p.slug}</p></div>
            <div><label className="a-lbl">Price KSh</label><input name="priceKsh" type="number" defaultValue={p.priceKsh} className="a-in" /></div>
            <div><label className="a-lbl">Offer price</label><input name="offerPriceKsh" type="number" defaultValue={p.offerPriceKsh ?? ""} className="a-in" /></div>
            <div><label className="a-lbl">Offer ends</label><input name="offerEnd" type="datetime-local" defaultValue={toLocalInput(p.offerEnd)} className="a-in" /></div>
            <div><label className="a-lbl">Low-stock at</label><input name="lowStockAt" type="number" defaultValue={p.lowStockAt} className="a-in" /></div>
            <div><label className="a-lbl">Points ×</label><input name="pointsMultiplier" type="number" min={1} defaultValue={p.pointsMultiplier} className="a-in" /></div>
            <div><label className="a-lbl">ABV</label><input name="abv" defaultValue={p.abv ?? ""} className="a-in" /></div>
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" name="featured" defaultChecked={p.featured} /> Featured</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={p.active} /> Live</label>
            </div>
            <input type="hidden" name="brand" value={p.brand ?? ""} />
            <button className="a-btn">Save</button>
          </form>
        ))}
      </div>
      <form action={createProduct} className="a-card grid grid-cols-2 items-end gap-2 md:grid-cols-6">
        <h2 className="col-span-full font-black">Add a product</h2>
        <div><label className="a-lbl">Spirit</label><input name="spirit" required className="a-in" placeholder="Vodka" /></div>
        <div><label className="a-lbl">Flavour</label><input name="flavour" required className="a-in" placeholder="Honey" /></div>
        <div><label className="a-lbl">Size ml</label><input name="sizeMl" type="number" required className="a-in" /></div>
        <div><label className="a-lbl">Price KSh</label><input name="priceKsh" type="number" required className="a-in" /></div>
        <div><label className="a-lbl">Stock</label><input name="stockQty" type="number" defaultValue={0} className="a-in" /></div>
        <button className="a-btn">Add</button>
      </form>
      <div className="a-card">
        <h2 className="mb-1 font-black">Recent price changes</h2>
        {logs.length === 0 && <p className="text-sm text-slate-500">None yet.</p>}
        {logs.map((l) => (
          <p key={l.id} className="border-t border-slate-100 py-1 text-xs">{l.detail} · {l.userName} · {fmtDate(l.createdAt, true)}</p>
        ))}
      </div>
    </div>
  );
}
