import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type TopBuyerReward = { from: number; to: number; label: string; voucherKsh: number };

export type AppSettings = {
  minDelivery: number;
  deliveryOpen: string;
  deliveryClose: string;
  shopHoursText: string;
  podMaxKsh: number;
  pointsPerKsh: number; // 1 point per N KSh
  redeemKshPerPoint: number;
  minRedeemPoints: number;
  maxRedeemPct: number;
  pointsExpiryMonths: number;
  allowStacking: boolean;
  topBuyers: { measure: "spend" | "bottles"; topN: number; minOrders: number; rewards: TopBuyerReward[] };
  shop: {
    name: string;
    address: string;
    phone: string;
    whatsapp: string;
    tiktok: string;
    licence: string;
    mapQuery: string;
  };
};

export const DEFAULT_SETTINGS: AppSettings = {
  minDelivery: 500,
  deliveryOpen: "10:00",
  deliveryClose: "22:00",
  shopHoursText: "Mon–Sun, 10:00am – 10:00pm (dummy hours – confirm with licence)",
  podMaxKsh: 3000,
  pointsPerKsh: 100,
  redeemKshPerPoint: 1,
  minRedeemPoints: 100,
  maxRedeemPct: 30,
  pointsExpiryMonths: 6,
  allowStacking: false,
  topBuyers: {
    measure: "spend",
    topN: 3,
    minOrders: 3,
    rewards: [
      { from: 1, to: 1, label: "Free 750ml + KSh 500 voucher", voucherKsh: 1250 },
      { from: 2, to: 3, label: "Free 200ml of choice", voucherKsh: 300 },
      { from: 4, to: 10, label: "Double points next month", voucherKsh: 0 },
    ],
  },
  shop: {
    name: "Jay's Liquor Store",
    address: "Kiamunyi, Nakuru County (near Kiamunyi shopping centre)",
    phone: "0700 000 000",
    whatsapp: "254700000000",
    tiktok: "https://www.tiktok.com/@jaysliquorstore",
    licence: "Nakuru County Liquor Licence No. [to be added once issued]",
    mapQuery: "Kiamunyi, Nakuru, Kenya",
  },
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings).where(eq(settings.key, "app"));
  const v = (rows[0]?.value ?? {}) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...v,
    topBuyers: { ...DEFAULT_SETTINGS.topBuyers, ...(v.topBuyers ?? {}) },
    shop: { ...DEFAULT_SETTINGS.shop, ...(v.shop ?? {}) },
  };
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await db
    .insert(settings)
    .values({ key: "app", value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next } });
  return next;
}
