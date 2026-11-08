import { db } from "@/db";
import { customers, orderItems, orders, payments, pointsLedger, products, riders, stockMovements, vouchers } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { evaluateRewards, getBalance, rewardProgress } from "@/lib/loyalty";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { localPhone, ksh } from "@/lib/format";
import type { Quote } from "@/lib/pricing";

export type NewOrderInput = {
  name: string;
  phone: string;
  fulfilment: "delivery" | "pickup";
  zoneId: number | null;
  landmark: string;
  preferredTime: string;
  notes: string;
  paymentMethod: "mpesa" | "pod";
  marketingConsent: boolean;
  topBuyerConsent: boolean;
  voucherCode: string | null;
};

async function uniqueOrderNo() {
  for (let i = 0; i < 10; i++) {
    const no = `JY${Math.floor(10000 + Math.random() * 89999)}`;
    const ex = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderNo, no));
    if (!ex.length) return no;
  }
  return `JY${Date.now().toString().slice(-7)}`;
}

export async function deductStock(orderId: number, by: string) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o || o.stockDeducted) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const low: string[] = [];
  for (const it of items) {
    const [p] = await db
      .update(products)
      .set({ stockQty: sql`greatest(${products.stockQty} - ${it.qty}, 0)` })
      .where(eq(products.id, it.productId))
      .returning();
    await db.insert(stockMovements).values({ productId: it.productId, delta: -it.qty, type: "sale", reason: `Order ${o.orderNo}`, orderId, userName: by });
    if (p && p.stockQty <= p.lowStockAt) low.push(`${p.name} (${p.stockQty} left)`);
  }
  await db.update(orders).set({ stockDeducted: true }).where(eq(orders.id, orderId));
  if (low.length) {
    const s = await getSettings();
    await notify(s.shop.whatsapp, `LOW STOCK: ${low.join(", ")}`, "low_stock");
  }
}

async function restoreStock(orderId: number, by: string) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o || !o.stockDeducted) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    await db.update(products).set({ stockQty: sql`${products.stockQty} + ${it.qty}` }).where(eq(products.id, it.productId));
    await db.insert(stockMovements).values({ productId: it.productId, delta: it.qty, type: "cancel", reason: `Order ${o.orderNo} cancelled`, orderId, userName: by });
  }
  await db.update(orders).set({ stockDeducted: false }).where(eq(orders.id, orderId));
}

export async function createOrder(input: NewOrderInput, q: Quote, attribution: { source: string }) {
  const orderNo = await uniqueOrderNo();
  const existing = await db.select().from(customers).where(eq(customers.phone, input.phone));
  let customer = existing[0];
  const isNew = !customer;
  if (!customer) {
    [customer] = await db
      .insert(customers)
      .values({
        phone: input.phone,
        name: input.name,
        zoneName: q.zoneName?.split(" – ")[0] ?? null,
        firstSource: attribution.source,
        marketingConsent: input.marketingConsent,
        topBuyerConsent: input.topBuyerConsent,
      })
      .returning();
  } else {
    await db
      .update(customers)
      .set({
        name: input.name,
        zoneName: q.zoneName?.split(" – ")[0] ?? customer.zoneName,
        marketingConsent: input.marketingConsent || customer.marketingConsent,
        topBuyerConsent: input.topBuyerConsent,
        optedOut: input.marketingConsent ? false : customer.optedOut,
      })
      .where(eq(customers.id, customer.id));
  }

  const [order] = await db
    .insert(orders)
    .values({
      orderNo,
      customerId: customer.id,
      phone: input.phone,
      name: input.name,
      fulfilment: input.fulfilment,
      zoneId: input.fulfilment === "delivery" ? input.zoneId : null,
      zoneName: input.fulfilment === "delivery" ? q.zoneName?.split(" – ")[0] ?? null : null,
      landmark: input.landmark || null,
      preferredTime: q.outsideHours ? `Next delivery slot${input.preferredTime ? ` (${input.preferredTime})` : ""}` : input.preferredTime || "ASAP",
      notes: input.notes || null,
      subtotal: q.subtotal,
      discount: q.discount,
      pointsUsed: q.pointsUsed,
      voucherDiscount: q.voucherDiscount,
      voucherCode: q.voucherLabel ? input.voucherCode : null,
      deliveryFee: q.deliveryFee,
      total: q.total,
      pointsEarned: q.pointsEarned,
      bottles: q.bottles,
      paymentMethod: input.paymentMethod,
      source: attribution.source,
      campaignId: q.campaignId,
      qrCodeId: q.qrCodeId,
      promoCode: q.promoCodeUsed,
      offerLabel: q.offerLabel,
      ageConfirmed: true,
      isNewCustomer: isNew,
    })
    .returning();

  const prods = await db.select().from(products).where(sql`${products.id} in (${sql.join(q.lines.map((l) => sql`${l.productId}`), sql`, `)})`);
  await db.insert(orderItems).values(
    q.lines.map((l) => {
      const p = prods.find((x) => x.id === l.productId)!;
      return { orderId: order.id, productId: l.productId, name: l.name, spirit: p.spirit, flavour: p.flavour, sizeMl: l.sizeMl, unitPrice: l.unit, qty: l.qty };
    }),
  );

  if (q.pointsUsed > 0) {
    await db.insert(pointsLedger).values({ customerId: customer.id, orderId: order.id, points: -q.pointsUsed, type: "redeem", note: `Redeemed on ${orderNo}` });
  }
  if (q.voucherLabel && input.voucherCode) {
    await db
      .update(vouchers)
      .set({ redeemedAt: new Date(), redeemedOrderId: order.id })
      .where(eq(vouchers.code, input.voucherCode.trim().toUpperCase()));
  }

  if (input.paymentMethod === "pod") {
    await db.insert(payments).values({ orderId: order.id, method: "pod", amount: order.total, status: "pending" });
    await deductStock(order.id, "system");
    await notify(
      order.phone,
      `Jay's: order ${orderNo} received (${ksh(order.total)}). Pay by M-Pesa to the rider's Till on ${input.fulfilment === "delivery" ? "delivery" : "pickup"}. Please have your ID ready.`,
      "order_received",
    );
  } else {
    await notify(order.phone, `Jay's: order ${orderNo} received. Total ${ksh(order.total)}. Complete M-Pesa payment to confirm. Track: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track?o=${orderNo}&p=${localPhone(order.phone)}`, "order_received");
  }
  const s = await getSettings();
  await notify(s.shop.whatsapp, `NEW ORDER ${orderNo}: ${ksh(order.total)} – ${order.fulfilment}${order.zoneName ? ` ${order.zoneName}` : ""} – ${order.name}`, "owner_alert");
  return order;
}

export async function markPaid(orderId: number, receipt: string | null, by: string) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o || o.paymentStatus === "paid" || o.status === "cancelled" || o.status === "refunded") return o ?? null;
  await db
    .update(orders)
    .set({ paymentStatus: "paid", status: o.status === "received" ? "paid" : o.status, paidAt: new Date() })
    .where(eq(orders.id, orderId));
  await db
    .update(payments)
    .set({ status: "success", receipt })
    .where(and(eq(payments.orderId, orderId), sql`${payments.status} in ('pending','review')`));
  await deductStock(orderId, by);
  const eta = o.fulfilment === "delivery" ? `We'll deliver soon${o.zoneName ? ` (${o.zoneName})` : ""}.` : "Collect at Jay's, Kiamunyi.";
  await notify(o.phone, `Jay's: payment received for ${o.orderNo}${receipt ? ` (${receipt})` : ""}. ${eta}`, "order_paid");
  return { ...o, paymentStatus: "paid" };
}

export type StatusResult = { ok: boolean; error?: string };

export async function setStatus(
  orderId: number,
  status: string,
  by: string,
  opts: { riderId?: number | null; idChecked?: boolean; reason?: string } = {},
): Promise<StatusResult> {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return { ok: false, error: "Order not found" };
  if (o.status === status) return { ok: true };

  if (status === "paid") {
    await markPaid(orderId, null, by);
    return { ok: true };
  }
  if (status === "out_for_delivery") {
    const rid = opts.riderId ?? o.riderId;
    if (o.fulfilment === "delivery" && !rid) return { ok: false, error: "Assign a rider first" };
    if (o.paymentMethod === "mpesa" && o.paymentStatus !== "paid") return { ok: false, error: "Order is not paid yet" };
    await db.update(orders).set({ status, riderId: rid ?? null }).where(eq(orders.id, orderId));
    const [r] = rid ? await db.select().from(riders).where(eq(riders.id, rid)) : [];
    await notify(o.phone, `Jay's: order ${o.orderNo} is out for delivery.${r ? ` Rider ${r.name}, ${localPhone(r.phone)}.` : ""} Have your ID ready.`, "out_for_delivery");
    return { ok: true };
  }
  if (status === "packed") {
    if (o.paymentMethod === "mpesa" && o.paymentStatus !== "paid") return { ok: false, error: "Order is not paid yet" };
    await db.update(orders).set({ status }).where(eq(orders.id, orderId));
    return { ok: true };
  }
  if (status === "delivered") {
    if (o.status === "cancelled" || o.status === "refunded") return { ok: false, error: "Order is cancelled" };
    if (o.paymentMethod === "mpesa" && o.paymentStatus !== "paid") return { ok: false, error: "Order is not paid yet" };
    if (!(opts.idChecked || o.idChecked)) return { ok: false, error: "Tick the ID check before marking as delivered" };
    await db
      .update(orders)
      .set({
        status,
        idChecked: true,
        deliveredAt: new Date(),
        paymentStatus: "paid",
        paidAt: o.paidAt ?? new Date(),
      })
      .where(eq(orders.id, orderId));
    await db.update(payments).set({ status: "success" }).where(and(eq(payments.orderId, orderId), eq(payments.status, "pending")));
    if (!o.stockDeducted) await deductStock(orderId, by);
    if (!o.pointsCredited) {
      if (o.pointsEarned > 0) await db.insert(pointsLedger).values({ customerId: o.customerId, orderId, points: o.pointsEarned, type: "earn", note: `Order ${o.orderNo}` });
      await db.update(orders).set({ pointsCredited: true }).where(eq(orders.id, orderId));
      await db.update(customers).set({ lastOrderAt: new Date() }).where(eq(customers.id, o.customerId));
    }
    const unlocked = await evaluateRewards(o.customerId, o.phone);
    const bal = await getBalance(o.customerId);
    const prog = (await rewardProgress(o.customerId)).find((p) => p.rule.kind === "bottles" && p.rule.sizeMl);
    await notify(
      o.phone,
      `Jay's: thank you! Order ${o.orderNo} ${o.fulfilment === "pickup" ? "picked up" : "delivered"}. You earned ${o.pointsEarned} points (balance ${bal}).${prog ? ` Progress: ${prog.count} of ${prog.target} bottles.` : ""}${unlocked.length ? ` Reward unlocked: ${unlocked.join(", ")}.` : ""}`,
      "order_delivered",
    );
    return { ok: true };
  }
  if (status === "cancelled" || status === "refunded") {
    await restoreStock(orderId, by);
    if (o.pointsUsed > 0) await db.insert(pointsLedger).values({ customerId: o.customerId, orderId, points: o.pointsUsed, type: "refund", note: `Order ${o.orderNo} ${status}` });
    if (o.pointsCredited && o.pointsEarned > 0) await db.insert(pointsLedger).values({ customerId: o.customerId, orderId, points: -o.pointsEarned, type: "adjust", note: `Reverse earn: ${o.orderNo} ${status}` });
    if (o.voucherCode) await db.update(vouchers).set({ redeemedAt: null, redeemedOrderId: null }).where(eq(vouchers.code, o.voucherCode));
    await db
      .update(orders)
      .set({
        status,
        cancelReason: opts.reason || o.cancelReason,
        pointsCredited: false,
        paymentStatus: o.paymentStatus === "paid" ? "refunded" : o.paymentStatus,
      })
      .where(eq(orders.id, orderId));
    await notify(o.phone, `Jay's: order ${o.orderNo} was ${status}. ${opts.reason ? `Reason: ${opts.reason}. ` : ""}${o.paymentStatus === "paid" ? "Your refund will be processed to your M-Pesa number." : ""}`, "order_cancelled");
    return { ok: true };
  }
  await db.update(orders).set({ status }).where(eq(orders.id, orderId));
  return { ok: true };
}
