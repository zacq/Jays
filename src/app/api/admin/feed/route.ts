import { db } from "@/db";
import { orders } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [r] = await db.select({ latest: sql<number>`coalesce(max(${orders.id}),0)::int` }).from(orders);
  return Response.json(r);
}
