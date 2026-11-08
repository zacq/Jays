import { db } from "@/db";
import { customers, messages } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Logs every outbound message in the `messages` table (visible in admin) and sends it via
 * Africa's Talking when AT_API_KEY / AT_USERNAME are configured. Without credentials the
 * message stays "logged" so staff can forward it through WhatsApp.
 */
export async function notify(phone: string, body: string, kind: string, opts: { marketing?: boolean } = {}) {
  try {
    if (opts.marketing) {
      const c = await db.select({ o: customers.optedOut }).from(customers).where(eq(customers.phone, phone));
      if (c[0]?.o) return;
      body += " Reply STOP to opt out.";
    }
    const [row] = await db.insert(messages).values({ phone, kind, body, channel: "sms" }).returning();
    const key = process.env.AT_API_KEY;
    const user = process.env.AT_USERNAME;
    if (key && user) {
      const host = user === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
      try {
        const res = await fetch(`https://${host}/version1/messaging`, {
          method: "POST",
          headers: { apiKey: key, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams({ username: user, to: `+${phone}`, message: body }),
        });
        await db
          .update(messages)
          .set({ status: res.ok ? "sent" : "failed" })
          .where(eq(messages.id, row.id));
      } catch {
        await db.update(messages).set({ status: "failed" }).where(eq(messages.id, row.id));
      }
    }
  } catch (e) {
    console.error("notify failed", e);
  }
}
