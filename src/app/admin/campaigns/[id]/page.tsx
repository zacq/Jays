import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { campaigns, qrCodes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { createQr, saveCampaign } from "@/app/admin/actions";
import { ksh, toLocalInput } from "@/lib/format";

type QStat = { id: number; scans: number; uniq: number; orders: number; revenue: number; new_orders: number };

export default async function CampaignEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(["owner"]);
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const [c] = isNew ? [undefined] : await db.select().from(campaigns).where(eq(campaigns.id, Number(id)));
  if (!isNew && !c) notFound();
  const qrs = c ? await db.select().from(qrCodes).where(eq(qrCodes.campaignId, c.id)) : [];
  const res = c
    ? await db.execute(sql`
      select q.id,
        (select count(*)::int from qr_scans s where s.qr_id=q.id) as scans,
        (select count(distinct visitor_id)::int from qr_scans s where s.qr_id=q.id) as uniq,
        (select count(*)::int from orders o where o.qr_code_id=q.id and o.status not in ('cancelled','refunded')) as orders,
        (select coalesce(sum(total),0)::int from orders o where o.qr_code_id=q.id and o.status not in ('cancelled','refunded')) as revenue,
        (select count(*)::int from orders o where o.qr_code_id=q.id and o.is_new_customer) as new_orders
      from qr_codes q where q.campaign_id=${c.id}`)
    : { rows: [] };
  const st = new Map((res.rows as unknown as QStat[]).map((r) => [r.id, r]));
  const now = Date.now();
  const defStart = sp.start || toLocalInput(new Date(now));
  const defEnd = sp.end || toLocalInput(new Date(now + 14 * 86400000));

  return (
    <div className="space-y-4">
      <Link href="/admin/campaigns" className="text-sm font-semibold underline">← Campaigns</Link>
      <h1 className="text-xl font-black">{c ? c.name : "New campaign"}</h1>
      {sp.err && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{sp.err}</p>}
      <form action={saveCampaign} className="a-card grid grid-cols-2 gap-3 md:grid-cols-4">
        <input type="hidden" name="id" value={c?.id ?? "new"} />
        <F l="Name" span={2}><input name="name" required defaultValue={c?.name ?? sp.name ?? ""} className="a-in" /></F>
        <F l="Link slug (/c/…)"><input name="slug" defaultValue={c?.slug ?? ""} placeholder="auto from name" className="a-in" /></F>
        <F l="Type"><select name="type" defaultValue={c?.type ?? "Holiday"} className="a-in">{["Holiday", "Partnership", "Product focus", "Event", "TikTok creator"].map((t) => <option key={t}>{t}</option>)}</select></F>
        <F l="Starts"><input name="startsAt" type="datetime-local" required defaultValue={c ? toLocalInput(c.startsAt) : defStart} className="a-in" /></F>
        <F l="Ends (auto off)"><input name="endsAt" type="datetime-local" required defaultValue={c ? toLocalInput(c.endsAt) : defEnd} className="a-in" /></F>
        <F l="Offer"><select name="offerType" defaultValue={c?.offerType ?? "percent"} className="a-in"><option value="percent">% off</option><option value="fixed">KSh off</option><option value="free_delivery">Free delivery</option><option value="points">Points multiplier (2 = double)</option></select></F>
        <F l="Offer value"><input name="offerValue" type="number" defaultValue={c?.offerValue ?? 10} className="a-in" /></F>
        <F l="Applies to"><select name="appliesTo" defaultValue={c?.appliesTo ?? "all"} className="a-in"><option value="all">All products</option><option value="spirit">A spirit</option><option value="flavour">A flavour</option><option value="size">A size</option></select></F>
        <F l="…which one (e.g. Whisky / Honey / 750)"><input name="appliesValue" defaultValue={c?.appliesValue ?? ""} className="a-in" /></F>
        <F l="Minimum spend KSh"><input name="minSpend" type="number" defaultValue={c?.minSpend ?? 0} className="a-in" /></F>
        <F l="Uses per phone (0 = ∞)"><input name="usageLimitPerPhone" type="number" defaultValue={c?.usageLimitPerPhone ?? 0} className="a-in" /></F>
        <F l="Free Zone 1–2 delivery above KSh"><input name="freeDeliveryAbove" type="number" defaultValue={c?.freeDeliveryAbove ?? ""} className="a-in" /></F>
        <F l="Promo code (optional)"><input name="promoCode" defaultValue={c?.promoCode ?? ""} className="a-in uppercase" /></F>
        <F l="Partner name"><input name="partner" defaultValue={c?.partner ?? ""} className="a-in" /></F>
        <F l="Banner colour"><select name="bannerColor" defaultValue={c?.bannerColor ?? "amber"} className="a-in"><option value="amber">Gold</option><option value="rose">Rose</option><option value="green">Green</option></select></F>
        <F l="Headline" span={2}><input name="headline" defaultValue={c?.headline ?? ""} className="a-in" /></F>
        <F l="Banner tag" span={2}><input name="bannerText" defaultValue={c?.bannerText ?? ""} className="a-in" /></F>
        <F l="Featured product IDs (comma, optional)" span={2}><input name="featuredProductIds" defaultValue={c?.featuredProductIds ?? ""} className="a-in" /></F>
        <F l="Terms" span={4}><textarea name="terms" rows={3} defaultValue={c?.terms ?? ""} className="a-in" /></F>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> Enabled</label>
        <button className="a-btn md:col-span-2">Save campaign</button>
      </form>

      {c && (
        <div className="a-card space-y-3">
          <h2 className="font-black">QR codes</h2>
          <p className="text-xs text-slate-500">Each QR opens <code>/q/&lt;code&gt;</code>, tags the visit and order with this campaign and applies the offer. After the end date the QR opens the current offer, so printed codes never go dead. Make one per venue/partner to compare locations.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {qrs.map((q) => {
              const s = st.get(q.id);
              return (
                <div key={q.id} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/admin/qr/${q.id}?format=png&w=240`} alt={`QR ${q.label}`} width={110} height={110} className="h-28 w-28 shrink-0" />
                  <div className="min-w-0 text-sm">
                    <p className="font-bold">{q.label}</p>
                    <p className="truncate text-xs text-slate-500">/q/{q.code}</p>
                    <p className="mt-1 text-xs">{s?.scans ?? 0} scans · {s?.uniq ?? 0} unique · {s?.orders ?? 0} orders · {ksh(s?.revenue ?? 0)} · AOV {ksh(s?.orders ? s.revenue / s.orders : 0)}</p>
                    <p className="text-xs text-slate-500">new {s?.new_orders ?? 0} / returning {(s?.orders ?? 0) - (s?.new_orders ?? 0)}</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-xs font-semibold">
                      <a className="a-btn2 !px-2 !py-1" href={`/api/admin/qr/${q.id}?format=png&w=1000&download=1`}>PNG</a>
                      <a className="a-btn2 !px-2 !py-1" href={`/api/admin/qr/${q.id}?format=pdf&size=a6`}>A6 card</a>
                      <a className="a-btn2 !px-2 !py-1" href={`/api/admin/qr/${q.id}?format=pdf&size=a4`}>A4 poster</a>
                      <a className="a-btn2 !px-2 !py-1" href={`/api/admin/qr/${q.id}?format=pdf&size=stickers`}>Stickers</a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <form action={createQr} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="campaignId" value={c.id} />
            <F l="New QR label (venue / partner)"><input name="label" required placeholder="e.g. Club Zero table cards" className="a-in" /></F>
            <button className="a-btn">Add QR</button>
          </form>
        </div>
      )}
    </div>
  );
}

function F({ l, span, children }: { l: string; span?: number; children: React.ReactNode }) {
  return (
    <div className={span === 4 ? "col-span-2 md:col-span-4" : span === 2 ? "col-span-2" : ""}>
      <label className="a-lbl">{l}</label>
      {children}
    </div>
  );
}
