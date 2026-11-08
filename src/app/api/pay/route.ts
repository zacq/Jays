import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { normalizePhone } from "@/lib/format";
import { darajaConfigured } from "@/lib/mpesa";
import { markPaid } from "@/lib/orders";
import { startStk } from "@/lib/payments";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Customer-facing payment actions: re-send STK, submit a Till code, or (demo mode only) simulate confirmation. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const phone = normalizePhone(b?.phone);
  if (!b || !phone || typeof b.orderNo !== "string") return Response.json({ error: "Invalid request" }, { status: 400 });
  const [o] = await db.select().from(orders).where(and(eq(orders.orderNo, b.orderNo), eq(orders.phone, phone)));
  if (!o) return Response.json({ error: "Order not found" }, { status: 404 });
  if (o.paymentStatus === "paid") return Response.json({ ok: true, message: "Already paid." });
  if (o.status === "cancelled" || o.status === "refunded") return Response.json({ error: "Order is cancelled" }, { status: 400 });

  if (b.action === "stk") {
    return Response.json({ ok: true, ...(await startStk(o)) });
  }
  if (b.action === "till") {
    const code = String(b.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(code)) return Response.json({ error: "Enter the 10-character M-Pesa code from your SMS." }, { status: 400 });
    await db.insert(payments).values({ orderId: o.id, method: "till", amount: o.total, status: "review", receipt: code });
    const s = await getSettings();
    await notify(s.shop.whatsapp, `VERIFY PAYMENT: order ${o.orderNo} ${o.total} KSh, M-Pesa code ${code}`, "owner_alert");
    return Response.json({ ok: true, message: "Thanks! We'll confirm your payment shortly and update your order." });
  }
  if (b.action === "simulate") {
    if (darajaConfigured()) return Response.json({ error: "Not available" }, { status: 403 });
    await markPaid(o.id, `SIM${Math.random().toString(36).slice(2, 9).toUpperCase()}`, "demo");
    return Response.json({ ok: true, message: "Demo payment confirmed." });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
