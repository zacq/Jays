"use client";

type W = Window & {
  gtag?: (...a: unknown[]) => void;
  ttq?: { track: (e: string, p?: unknown) => void };
  fbq?: (...a: unknown[]) => void;
  dataLayer?: unknown[];
};

const FB_MAP: Record<string, string> = { add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase", view_item: "ViewContent" };
const TT_MAP: Record<string, string> = { add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "CompletePayment", view_item: "ViewContent" };

/** Fires an event to GA4, TikTok Pixel and Meta Pixel when those are loaded. */
export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as W;
  try {
    w.gtag?.("event", event, params);
    w.ttq?.track(TT_MAP[event] ?? event, params);
    if (w.fbq) {
      if (FB_MAP[event]) w.fbq("track", FB_MAP[event], params);
      else w.fbq("trackCustom", event, params);
    }
  } catch {
    /* ignore */
  }
}
