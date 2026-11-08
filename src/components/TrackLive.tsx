"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ksh } from "@/lib/format";

export default function TrackLive({
  orderNo,
  phone,
  unpaidMpesa,
  demo,
  total,
  initialStatus,
  initialPay,
  autoPay,
}: {
  orderNo: string;
  phone: string;
  unpaidMpesa: boolean;
  demo: boolean;
  total: number;
  initialStatus: string;
  initialPay: string;
  autoPay?: string;
}) {
  const router = useRouter();
  const last = useRef(`${initialStatus}|${initialPay}`);
  const [msg, setMsg] = useState<string | null>(autoPay === "stk" ? "We sent an M-Pesa prompt to your phone. Enter your PIN to complete payment." : autoPay === "demo" ? "M-Pesa demo mode: no Daraja keys are configured, so use the demo button to confirm payment." : autoPay === "failed" ? "We couldn't send the M-Pesa prompt. Resend it or pay to our Till." : null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch(`/api/track?o=${orderNo}&p=${phone}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { status: string; paymentStatus: string };
      const key = `${d.status}|${d.paymentStatus}`;
      if (key !== last.current) {
        last.current = key;
        router.refresh();
      }
    }, 5000);
    return () => clearInterval(t);
  }, [orderNo, phone, router]);

  async function act(action: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNo, phone, action, ...extra }) });
    const d = await r.json();
    setMsg(d.error || d.message);
    setBusy(false);
    if (r.ok && (action === "simulate" || action === "till")) router.refresh();
  }

  if (!unpaidMpesa) return null;
  return (
    <div className="card space-y-4 border-gold/40 p-5">
      <h3 className="font-black">Pay {ksh(total)} with M-Pesa</h3>
      {msg && <p className="rounded-lg bg-panel2 p-3 text-sm">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className="btn-gold" onClick={() => act("stk")}>Send M-Pesa prompt to {phone}</button>
        {demo && (
          <button disabled={busy} className="btn-ghost" onClick={() => act("simulate")}>
            Demo: simulate M-Pesa confirmation
          </button>
        )}
      </div>
      <div>
        <p className="label">Prefer to pay to our Till? Enter the M-Pesa code from your SMS</p>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={10} placeholder="e.g. SHK4X7Y2ZA" className="field uppercase" />
          <button disabled={busy || code.length < 10} className="btn-ghost" onClick={() => act("till", { code })}>Submit</button>
        </div>
        <p className="mt-1 text-xs text-mute">Payment confirms automatically after M-Pesa replies. Till codes are verified by our team.</p>
      </div>
    </div>
  );
}
