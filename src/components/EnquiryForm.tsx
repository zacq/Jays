"use client";

import { useState } from "react";

export default function EnquiryForm() {
  const [f, setF] = useState({ name: "", phone: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setErr("");
    const r = await fetch("/api/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    if (r.ok) setState("done");
    else {
      setErr((await r.json()).error ?? "Something went wrong");
      setState("idle");
    }
  }
  if (state === "done") return <p className="card p-5 text-mint">Thanks! We&apos;ll get back to you shortly.</p>;
  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <h2 className="font-black">Send us a message</h2>
      <input required className="field" placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input required className="field" placeholder="Phone" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <textarea required rows={4} className="field" placeholder="How can we help?" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <input className="hidden" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden />
      {err && <p className="text-sm text-hot">{err}</p>}
      <button className="btn-gold" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send enquiry"}</button>
    </form>
  );
}
