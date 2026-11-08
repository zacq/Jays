import { db } from "@/db";
import { payments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { darajaConfigured, stkPush } from "@/lib/mpesa";

type OrderLike = { id: number; orderNo: string; phone: string; total: number };

export async function startStk(order: OrderLike): Promise<{ mode: "stk" | "demo" | "failed"; message: string }> {
  // supersede any older pending STK attempts
  await db.update(payments).set({ status: "failed", resultDesc: "Superseded" }).where(and(eq(payments.orderId, order.id), eq(payments.method, "stk"), eq(payments.status, "pending")));
  if (!darajaConfigured()) {
    await db.insert(payments).values({ orderId: order.id, method: "stk", amount: order.total, status: "pending", checkoutRequestId: `DEMO-${order.orderNo}-${Date.now()}` });
    return { mode: "demo", message: "M-Pesa is in demo mode (no Daraja keys set). Use the demo button to simulate the customer's confirmation." };
  }
  try {
    const r = await stkPush({ phone: order.phone, amount: order.total, orderNo: order.orderNo });
    await db.insert(payments).values({ orderId: order.id, method: "stk", amount: order.total, status: "pending", checkoutRequestId: r.checkoutRequestId });
    return { mode: "stk", message: "Check your phone and enter your M-Pesa PIN to complete payment." };
  } catch (e) {
    await db.insert(payments).values({ orderId: order.id, method: "stk", amount: order.total, status: "failed", resultDesc: (e as Error).message });
    return { mode: "failed", message: "We couldn't send the M-Pesa prompt. Try again or pay to our Till and enter the code." };
  }
}
