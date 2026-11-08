"use server";

import { db } from "@/db";
import {
  adminUsers,
  campaigns,
  customers,
  deliveryZones,
  orders,
  pointsLedger,
  products,
  promoCodes,
  qrCodes,
  rewardRules,
  riders,
  stockMovements,
  topBuyersMonths,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { audit, hashPassword, loginAdmin, logoutAdmin, requireRole } from "@/lib/auth";
import { markPaid, setStatus } from "@/lib/orders";
import { saveSettings, getSettings } from "@/lib/settings";
import { approveMonth, proposeMonth, runJobs, type TopEntry } from "@/lib/loyalty";
import { fromLocalInput, monthKey, normalizePhone } from "@/lib/format";
import { slugify } from "@/lib/seed";
import { ensureSeed } from "@/lib/seed";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string) => Math.round(Number(fd.get(k) ?? 0)) || 0;
const b = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

export async function loginAction(fd: FormData) {
  await ensureSeed();
  const ok = await loginAdmin(s(fd, "username"), s(fd, "password"));
  if (!ok) redirect("/admin/login?err=1");
  redirect("/admin");
}

export async function logoutAction() {
  await logoutAdmin();
  redirect("/admin/login");
}

/* ---------- Orders ---------- */

export async function orderAction(fd: FormData) {
  const session = await requireRole(["owner", "attendant", "rider"]);
  const id = n(fd, "id");
  const action = s(fd, "action");
  const back = `/admin/orders/${id}`;
  if (session.role === "rider" && !(action === "delivered")) redirect(back);
  let res: { ok: boolean; error?: string } = { ok: true };
  if (action === "paid") {
    await markPaid(id, s(fd, "receipt") || null, session.name);
  } else if (action === "assign") {
    const riderId = n(fd, "riderId");
    await db.update(orders).set({ riderId: riderId || null }).where(eq(orders.id, id));
  } else if (["packed", "out_for_delivery", "delivered", "cancelled", "refunded"].includes(action)) {
    res = await setStatus(id, action, session.name, { riderId: n(fd, "riderId") || undefined, idChecked: b(fd, "idChecked"), reason: s(fd, "reason") });
  }
  await audit(session.name, `order_${action}`, "order", id, res.error);
  revalidatePath("/admin/orders");
  redirect(`${back}${res.ok ? "" : `?err=${encodeURIComponent(res.error ?? "Failed")}`}`);
}

/* ---------- Stock & products ---------- */

export async function stockAction(fd: FormData) {
  const session = await requireRole(["owner", "attendant"]);
  const productId = n(fd, "productId");
  const type = s(fd, "type"); // stock_in | adjustment | count
  const qty = n(fd, "qty");
  const reason = s(fd, "reason");
  const [p] = await db.select().from(products).where(eq(products.id, productId));
  if (!p) redirect("/admin/stock");
  let delta = qty;
  if (type === "count") delta = qty - p.stockQty; // weekly count: set to counted number
  if (type === "adjustment" && !reason) redirect("/admin/stock?err=Reason+required+for+adjustments");
  if (delta !== 0) {
    await db.update(products).set({ stockQty: Math.max(0, p.stockQty + delta) }).where(eq(products.id, productId));
    await db.insert(stockMovements).values({ productId, delta, type, reason: reason || (type === "stock_in" ? "Supplier delivery" : "Stock count"), userName: session.name });
    await audit(session.name, type, "product", productId, `${p.name}: ${delta > 0 ? "+" : ""}${delta} (${reason})`);
  }
  revalidatePath("/admin/stock");
  redirect("/admin/stock");
}

export async function saveProduct(fd: FormData) {
  const session = await requireRole(["owner"]);
  const id = n(fd, "id");
  const price = n(fd, "priceKsh");
  const offer = n(fd, "offerPriceKsh");
  const offerEnd = s(fd, "offerEnd");
  const [old] = await db.select().from(products).where(eq(products.id, id));
  if (!old || price <= 0) redirect("/admin/products");
  await db
    .update(products)
    .set({
      priceKsh: price,
      offerPriceKsh: offer > 0 ? offer : null,
      offerEnd: offer > 0 && offerEnd ? fromLocalInput(offerEnd) : null,
      lowStockAt: n(fd, "lowStockAt"),
      pointsMultiplier: Math.max(1, n(fd, "pointsMultiplier")),
      featured: b(fd, "featured"),
      active: b(fd, "active"),
      abv: s(fd, "abv") || null,
      brand: s(fd, "brand") || null,
    })
    .where(eq(products.id, id));
  if (old.priceKsh !== price) await audit(session.name, "price_change", "product", id, `${old.name}: ${old.priceKsh} → ${price}`);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect("/admin/products");
}

export async function createProduct(fd: FormData) {
  const session = await requireRole(["owner"]);
  const spirit = s(fd, "spirit");
  const flavour = s(fd, "flavour");
  const sizeMl = n(fd, "sizeMl");
  const name = `${flavour} ${spirit} ${sizeMl}ml`;
  const [{ max }] = (await db.execute(sql`select coalesce(max(sort_order),0)::int as max from products`)).rows as { max: number }[];
  const [row] = await db
    .insert(products)
    .values({ slug: slugify(name), name, spirit, flavour, sizeMl, priceKsh: n(fd, "priceKsh"), stockQty: n(fd, "stockQty"), brand: s(fd, "brand") || "Jay's Select", abv: s(fd, "abv") || null, description: s(fd, "description") || null, sortOrder: max + 1 })
    .onConflictDoNothing()
    .returning();
  if (row) await audit(session.name, "product_create", "product", row.id, name);
  redirect("/admin/products");
}

/* ---------- Customers ---------- */

export async function saveCustomer(fd: FormData) {
  const session = await requireRole(["owner", "attendant"]);
  const id = n(fd, "id");
  await db.update(customers).set({ tags: s(fd, "tags"), optedOut: b(fd, "optedOut") }).where(eq(customers.id, id));
  await audit(session.name, "customer_update", "customer", id);
  revalidatePath("/admin/customers");
  redirect("/admin/customers");
}

/* ---------- Campaigns, QR, promos ---------- */

export async function saveCampaign(fd: FormData) {
  const session = await requireRole(["owner"]);
  const id = s(fd, "id");
  const name = s(fd, "name");
  const slug = slugify(s(fd, "slug") || name);
  const values = {
    slug,
    name,
    type: s(fd, "type") || "Holiday",
    startsAt: fromLocalInput(s(fd, "startsAt")),
    endsAt: fromLocalInput(s(fd, "endsAt")),
    offerType: s(fd, "offerType") || "percent",
    offerValue: n(fd, "offerValue"),
    appliesTo: s(fd, "appliesTo") || "all",
    appliesValue: s(fd, "appliesValue") || null,
    minSpend: n(fd, "minSpend"),
    usageLimitPerPhone: n(fd, "usageLimitPerPhone"),
    freeDeliveryAbove: n(fd, "freeDeliveryAbove") || null,
    headline: s(fd, "headline") || name,
    bannerText: s(fd, "bannerText") || null,
    bannerColor: s(fd, "bannerColor") || "amber",
    terms: s(fd, "terms") || null,
    promoCode: s(fd, "promoCode").toUpperCase() || null,
    partner: s(fd, "partner") || null,
    featuredProductIds: s(fd, "featuredProductIds"),
    active: b(fd, "active"),
  };
  if (!name || isNaN(values.startsAt.getTime()) || isNaN(values.endsAt.getTime())) redirect(`/admin/campaigns/${id || "new"}?err=Name+and+dates+are+required`);
  let cid: number;
  if (id && id !== "new") {
    await db.update(campaigns).set(values).where(eq(campaigns.id, Number(id)));
    cid = Number(id);
  } else {
    const [row] = await db.insert(campaigns).values(values).returning();
    cid = row.id;
    await db.insert(qrCodes).values({ campaignId: cid, code: `${slug}-main`, label: "Main QR" }).onConflictDoNothing();
  }
  await audit(session.name, "campaign_save", "campaign", cid, name);
  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${cid}`);
}

export async function createQr(fd: FormData) {
  const session = await requireRole(["owner"]);
  const campaignId = n(fd, "campaignId");
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  const label = s(fd, "label") || "QR";
  if (c) {
    const code = `${c.slug}-${slugify(label)}-${Math.random().toString(36).slice(2, 5)}`;
    await db.insert(qrCodes).values({ campaignId, code, label });
    await audit(session.name, "qr_create", "campaign", campaignId, label);
  }
  redirect(`/admin/campaigns/${campaignId}`);
}

export async function savePromo(fd: FormData) {
  const session = await requireRole(["owner"]);
  const code = s(fd, "code").toUpperCase().replace(/\s/g, "");
  if (!code) redirect("/admin/promos");
  await db
    .insert(promoCodes)
    .values({ code, ownerName: s(fd, "ownerName") || null, campaignId: n(fd, "campaignId") || null, offerType: s(fd, "offerType") || "percent", offerValue: n(fd, "offerValue"), appliesTo: "all", minSpend: n(fd, "minSpend"), usageLimitPerPhone: n(fd, "usageLimitPerPhone") })
    .onConflictDoNothing();
  await audit(session.name, "promo_create", "promo", code);
  redirect("/admin/promos");
}

export async function togglePromo(fd: FormData) {
  await requireRole(["owner"]);
  const id = n(fd, "id");
  await db.update(promoCodes).set({ active: b(fd, "active") }).where(eq(promoCodes.id, id));
  redirect("/admin/promos");
}

/* ---------- Loyalty ---------- */

export async function saveRule(fd: FormData) {
  const session = await requireRole(["owner"]);
  const id = n(fd, "id");
  const values = {
    name: s(fd, "name"),
    kind: s(fd, "kind") || "bottles",
    threshold: Math.max(1, n(fd, "threshold")),
    sizeMl: n(fd, "sizeMl") || null,
    spirit: s(fd, "spirit") || null,
    rewardType: s(fd, "rewardType") || "cash",
    rewardValue: n(fd, "rewardValue"),
    rewardLabel: s(fd, "rewardLabel"),
    active: id ? b(fd, "active") : true,
  };
  if (!values.name || !values.rewardLabel) redirect("/admin/loyalty");
  if (id) await db.update(rewardRules).set(values).where(eq(rewardRules.id, id));
  else await db.insert(rewardRules).values(values);
  await audit(session.name, "reward_rule_save", "reward_rule", id || "new", values.name);
  redirect("/admin/loyalty");
}

export async function saveLoyaltySettings(fd: FormData) {
  const session = await requireRole(["owner"]);
  const cur = await getSettings();
  const rewards = [1, 2, 3].map((i) => ({ from: n(fd, `from${i}`), to: n(fd, `to${i}`), label: s(fd, `label${i}`), voucherKsh: n(fd, `voucher${i}`) })).filter((r) => r.from > 0 && r.label);
  await saveSettings({
    pointsPerKsh: Math.max(1, n(fd, "pointsPerKsh")),
    redeemKshPerPoint: Math.max(1, n(fd, "redeemKshPerPoint")),
    minRedeemPoints: Math.max(1, n(fd, "minRedeemPoints")),
    maxRedeemPct: Math.min(100, Math.max(1, n(fd, "maxRedeemPct"))),
    pointsExpiryMonths: Math.max(1, n(fd, "pointsExpiryMonths")),
    allowStacking: b(fd, "allowStacking"),
    topBuyers: { measure: s(fd, "measure") === "bottles" ? "bottles" : "spend", topN: Math.max(1, n(fd, "topN")), minOrders: Math.max(1, n(fd, "minOrders")), rewards: rewards.length ? rewards : cur.topBuyers.rewards },
  });
  await audit(session.name, "loyalty_settings", "settings", "loyalty");
  redirect("/admin/loyalty");
}

export async function topBuyersAction(fd: FormData) {
  const session = await requireRole(["owner"]);
  const month = s(fd, "month") || monthKey();
  const action = s(fd, "action");
  if (action === "generate") await proposeMonth(month, true);
  else if (action === "approve") await approveMonth(month);
  else if (action === "disqualify" || action === "requalify") {
    const [row] = await db.select().from(topBuyersMonths).where(eq(topBuyersMonths.month, month));
    if (row && row.status !== "approved") {
      const cid = n(fd, "customerId");
      const entries = (row.entries as TopEntry[]).map((e) => (e.customerId === cid ? { ...e, disqualified: action === "disqualify", reason: action === "disqualify" ? s(fd, "reason") || "No reason given" : "" } : e));
      await db.update(topBuyersMonths).set({ entries }).where(eq(topBuyersMonths.id, row.id));
    }
  }
  await audit(session.name, `top_buyers_${action}`, "top_buyers", month, s(fd, "reason"));
  redirect(`/admin/loyalty?month=${month}`);
}

export async function adjustPoints(fd: FormData) {
  const session = await requireRole(["owner"]);
  const phone = normalizePhone(s(fd, "phone"));
  const points = n(fd, "points");
  const [c] = phone ? await db.select().from(customers).where(eq(customers.phone, phone)) : [];
  if (c && points) {
    await db.insert(pointsLedger).values({ customerId: c.id, points, type: "adjust", note: s(fd, "note") || "Manual adjustment" });
    await audit(session.name, "points_adjust", "customer", c.id, `${points} ${s(fd, "note")}`);
  }
  redirect("/admin/loyalty");
}

/* ---------- Settings ---------- */

export async function saveShopSettings(fd: FormData) {
  const session = await requireRole(["owner"]);
  const cur = await getSettings();
  await saveSettings({
    minDelivery: Math.max(0, n(fd, "minDelivery")),
    deliveryOpen: s(fd, "deliveryOpen") || "10:00",
    deliveryClose: s(fd, "deliveryClose") || "22:00",
    podMaxKsh: n(fd, "podMaxKsh"),
    shopHoursText: s(fd, "shopHoursText"),
    shop: { ...cur.shop, name: s(fd, "name"), address: s(fd, "address"), phone: s(fd, "phone"), whatsapp: s(fd, "whatsapp").replace(/\D/g, ""), tiktok: s(fd, "tiktok"), licence: s(fd, "licence") },
  });
  await audit(session.name, "settings_save", "settings", "shop");
  revalidatePath("/", "layout");
  redirect("/admin/settings");
}

export async function saveZone(fd: FormData) {
  const session = await requireRole(["owner"]);
  const id = n(fd, "id");
  const v = { name: s(fd, "name"), areas: s(fd, "areas"), feeKsh: n(fd, "feeKsh"), targetMinutes: n(fd, "targetMinutes"), podAllowed: b(fd, "podAllowed"), sortOrder: n(fd, "sortOrder"), active: id ? b(fd, "active") : true };
  if (!v.name) redirect("/admin/settings");
  if (id) await db.update(deliveryZones).set(v).where(eq(deliveryZones.id, id));
  else await db.insert(deliveryZones).values(v);
  await audit(session.name, "zone_save", "zone", id || "new", `${v.name} ${v.feeKsh}`);
  redirect("/admin/settings");
}

export async function saveRider(fd: FormData) {
  const session = await requireRole(["owner"]);
  const id = n(fd, "id");
  const phone = normalizePhone(s(fd, "phone"));
  if (!phone || !s(fd, "name")) redirect("/admin/settings?err=Rider+name+and+valid+phone+required");
  const v = { name: s(fd, "name"), phone, transport: s(fd, "transport") || "Motorbike", active: id ? b(fd, "active") : true };
  if (id) await db.update(riders).set(v).where(eq(riders.id, id));
  else await db.insert(riders).values(v);
  await audit(session.name, "rider_save", "rider", id || "new", v.name);
  redirect("/admin/settings");
}

export async function resetPassword(fd: FormData) {
  const session = await requireRole(["owner"]);
  const pw = s(fd, "password");
  if (pw.length < 8) redirect("/admin/settings?err=Password+must+be+at+least+8+characters");
  await db.update(adminUsers).set({ passwordHash: hashPassword(pw) }).where(and(eq(adminUsers.username, s(fd, "username"))));
  await audit(session.name, "password_reset", "admin_user", s(fd, "username"));
  redirect("/admin/settings");
}

export async function runJobsAction() {
  const session = await requireRole(["owner"]);
  const r = await runJobs();
  await audit(session.name, "run_jobs", "system", "jobs", JSON.stringify(r));
  redirect("/admin?jobs=" + encodeURIComponent(JSON.stringify(r)));
}
