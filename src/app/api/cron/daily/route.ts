import { getSession } from "@/lib/auth";
import { runJobs } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

/** Scheduled jobs: payment reminders, points expiry, monthly Top Buyers proposal. Call daily from a cron. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const session = await getSession();
  if (!(session?.role === "owner" || (secret && auth === `Bearer ${secret}`))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await runJobs());
}
