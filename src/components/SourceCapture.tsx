"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";

type Src = { c?: string; q?: string; u?: string; p?: string };

function readCookie(): Src {
  const m = document.cookie.match(/(?:^|; )jays_src=([^;]*)/);
  if (!m) return {};
  for (const v of [m[1], safe(m[1])]) {
    try {
      return JSON.parse(v);
    } catch {
      /* next */
    }
  }
  return {};
}
const safe = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Captures campaign / promo / UTM source on arrival (FR-5) so it can be stored on the order. */
export default function SourceCapture({ campaign }: { campaign?: string }) {
  const sp = useSearchParams();
  const utm = sp.get("utm_source");
  const promo = sp.get("promo") || sp.get("code");

  useEffect(() => {
    const cur = readCookie();
    const next: Src = { ...cur };
    let changed = false;
    if (campaign && cur.c !== campaign) {
      next.c = campaign;
      delete next.q;
      changed = true;
    }
    if (utm && cur.u !== utm) {
      next.u = utm;
      changed = true;
    }
    if (promo && cur.p !== promo.toUpperCase()) {
      next.p = promo.toUpperCase();
      localStorage.setItem("jays_promo", next.p);
      changed = true;
    }
    if (changed) document.cookie = `jays_src=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
    if (campaign && next.q && !sessionStorage.getItem(`qr_${next.q}`)) {
      sessionStorage.setItem(`qr_${next.q}`, "1");
      track("qr_scan", { campaign, qr: next.q });
    }
  }, [campaign, utm, promo]);
  return null;
}
