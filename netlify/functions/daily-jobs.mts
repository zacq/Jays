// Netlify Scheduled Function: triggers payment reminders, points expiry and the monthly Top Buyers proposal.
// 04:00 UTC = 07:00 Nairobi.
export default async () => {
  const site = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) {
    console.error("daily-jobs: URL or CRON_SECRET missing");
    return;
  }
  const res = await fetch(`${site}/api/cron/daily`, { headers: { authorization: `Bearer ${secret}` } });
  console.log("daily-jobs", res.status, await res.text());
};

export const config = { schedule: "0 4 * * *" };
