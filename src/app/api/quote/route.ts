import { quote, type QuoteInput } from "@/lib/pricing";
import { ensureSeed } from "@/lib/seed";
import { normalizePhone } from "@/lib/format";
import { readSource, verifiedPhone } from "@/lib/source";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json().catch(() => ({}));
  const src = await readSource();
  const items = Array.isArray(b.items)
    ? b.items.map((i: { productId: number; qty: number }) => ({ productId: Number(i.productId), qty: Number(i.qty) })).filter((i: { productId: number }) => Number.isFinite(i.productId))
    : [];
  const input: QuoteInput = {
    items,
    fulfilment: b.fulfilment === "delivery" ? "delivery" : "pickup",
    zoneId: b.zoneId ? Number(b.zoneId) : null,
    promoCode: typeof b.promoCode === "string" ? b.promoCode : undefined,
    voucherCode: typeof b.voucherCode === "string" ? b.voucherCode : undefined,
    pointsToUse: Number(b.pointsToUse) || 0,
    phone: normalizePhone(b.phone),
    verifiedPhone: await verifiedPhone(),
    campaignSlug: src.c ?? null,
    qrCode: src.q ?? null,
    utmSource: src.u ?? null,
  };
  return Response.json(await quote(input));
}
