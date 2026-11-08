import { db } from "@/db";
import { campaigns, qrCodes, qrScans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/seed";
import { activeCampaigns } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/** QR short link: logs the scan, tags the visitor with the campaign, then opens the landing page (or the current offer when expired). */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  await ensureSeed();
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const [qr] = await db.select().from(qrCodes).where(eq(qrCodes.code, code));
  if (!qr) return NextResponse.redirect(new URL("/offers", url.origin));
  const [camp] = await db.select().from(campaigns).where(eq(campaigns.id, qr.campaignId));

  const cookieHeader = req.headers.get("cookie") || "";
  const vm = cookieHeader.match(/jays_vid=([^;]+)/);
  const vid = vm?.[1] || randomUUID();
  await db.insert(qrScans).values({ qrId: qr.id, campaignId: qr.campaignId, visitorId: vid });

  const now = new Date();
  const live = camp && camp.active && camp.startsAt <= now && camp.endsAt > now;
  let target = camp?.slug;
  if (!live) target = (await activeCampaigns(now))[0]?.slug;
  const res = NextResponse.redirect(new URL(target ? `/c/${target}` : "/offers", url.origin));
  res.cookies.set("jays_vid", vid, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (live) res.cookies.set("jays_src", JSON.stringify({ c: camp.slug, q: qr.code }), { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
  return res;
}
