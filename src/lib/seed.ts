import { db } from "@/db";
import {
  adminUsers,
  campaigns,
  deliveryZones,
  products,
  promoCodes,
  qrCodes,
  rewardRules,
  riders,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

const PRICES: Record<string, Record<number, number>> = {
  Vodka: { 100: 150, 200: 280, 750: 950 },
  Gin: { 100: 170, 200: 300, 750: 1050 },
  Whisky: { 100: 200, 200: 350, 750: 1250 },
};
const FLAVOURS = ["Strawberry", "Ginger", "Pineapple", "Honey"];
const SIZES = [100, 200, 750];
const ABV: Record<string, string> = { Vodka: "35%", Gin: "37.5%", Whisky: "40%" };
const FEATURED = new Set(["Strawberry Vodka 750ml", "Honey Whisky 750ml", "Ginger Gin 750ml", "Pineapple Vodka 200ml", "Honey Whisky 200ml"]);

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

let seeding: Promise<void> | null = null;

export function ensureSeed() {
  if (!seeding) {
    seeding = runSeed().catch((e) => {
      seeding = null;
      throw e;
    });
  }
  return seeding;
}

async function runSeed() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(products);
  if (count > 0) return;

  const rows: (typeof products.$inferInsert)[] = [];
  let order = 0;
  for (const spirit of Object.keys(PRICES)) {
    for (const flavour of FLAVOURS) {
      for (const size of SIZES) {
        const name = `${flavour} ${spirit} ${size}ml`;
        order++;
        rows.push({
          slug: slugify(name),
          name,
          spirit,
          flavour,
          sizeMl: size,
          priceKsh: PRICES[spirit][size],
          stockQty: 12 + ((order * 7) % 25),
          lowStockAt: 6,
          pointsMultiplier: spirit === "Whisky" && flavour === "Honey" ? 2 : 1,
          abv: ABV[spirit],
          brand: "Jay's Select",
          description: `${flavour}-infused ${spirit.toLowerCase()} in a ${size}ml bottle. Smooth, easy to mix and made for sharing. Dummy listing until the supplier price list is confirmed.`,
          featured: FEATURED.has(name),
          sortOrder: order,
          seoTitle: `${name} – delivered in Kiamunyi, Nakuru | Jay's`,
        });
      }
    }
  }
  await db.insert(products).values(rows).onConflictDoNothing();

  await db.insert(deliveryZones).values([
    { name: "Zone 1", areas: "Kiamunyi and nearby estates", feeKsh: 100, targetMinutes: 30, podAllowed: true, sortOrder: 1 },
    { name: "Zone 2", areas: "London, Barut, Milimani, Kabarak", feeKsh: 150, targetMinutes: 45, podAllowed: true, sortOrder: 2 },
    { name: "Zone 3", areas: "Nakuru CBD, Racecourse, Section 58", feeKsh: 200, targetMinutes: 60, podAllowed: false, sortOrder: 3 },
    { name: "Zone 4", areas: "Lanet, Free Area, Pipeline and beyond", feeKsh: 300, targetMinutes: 75, podAllowed: false, sortOrder: 4 },
  ]);

  const rs = await db
    .insert(riders)
    .values([
      { name: "Brian (Rider)", phone: "254711000001", transport: "Motorbike" },
      { name: "Kevin (Rider)", phone: "254711000002", transport: "Motorbike" },
    ])
    .returning();

  const ownerPw = process.env.ADMIN_PASSWORD || "jays-owner-2026";
  await db.insert(adminUsers).values([
    { username: "owner", name: "Jay (Owner)", passwordHash: hashPassword(ownerPw), role: "owner" },
    { username: "attendant", name: "Shop Attendant", passwordHash: hashPassword("attendant-2026"), role: "attendant" },
    { username: "rider", name: rs[0].name, passwordHash: hashPassword("rider-2026"), role: "rider", riderId: rs[0].id },
  ]);

  await db.insert(rewardRules).values([
    { name: "10 × 750ml bottles", kind: "bottles", threshold: 10, sizeMl: 750, rewardType: "cash", rewardValue: 350, rewardLabel: "Free 200ml of your choice (KSh 350 voucher)" },
    { name: "Spend KSh 5,000 in a month", kind: "spend_month", threshold: 5000, rewardType: "free_delivery", rewardValue: 0, rewardLabel: "Free Zone 1–2 delivery voucher" },
    { name: "5 bottles of any size", kind: "bottles", threshold: 5, rewardType: "cash", rewardValue: 150, rewardLabel: "Free 100ml (KSh 150 voucher)" },
  ]);

  const day = 86400000;
  const now = Date.now();
  const launch = await db
    .insert(campaigns)
    .values({
      slug: "launch",
      name: "Kiamunyi Launch Offer",
      type: "Product focus",
      startsAt: new Date(now - day),
      endsAt: new Date(now + 90 * day),
      offerType: "percent",
      offerValue: 10,
      minSpend: 500,
      usageLimitPerPhone: 1,
      freeDeliveryAbove: 2000,
      headline: "10% off your first order. Delivered from Kiamunyi.",
      bannerText: "Launch offer: 10% off orders from KSh 500",
      terms: "10% off product value on orders from KSh 500. One use per phone number. Free Zone 1–2 delivery on orders above KSh 2,000. Cannot be combined with other offers. 18+ only; ID checked on delivery.",
      promoCode: "JAYS10",
      featuredProductIds: "",
    })
    .returning();
  await db.insert(campaigns).values({
    slug: "xmas26",
    name: "Christmas 2026",
    type: "Holiday",
    startsAt: new Date("2026-12-15T00:00:00+03:00"),
    endsAt: new Date("2027-01-01T00:00:00+03:00"),
    offerType: "points",
    offerValue: 3,
    minSpend: 1000,
    headline: "Christmas at home? Triple points on every bottle.",
    bannerText: "Triple points this Christmas",
    bannerColor: "rose",
    terms: "Earn 3x points on orders from KSh 1,000 between 15 Dec 2026 and 1 Jan 2027. Points credited on delivery.",
    promoCode: "XMAS26",
  });
  await db.insert(qrCodes).values([
    { campaignId: launch[0].id, code: "launch-shop", label: "Shop counter poster" },
    { campaignId: launch[0].id, code: "launch-tiktok", label: "TikTok bio link" },
  ]);
  await db.insert(promoCodes).values({
    code: "TIKTOK10",
    ownerName: "TikTok creator – demo",
    offerType: "percent",
    offerValue: 10,
    minSpend: 500,
    usageLimitPerPhone: 1,
  });
}
