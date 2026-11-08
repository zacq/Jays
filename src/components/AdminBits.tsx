"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function PrintButton() {
  return (
    <button className="a-btn2 no-print" onClick={() => window.print()}>
      🖨️ Print packing slip
    </button>
  );
}

/** Polls for new orders, beeps and refreshes the list (owner/attendant alert). */
export function OrderFeed({ initial }: { initial: number }) {
  const router = useRouter();
  const last = useRef(initial);
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/admin/feed", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { latest: number };
        if (d.latest > last.current) {
          last.current = d.latest;
          try {
            const ctx = new AudioContext();
            const o = ctx.createOscillator();
            o.connect(ctx.destination);
            o.frequency.value = 880;
            o.start();
            setTimeout(() => o.stop(), 400);
          } catch {
            /* autoplay blocked */
          }
          router.refresh();
        }
      } catch {
        /* offline */
      }
    }, 10000);
    return () => clearInterval(t);
  }, [router]);
  return <span className="no-print text-xs text-slate-400">● live – new orders beep</span>;
}
