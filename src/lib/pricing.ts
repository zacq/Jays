import { db } from "@/db";
import { campaigns, deliveryZones, orders, products, promoCodes, qrCodes, vouchers } from "@/db/schema";
import { and, asc, desc, eq, gt, inArray, lte, ne, or, sql } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { withinHours } from "@/lib/format";
import { getBalance, getCustomerByPhone } from "@/lib/loyalty";

export type Product = typeof products.$inferSelect;

export type QuoteInput = {
  items: { productId: number; qty: number }[];
  fulfilment: "delivery" | "pickup";
  zoneId?: number | null;
  promoCode?: string;
  voucherCode?: string;
  pointsToUse?: number;
  phone?: string | null; // normalised 254...
  verifiedPhone?: string | null;
  campaignSlug?: string | null;
  qrCode?: string | null;
  utmSource?: string | null;
  strict?: boolean; // checkout: enforce zone, stock etc.
};

type Offer = {
  label: string;
  type: string;
  value: number;
  appliesTo: string;
  appliesValue: string | null;
  minSpend: number;
  limit: number;
  freeDeliveryAbove: number | null;
  campaignId: number | null;
  code: string | null;
};

export type Quote = {
  errors: string[];
  notices: string[];
  promoError: string | null;
  lines: { productId: number; slug: string; name: string; qty: number; unit: number; total: number; sizeMl: number }[];
  subtotal: number;
  discount: number;
  offerLabel: string | null;
  voucherDiscount: number;
  voucherLabel: string | null;
  pointsUsed: number;
  pointsDiscount: number;
  deliveryFee: number;
  freeDelivery: boolean;
  total: number;
  pointsEarned: number;
  bottles: number;
  minDelivery: number;
  deliveryUnlocked: boolean;
  gap: number;
  suggestions: { id: number; slug: string; name: string; price: number; sizeMl: number; spirit: string; flavour: string }[];
  outsideHours: boolean;
  hoursMessage: string | null;
  podAllowed: boolean;
  zoneName: string | null;
  campaignId: number | null;
  qrCodeId: number | null;
  promoCodeUsed: string | null;
  source: string;
  balance: number | null;
};

export const unitPrice = (p: Product, now = new Date()) =>
  p.offerPriceKsh && p.offerEnd && p.offerEnd > now ? p.offerPriceKsh : p.priceKsh;

export async function activeCampaigns(now = new Date()) {
  return db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.active, true), lte(campaigns.startsAt, now), gt(campaigns.endsAt, now)))
    .orderBy(desc(campaigns.startsAt));
}

function offerFromCampaign(c: typeof campaigns.$inferSelect, code: string | null): Offer {
  return {
    label: c.name,
    type: c.offerType,
    value: c.offerValue,
    appliesTo: c.appliesTo,
    appliesValue: c.appliesValue,
    minSpend: c.minSpend,
    limit: c.usageLimitPerPhone,
    freeDeliveryAbove: c.freeDeliveryAbove,
    campaignId: c.id,
    code,
  };
}

const matches = (p: { spirit: string; flavour: string; sizeMl: number }, o: Offer) => {
  if (o.appliesTo === "all" || !o.appliesValue) return true;
  if (o.appliesTo === "spirit") return p.spirit.toLowerCase() === o.appliesValue.toLowerCase();
  if (o.appliesTo === "flavour") return p.flavour.toLowerCase() === o.appliesValue.toLowerCase();
  if (o.appliesTo === "size") return String(p.sizeMl) === o.appliesValue.replace(/\D/g, "");
  return true;
};

export const offerSummary = (c: { offerType: string; offerValue: number; freeDeliveryAbove?: number | null }) => {
  if (c.offerType === "percent") return `${c.offerValue}% off`;
  if (c.offerType === "fixed") return `KSh ${c.offerValue} off`;
  if (c.offerType === "free_delivery") return "Free delivery";
  if (c.offerType === "points") return `${c.offerValue}x points`;
  return "";
};

export async function quote(input: QuoteInput): Promise<Quote> {
  const s = await getSettings();
  const now = new Date();
  const errors: string[] = [];
  const notices: string[] = [];
  let promoError: string | null = null;

  const ids = [...new Set(input.items.map((i) => i.productId))];
  const prods = ids.length ? await db.select().from(products).where(and(inArray(products.id, ids), eq(products.active, true))) : [];
  const lines: Quote["lines"] = [];
  const full: { p: Product; qty: number; total: number }[] = [];
  for (const it of input.items) {
    const p = prods.find((x) => x.id === it.productId);
    if (!p) {
      errors.push("An item in your cart is no longer available.");
      continue;
    }
    const qty = Math.max(1, Math.min(99, Math.floor(it.qty) || 1));
    if (p.stockQty < qty) errors.push(p.stockQty <= 0 ? `${p.name} is sold out.` : `${p.name}: only ${p.stockQty} left.`);
    const unit = unitPrice(p, now);
    lines.push({ productId: p.id, slug: p.slug, name: p.name, qty, unit, total: unit * qty, sizeMl: p.sizeMl });
    full.push({ p, qty, total: unit * qty });
  }
  const subtotal = full.reduce((a, l) => a + l.total, 0);
  const bottles = full.reduce((a, l) => a + l.qty, 0);

  // ----- Offer resolution (one offer per order unless stacking allowed) -----
  let offer: Offer | null = null;
  let qrCodeId: number | null = null;
  let attributedCampaign: number | null = null;
  let source = input.utmSource ? `UTM: ${input.utmSource}` : "Website";
  const code = input.promoCode?.trim().toUpperCase();
  const camps = await activeCampaigns(now);

  if (input.qrCode) {
    const [q] = await db.select().from(qrCodes).where(eq(qrCodes.code, input.qrCode));
    if (q) {
      qrCodeId = q.id;
      source = `QR: ${q.label}`;
    }
  }
  if (input.campaignSlug) {
    const c = camps.find((x) => x.slug === input.campaignSlug);
    if (c) {
      offer = offerFromCampaign(c, null);
      attributedCampaign = c.id;
      if (!qrCodeId) source = `Campaign: ${c.name}`;
    }
  }
  if (code) {
    const [pc] = await db.select().from(promoCodes).where(and(eq(promoCodes.code, code), eq(promoCodes.active, true)));
    const camp = camps.find((c) => c.promoCode?.toUpperCase() === code);
    let promo: Offer | null = null;
    if (pc) {
      promo = {
        label: `Code ${pc.code}`,
        type: pc.offerType,
        value: pc.offerValue,
        appliesTo: pc.appliesTo,
        appliesValue: pc.appliesValue,
        minSpend: pc.minSpend,
        limit: pc.usageLimitPerPhone,
        freeDeliveryAbove: null,
        campaignId: pc.campaignId,
        code: pc.code,
      };
      if (pc.campaignId) attributedCampaign = pc.campaignId;
    } else if (camp) {
      promo = offerFromCampaign(camp, code);
      attributedCampaign = camp.id;
    }
    if (!promo) promoError = "That promo code is not valid or has expired.";
    else {
      if (offer && !s.allowStacking && offer.campaignId !== promo.campaignId) notices.push(`Promo ${code} replaced the ${offer.label} offer (one offer per order).`);
      offer = promo;
      if (!qrCodeId) source = `Promo: ${code}`;
    }
  }

  // ----- Offer validation + discount -----
  let discount = 0;
  let offerLabel: string | null = null;
  let freeDeliveryByOffer = false;
  let pointsMult = 1;
  let freeDeliveryAbove: number | null = null;
  if (offer) {
    const eligible = full.filter((l) => matches(l.p, offer!)).reduce((a, l) => a + l.total, 0);
    let ok = true;
    if (offer.minSpend > subtotal) {
      ok = false;
      notices.push(`${offer.label}: spend KSh ${offer.minSpend} to unlock this offer.`);
      if (code) promoError = `Add KSh ${offer.minSpend - subtotal} more to use ${code}.`;
    }
    if (ok && offer.type !== "free_delivery" && offer.type !== "points" && eligible === 0) {
      ok = false;
      notices.push(`${offer.label} does not apply to the items in your cart.`);
    }
    if (ok && offer.limit > 0 && input.phone) {
      const byCampaign = offer.campaignId ? and(eq(orders.campaignId, offer.campaignId), gt(orders.discount, 0)) : undefined;
      const byCode = offer.code ? eq(orders.promoCode, offer.code) : undefined;
      const match = byCampaign && byCode ? or(byCampaign, byCode) : byCampaign ?? byCode ?? eq(orders.id, -1);
      const cond = and(eq(orders.phone, input.phone), ne(orders.status, "cancelled"), ne(orders.status, "refunded"), match);
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(cond);
      if (n >= offer.limit) {
        ok = false;
        const msg = `${offer.label} has already been used on this phone number.`;
        notices.push(msg);
        if (code) promoError = msg;
      }
    }
    if (ok) {
      if (offer.type === "percent") discount = Math.floor((eligible * offer.value) / 100);
      else if (offer.type === "fixed") discount = Math.min(offer.value, eligible);
      else if (offer.type === "free_delivery") freeDeliveryByOffer = true;
      else if (offer.type === "points") pointsMult = Math.max(1, offer.value);
      offerLabel = offer.label;
      freeDeliveryAbove = offer.freeDeliveryAbove;
    }
  }

  // ----- Delivery -----
  const minDelivery = s.minDelivery;
  const deliveryUnlocked = subtotal >= minDelivery;
  const gap = Math.max(0, minDelivery - subtotal);
  const zones = await db.select().from(deliveryZones).where(eq(deliveryZones.active, true)).orderBy(asc(deliveryZones.sortOrder));
  const zone = input.zoneId ? zones.find((z) => z.id === input.zoneId) ?? null : null;
  let deliveryFee = 0;
  let freeDelivery = false;
  if (input.fulfilment === "delivery") {
    if (!deliveryUnlocked) errors.push(`Delivery needs a cart of KSh ${minDelivery}. Add KSh ${gap} more or choose pickup.`);
    if (input.strict && !zone) errors.push("Please choose your delivery zone.");
    if (zone) {
      deliveryFee = zone.feeKsh;
      if (freeDeliveryByOffer || (freeDeliveryAbove && subtotal >= freeDeliveryAbove && zone.sortOrder <= 2)) {
        deliveryFee = 0;
        freeDelivery = true;
      }
    }
  }

  // ----- Voucher -----
  let voucherDiscount = 0;
  let voucherLabel: string | null = null;
  const vcode = input.voucherCode?.trim().toUpperCase();
  if (vcode) {
    const [v] = await db.select().from(vouchers).where(eq(vouchers.code, vcode));
    if (!v || v.redeemedAt || (input.phone && v.phone !== input.phone)) {
      notices.push("Voucher is not valid for this phone number.");
      if (input.strict) errors.push("Voucher code is not valid for this phone number.");
    } else if (!input.phone) {
      notices.push("Enter your phone number to apply the voucher.");
    } else {
      voucherLabel = v.label;
      if (v.type === "free_delivery") {
        if (input.fulfilment === "delivery" && zone && zone.sortOrder <= 2) {
          deliveryFee = 0;
          freeDelivery = true;
        } else notices.push("This voucher gives free Zone 1–2 delivery.");
      } else voucherDiscount = Math.min(v.valueKsh, Math.max(0, subtotal - discount));
    }
  }

  // ----- Points redemption (needs verified phone) -----
  let pointsUsed = 0;
  let pointsDiscount = 0;
  let balance: number | null = null;
  if (input.phone && input.verifiedPhone === input.phone) {
    const c = await getCustomerByPhone(input.phone);
    balance = c ? await getBalance(c.id) : 0;
  }
  if (input.pointsToUse && input.pointsToUse > 0) {
    if (balance === null) errors.push("Verify your phone on the Rewards page to redeem points.");
    else {
      const base = Math.max(0, subtotal - discount - voucherDiscount);
      const maxByPct = Math.floor((base * s.maxRedeemPct) / 100 / s.redeemKshPerPoint);
      const want = Math.min(Math.floor(input.pointsToUse), balance, maxByPct);
      if (balance < s.minRedeemPoints) errors.push(`You need at least ${s.minRedeemPoints} points to redeem (you have ${balance}).`);
      else if (want < s.minRedeemPoints) errors.push(`Minimum redemption is ${s.minRedeemPoints} points (max ${s.maxRedeemPct}% of the order).`);
      else {
        pointsUsed = want;
        pointsDiscount = want * s.redeemKshPerPoint;
        if (want < input.pointsToUse) notices.push(`Using ${want} points (limit: ${s.maxRedeemPct}% of order value).`);
      }
    }
  }

  const paidForProducts = Math.max(0, subtotal - discount - voucherDiscount - pointsDiscount);
  const total = paidForProducts + deliveryFee;
  const ratio = subtotal ? paidForProducts / subtotal : 0;
  const base = full.reduce((a, l) => a + Math.floor((l.total * ratio) / s.pointsPerKsh) * l.p.pointsMultiplier, 0);
  const pointsEarned = base * pointsMult;

  // ----- Hours -----
  const open = withinHours(s.deliveryOpen, s.deliveryClose, now);
  const outsideHours = !open && input.fulfilment === "delivery";
  const hoursMessage = outsideHours
    ? `We deliver ${s.deliveryOpen}–${s.deliveryClose}. Your order will be scheduled for the next delivery slot, or choose pickup.`
    : null;

  // ----- Payment options -----
  const podAllowed = input.fulfilment === "pickup" || (!!zone?.podAllowed && total <= s.podMaxKsh);

  // ----- Suggestions to close the gap -----
  let suggestions: Quote["suggestions"] = [];
  if (gap > 0) {
    const all = await db.select().from(products).where(and(eq(products.active, true), gt(products.stockQty, 0))).orderBy(asc(products.priceKsh));
    const closing = all.filter((p) => unitPrice(p) >= gap);
    const picks: Product[] = [];
    const seen = new Set<string>();
    for (const p of [...closing, ...all.reverse()]) {
      if (picks.length >= 3) break;
      const k = `${p.spirit}${p.sizeMl}`;
      if (seen.has(k)) continue;
      seen.add(k);
      picks.push(p);
    }
    suggestions = picks.map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: unitPrice(p), sizeMl: p.sizeMl, spirit: p.spirit, flavour: p.flavour }));
  }

  if (input.strict) {
    if (!lines.length) errors.push("Your cart is empty.");
  }

  return {
    errors,
    notices,
    promoError,
    lines,
    subtotal,
    discount,
    offerLabel,
    voucherDiscount,
    voucherLabel,
    pointsUsed,
    pointsDiscount,
    deliveryFee,
    freeDelivery,
    total,
    pointsEarned,
    bottles,
    minDelivery,
    deliveryUnlocked,
    gap,
    suggestions,
    outsideHours,
    hoursMessage,
    podAllowed,
    zoneName: zone ? `${zone.name} – ${zone.areas}` : null,
    campaignId: attributedCampaign,
    qrCodeId,
    promoCodeUsed: promoError ? null : code || null,
    source,
    balance,
  };
}
