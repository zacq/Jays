import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/db";
import { campaigns, qrCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { offerSummary } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "owner") return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const u = new URL(req.url);
  const [q] = await db.select().from(qrCodes).where(eq(qrCodes.id, Number(id)));
  if (!q) return new Response("Not found", { status: 404 });
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, q.campaignId));
  const origin = process.env.NEXT_PUBLIC_SITE_URL || u.origin;
  const link = `${origin}/q/${q.code}`;
  const format = u.searchParams.get("format") === "pdf" ? "pdf" : "png";

  if (format === "png") {
    const w = Math.min(2000, Math.max(120, Number(u.searchParams.get("w")) || 800));
    const buf = await QRCode.toBuffer(link, { width: w, margin: 2, errorCorrectionLevel: "M" });
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/png", ...(u.searchParams.get("download") ? { "Content-Disposition": `attachment; filename="jays-${q.code}.png"` } : {}) },
    });
  }

  const size = u.searchParams.get("size") ?? "a6";
  const png = await QRCode.toBuffer(link, { width: 900, margin: 1, errorCorrectionLevel: "M" });
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const img = await pdf.embedPng(png);
  const gold = rgb(0.97, 0.71, 0);
  const dark = rgb(0.04, 0.04, 0.06);
  const offer = `${c?.name ?? ""}${c ? ` - ${offerSummary(c)}` : ""}`.replace(/[^\x20-\x7E]/g, "");
  const centered = (page: ReturnType<typeof pdf.addPage>, text: string, y: number, sz: number, font = bold, color = rgb(1, 1, 1), cx?: number) => {
    const w = font.widthOfTextAtSize(text, sz);
    page.drawText(text, { x: (cx ?? page.getWidth() / 2) - w / 2, y, size: sz, font, color });
  };

  if (size === "stickers") {
    const page = pdf.addPage([595.28, 841.89]);
    const cols = 4, rows = 5, cw = 595.28 / cols, ch = 841.89 / rows;
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++) {
        const x = k * cw, y = 841.89 - (r + 1) * ch;
        page.drawRectangle({ x: x + 6, y: y + 6, width: cw - 12, height: ch - 12, color: dark, borderColor: gold, borderWidth: 1.5 });
        centered(page, "JAY'S", y + ch - 26, 14, bold, gold, x + cw / 2);
        const qs = cw - 60;
        page.drawRectangle({ x: x + 30 - 3, y: y + 30 + 14 - 3, width: qs + 6, height: qs + 6, color: rgb(1, 1, 1) });
        page.drawImage(img, { x: x + 30, y: y + 44, width: qs, height: qs });
        centered(page, "SCAN TO ORDER", y + 28, 9, bold, gold, x + cw / 2);
        centered(page, "18+ Drink responsibly", y + 14, 6, reg, rgb(0.7, 0.7, 0.75), x + cw / 2);
      }
  } else {
    const [W, H] = size === "a4" ? [595.28, 841.89] : [297.64, 419.53];
    const s = W / 297.64;
    const page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: dark });
    page.drawRectangle({ x: 10 * s, y: 10 * s, width: W - 20 * s, height: H - 20 * s, borderColor: gold, borderWidth: 2 * s });
    centered(page, "JAY'S", H - 60 * s, 34 * s, bold, gold);
    centered(page, "LIQUOR STORE - KIAMUNYI", H - 78 * s, 9 * s, reg, rgb(0.8, 0.8, 0.85));
    centered(page, offer.slice(0, 44), H - 112 * s, 15 * s, bold);
    const qs = W - 90 * s;
    const qy = H / 2 - qs / 2 - 20 * s;
    page.drawRectangle({ x: (W - qs) / 2 - 10 * s, y: qy - 10 * s, width: qs + 20 * s, height: qs + 20 * s, color: rgb(1, 1, 1) });
    page.drawImage(img, { x: (W - qs) / 2, y: qy, width: qs, height: qs });
    centered(page, "SCAN TO ORDER", qy - 42 * s, 22 * s, bold, gold);
    centered(page, "Pay with M-Pesa. Delivered from Kiamunyi.", qy - 60 * s, 9 * s, reg, rgb(0.85, 0.85, 0.9));
    centered(page, "18+ only. Drink responsibly.", 26 * s, 8 * s, reg, rgb(0.7, 0.7, 0.75));
  }
  const bytes = await pdf.save();
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="jays-${q.code}-${size}.pdf"` } });
}
