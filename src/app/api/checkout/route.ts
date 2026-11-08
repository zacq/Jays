import { quote } from "@/lib/pricing";
import { ensureSeed } from "@/lib/seed";
import { normalizePhone, localPhone } from "@/lib/format";
import { readSource, verifiedPhone } from "@/lib/source";
import { createOrder } from "@/lib/orders";
import { startStk } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ errors: ["Invalid request"] }, { status: 400 });
  const errors: string[] = [];
  const name = String(b.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(b.phone ?? ""));
  if (name.length < 2) errors.push("Please enter your name.");
  if (!phone) errors.push("Enter a valid Safaricom/Airtel number (07xx or 01xx).");
  if (!b.ageConfirmed) errors.push("You must confirm you are 18+ and will show ID on delivery.");
  if (b.website) errors.push("Spam detected."); // honeypot
  const fulfilment = b.fulfilment === "delivery" ? "delivery" : "pickup";
  const paymentMethod = b.paymentMethod === "pod" ? "pod" : "mpesa";
  if (errors.length || !phone) return Response.json({ errors }, { status: 400 });

  const src = await readSource();
  const items = (Array.isArray(b.items) ? b.items : []).map((i: { productId: number; qty: number }) => ({ productId: Number(i.productId), qty: Number(i.qty) }));
  const q = await quote({
    items,
    fulfilment,
    zoneId: b.zoneId ? Number(b.zoneId) : null,
    promoCode: b.promoCode || undefined,
    voucherCode: b.voucherCode || undefined,
    pointsToUse: Number(b.pointsToUse) || 0,
    phone,
    verifiedPhone: await verifiedPhone(),
    campaignSlug: src.c ?? null,
    qrCode: src.q ?? null,
    utmSource: src.u ?? null,
    strict: true,
  });
  if (q.promoError) q.errors.push(q.promoError);
  if (paymentMethod === "pod" && !q.podAllowed) q.errors.push("Pay on Delivery isn't available for this zone or order value. Please pay with M-Pesa.");
  if (q.errors.length) return Response.json({ errors: q.errors }, { status: 400 });

  const order = await createOrder(
    {
      name,
      phone,
      fulfilment,
      zoneId: b.zoneId ? Number(b.zoneId) : null,
      landmark: String(b.landmark ?? "").slice(0, 200),
      preferredTime: String(b.preferredTime ?? "").slice(0, 60),
      notes: String(b.notes ?? "").slice(0, 300),
      paymentMethod,
      marketingConsent: !!b.marketingConsent,
      topBuyerConsent: !!b.topBuyerConsent,
      voucherCode: b.voucherCode || null,
    },
    q,
    { source: q.source },
  );

  let pay: { mode: string; message: string } | null = null;
  if (paymentMethod === "mpesa") pay = await startStk(order);
  return Response.json({ ok: true, orderNo: order.orderNo, phone: localPhone(phone), total: order.total, pay, pointsEarned: order.pointsEarned });
}
