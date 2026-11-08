"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BalanceCheck() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(d.error);
    setSent(true);
    setMsg(d.devCode ? `SMS isn't connected yet (demo mode). Your code is ${d.devCode}.` : "We sent a 6-digit code by SMS.");
  }
  async function verify() {
    setBusy(true);
    const r = await fetch("/api/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(d.error);
    localStorage.setItem("jays_points", String(d.balance));
    window.dispatchEvent(new Event("jays-points"));
    router.refresh();
  }

  return (
    <div className="card space-y-3 p-5">
      <h3 className="font-black">Check my balance</h3>
      <p className="text-xs text-mute">Enter your phone number and we&apos;ll SMS a one-time code.</p>
      <div className="flex gap-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" inputMode="tel" className="field" aria-label="Phone" />
        <button disabled={busy || phone.length < 9} className="btn-gold shrink-0" onClick={send}>{sent ? "Resend" : "Send code"}</button>
      </div>
      {sent && (
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" maxLength={6} className="field" aria-label="Code" />
          <button disabled={busy || code.length < 6} className="btn-ghost shrink-0" onClick={verify}>Verify</button>
        </div>
      )}
      {msg && <p className="text-sm text-gold">{msg}</p>}
    </div>
  );
}
