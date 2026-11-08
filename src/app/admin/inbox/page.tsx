import { db } from "@/db";
import { enquiries, messages } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { fmtDate, localPhone, waLink } from "@/lib/format";

export default async function Inbox() {
  await requireRole(["owner", "attendant"]);
  const [enq, msgs] = await Promise.all([db.select().from(enquiries).orderBy(desc(enquiries.createdAt)).limit(30), db.select().from(messages).orderBy(desc(messages.createdAt)).limit(60)]);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="a-card">
        <h1 className="mb-2 text-lg font-black">Enquiries</h1>
        {enq.length === 0 && <p className="text-sm text-slate-500">None yet.</p>}
        {enq.map((e) => (
          <div key={e.id} className="border-t border-slate-100 py-2 text-sm">
            <p><b>{e.name}</b> · {e.phone} · <span className="text-xs text-slate-500">{fmtDate(e.createdAt, true)}</span></p>
            <p>{e.message}</p>
          </div>
        ))}
      </div>
      <div className="a-card">
        <h2 className="mb-1 text-lg font-black">Outbound messages</h2>
        <p className="mb-2 text-xs text-slate-500">Every order, payment, rider and reward message is logged here. If SMS isn&apos;t connected, tap “Send via WhatsApp” to forward it manually.</p>
        {msgs.map((m) => (
          <div key={m.id} className="border-t border-slate-100 py-1.5 text-xs">
            <p><b>{m.kind}</b> → {localPhone(m.phone)} · {m.status} · {fmtDate(m.createdAt, true)}</p>
            <p className="text-slate-600">{m.body}</p>
            {m.status === "logged" && /^254\d{9}$/.test(m.phone) && <a className="font-semibold text-green-700 underline" href={waLink(m.phone, m.body)} target="_blank" rel="noreferrer">Send via WhatsApp</a>}
          </div>
        ))}
      </div>
    </div>
  );
}
