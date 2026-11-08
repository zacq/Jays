import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { normalizePhone } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const phone = normalizePhone(u.searchParams.get("p"));
  const no = (u.searchParams.get("o") || "").trim().toUpperCase();
  if (!phone || !no) return Response.json({ error: "Missing" }, { status: 400 });
  const [o] = await db.select({ status: orders.status, paymentStatus: orders.paymentStatus }).from(orders).where(and(eq(orders.orderNo, no), eq(orders.phone, phone)));
  if (!o) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(o);
}
