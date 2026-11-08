import { db } from "@/db";
import { otpCodes } from "@/db/schema";
import { and, eq, gt, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { normalizePhone } from "@/lib/format";
import { notify } from "@/lib/notify";
import { signedValue } from "@/lib/auth";
import { getBalance, getCustomerByPhone } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

/** Balance check by phone + one-time code. POST {phone} sends a code; POST {phone, code} verifies it. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const phone = normalizePhone(b?.phone);
  if (!phone) return Response.json({ error: "Enter a valid phone number (07xx or 01xx)." }, { status: 400 });

  if (!b.code) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), gte(otpCodes.expiresAt, new Date(Date.now() + 4 * 60000))));
    if (n >= 3) return Response.json({ error: "Too many codes requested. Wait a few minutes." }, { status: 429 });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.insert(otpCodes).values({ phone, code, expiresAt: new Date(Date.now() + 5 * 60000) });
    await notify(phone, `Jay's code: ${code}. Valid for 5 minutes. Don't share it.`, "otp");
    const smsLive = !!(process.env.AT_API_KEY && process.env.AT_USERNAME);
    return Response.json({ sent: true, devCode: smsLive ? undefined : code });
  }

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.code, String(b.code).trim()), eq(otpCodes.used, false), gt(otpCodes.expiresAt, new Date())));
  if (!row) return Response.json({ error: "That code is wrong or expired." }, { status: 400 });
  await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, row.id));
  const jar = await cookies();
  jar.set("jays_phone", signedValue(phone), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  const c = await getCustomerByPhone(phone);
  return Response.json({ ok: true, balance: c ? await getBalance(c.id) : 0 });
}
