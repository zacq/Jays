import { db } from "@/db";
import { adminUsers, auditLogs, deliveryZones, riders } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { resetPassword, saveRider, saveShopSettings, saveZone } from "@/app/admin/actions";
import { getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/format";
import { darajaConfigured } from "@/lib/mpesa";

export default async function SettingsAdmin({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await requireRole(["owner"]);
  const sp = await searchParams;
  const [s, zones, rs, users, logs] = await Promise.all([
    getSettings(),
    db.select().from(deliveryZones).orderBy(asc(deliveryZones.sortOrder)),
    db.select().from(riders),
    db.select().from(adminUsers),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(25),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">Settings</h1>
      {sp.err && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{sp.err}</p>}

      <form action={saveShopSettings} className="a-card grid grid-cols-2 gap-2 md:grid-cols-4">
        <h2 className="col-span-full font-black">Delivery rules & shop details</h2>
        <T l="Delivery minimum (KSh)" name="minDelivery" v={s.minDelivery} type="number" />
        <T l="Delivery/order opens" name="deliveryOpen" v={s.deliveryOpen} type="time" />
        <T l="Delivery/order closes" name="deliveryClose" v={s.deliveryClose} type="time" />
        <T l="Pay-on-delivery cap (KSh)" name="podMaxKsh" v={s.podMaxKsh} type="number" />
        <T l="Shop name" name="name" v={s.shop.name} />
        <T l="Phone" name="phone" v={s.shop.phone} />
        <T l="WhatsApp (254…)" name="whatsapp" v={s.shop.whatsapp} />
        <T l="TikTok URL" name="tiktok" v={s.shop.tiktok} />
        <div className="col-span-2"><T l="Address" name="address" v={s.shop.address} /></div>
        <div className="col-span-2"><T l="Shop hours text" name="shopHoursText" v={s.shopHoursText} /></div>
        <div className="col-span-2 md:col-span-4"><T l="Liquor licence (shown on About page)" name="licence" v={s.shop.licence} /></div>
        <button className="a-btn">Save</button>
      </form>

      <div className="a-card space-y-2">
        <h2 className="font-black">Delivery zones & fees</h2>
        {[...zones, undefined].map((z, i) => (
          <form key={z?.id ?? "new"} action={saveZone} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[90px_1.6fr_90px_90px_60px_auto_auto_auto]">
            <input type="hidden" name="id" value={z?.id ?? ""} />
            <T l={z ? "Zone" : "New zone"} name="name" v={z?.name ?? ""} />
            <T l="Areas" name="areas" v={z?.areas ?? ""} />
            <T l="Fee KSh" name="feeKsh" v={z?.feeKsh ?? 0} type="number" />
            <T l="Minutes" name="targetMinutes" v={z?.targetMinutes ?? 30} type="number" />
            <T l="Order" name="sortOrder" v={z?.sortOrder ?? zones.length + 1 + i * 0} type="number" />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="podAllowed" defaultChecked={z?.podAllowed} /> POD</label>
            {z ? <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={z.active} /> live</label> : <span />}
            <button className="a-btn">{z ? "Save" : "Add"}</button>
          </form>
        ))}
      </div>

      <div className="a-card space-y-2">
        <h2 className="font-black">Riders</h2>
        {[...rs, undefined].map((r) => (
          <form key={r?.id ?? "new"} action={saveRider} className="grid grid-cols-2 items-end gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <input type="hidden" name="id" value={r?.id ?? ""} />
            <T l={r ? "Name" : "New rider"} name="name" v={r?.name ?? ""} />
            <T l="Phone" name="phone" v={r?.phone ?? ""} />
            <T l="Transport" name="transport" v={r?.transport ?? "Motorbike"} />
            {r ? <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={r.active} /> active</label> : <span />}
            <button className="a-btn">{r ? "Save" : "Add"}</button>
          </form>
        ))}
      </div>

      <div className="a-card space-y-2">
        <h2 className="font-black">Users & roles</h2>
        <p className="text-xs text-slate-500">Owner (all), Attendant (orders, stock, customers), Rider (assigned deliveries only). Change default passwords now.</p>
        {users.map((u) => (
          <form key={u.id} action={resetPassword} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="username" value={u.username} />
            <p className="w-48 text-sm"><b>{u.username}</b> <span className="text-slate-500">({u.role})</span></p>
            <input name="password" type="password" minLength={8} placeholder="New password (8+)" className="a-in w-56" required />
            <button className="a-btn2">Reset password</button>
          </form>
        ))}
      </div>

      <div className="a-card text-sm">
        <h2 className="mb-1 font-black">Integrations</h2>
        <p>M-Pesa Daraja: <b>{darajaConfigured() ? "configured (live STK Push)" : "not configured — demo mode"}</b>. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL (https://your-domain/api/mpesa/callback), optional MPESA_TILL, MPESA_ENV=production, MPESA_CALLBACK_TOKEN.</p>
        <p className="mt-1">SMS (Africa&apos;s Talking): <b>{process.env.AT_API_KEY ? "configured" : "not configured — messages are logged in Messages"}</b> (AT_API_KEY, AT_USERNAME). Analytics: NEXT_PUBLIC_GA_ID, NEXT_PUBLIC_TIKTOK_PIXEL_ID, NEXT_PUBLIC_META_PIXEL_ID. Cron: GET /api/cron/daily with CRON_SECRET.</p>
      </div>

      <div className="a-card">
        <h2 className="mb-1 font-black">Audit log</h2>
        {logs.map((l) => <p key={l.id} className="border-t border-slate-100 py-1 text-xs">{fmtDate(l.createdAt, true)} · <b>{l.userName}</b> · {l.action} · {l.entity} {l.entityId} {l.detail ? `· ${l.detail}` : ""}</p>)}
      </div>
    </div>
  );
}

function T({ l, name, v, type = "text" }: { l: string; name: string; v: string | number; type?: string }) {
  return <div><label className="a-lbl">{l}</label><input name={name} type={type} defaultValue={v} className="a-in" /></div>;
}
