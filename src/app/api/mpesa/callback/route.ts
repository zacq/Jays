import { db } from "@/db";
import { payments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { markPaid } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Item = { Name: string; Value?: string | number };

/** Daraja STK callback. Payment status is only ever set here (server-side), never from the browser. */
export async function POST(req: Request) {
  const ok = Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  const token = process.env.MPESA_CALLBACK_TOKEN;
  if (token && new URL(req.url).searchParams.get("token") !== token) return Response.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const cb = body?.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return ok;
  const [pay] = await db.select().from(payments).where(and(eq(payments.checkoutRequestId, cb.CheckoutRequestID), eq(payments.status, "pending")));
  if (!pay) return ok;
  if (cb.ResultCode === 0) {
    const items: Item[] = cb.CallbackMetadata?.Item ?? [];
    const amount = Number(items.find((i) => i.Name === "Amount")?.Value ?? 0);
    const receipt = String(items.find((i) => i.Name === "MpesaReceiptNumber")?.Value ?? "");
    if (amount < pay.amount) {
      await db.update(payments).set({ status: "review", resultDesc: `Amount mismatch: ${amount}`, receipt }).where(eq(payments.id, pay.id));
      return ok;
    }
    await markPaid(pay.orderId, receipt || null, "mpesa");
  } else {
    await db.update(payments).set({ status: "failed", resultDesc: String(cb.ResultDesc ?? "Failed") }).where(eq(payments.id, pay.id));
  }
  return ok;
}
