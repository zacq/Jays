import { db } from "@/db";
import { enquiries } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || b.website) return Response.json({ ok: true }); // honeypot
  const name = String(b.name ?? "").trim().slice(0, 80);
  const phone = String(b.phone ?? "").trim().slice(0, 30);
  const message = String(b.message ?? "").trim().slice(0, 1000);
  if (name.length < 2 || phone.length < 7 || message.length < 5) return Response.json({ error: "Please fill in all fields." }, { status: 400 });
  await db.insert(enquiries).values({ name, phone, message });
  return Response.json({ ok: true });
}
