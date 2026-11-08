import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  spirit: text("spirit").notNull(), // Vodka | Gin | Whisky
  flavour: text("flavour").notNull(), // Strawberry | Ginger | Pineapple | Honey
  sizeMl: integer("size_ml").notNull(),
  priceKsh: integer("price_ksh").notNull(),
  offerPriceKsh: integer("offer_price_ksh"),
  offerEnd: ts("offer_end"),
  stockQty: integer("stock_qty").notNull().default(0),
  lowStockAt: integer("low_stock_at").notNull().default(6),
  pointsMultiplier: integer("points_multiplier").notNull().default(1),
  abv: text("abv"),
  brand: text("brand"),
  description: text("description"),
  photo: text("photo"),
  featured: boolean("featured").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  seoTitle: text("seo_title"),
});

export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  areas: text("areas").notNull(),
  feeKsh: integer("fee_ksh").notNull(),
  targetMinutes: integer("target_minutes").notNull(),
  podAllowed: boolean("pod_allowed").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const riders = pgTable("riders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  transport: text("transport").default("Motorbike"),
  active: boolean("active").notNull().default(true),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // owner | attendant | rider
  riderId: integer("rider_id"),
  active: boolean("active").notNull().default(true),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(), // 2547XXXXXXXX
  name: text("name"),
  zoneName: text("zone_name"),
  tags: text("tags").notNull().default(""),
  firstSource: text("first_source"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  topBuyerConsent: boolean("top_buyer_consent").notNull().default(false),
  optedOut: boolean("opted_out").notNull().default(false),
  lastOrderAt: ts("last_order_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Holiday"),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  offerType: text("offer_type").notNull().default("percent"), // percent | fixed | free_delivery | points
  offerValue: integer("offer_value").notNull().default(0),
  appliesTo: text("applies_to").notNull().default("all"), // all | spirit | flavour | size
  appliesValue: text("applies_value"),
  minSpend: integer("min_spend").notNull().default(0),
  usageLimitPerPhone: integer("usage_limit_per_phone").notNull().default(0),
  freeDeliveryAbove: integer("free_delivery_above"),
  headline: text("headline").notNull(),
  bannerText: text("banner_text"),
  bannerColor: text("banner_color").default("amber"),
  terms: text("terms"),
  featuredProductIds: text("featured_product_ids").default(""),
  promoCode: text("promo_code"),
  partner: text("partner"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const qrCodes = pgTable("qr_codes", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const qrScans = pgTable(
  "qr_scans",
  {
    id: serial("id").primaryKey(),
    qrId: integer("qr_id").notNull(),
    campaignId: integer("campaign_id").notNull(),
    visitorId: text("visitor_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("qr_scans_qr_idx").on(t.qrId)],
);

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  ownerName: text("owner_name"), // TikTok creator / partner
  campaignId: integer("campaign_id"),
  offerType: text("offer_type").notNull().default("percent"),
  offerValue: integer("offer_value").notNull().default(10),
  appliesTo: text("applies_to").notNull().default("all"),
  appliesValue: text("applies_value"),
  minSpend: integer("min_spend").notNull().default(0),
  usageLimitPerPhone: integer("usage_limit_per_phone").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNo: text("order_no").notNull().unique(),
    customerId: integer("customer_id").notNull(),
    phone: text("phone").notNull(),
    name: text("name").notNull(),
    fulfilment: text("fulfilment").notNull(), // delivery | pickup
    zoneId: integer("zone_id"),
    zoneName: text("zone_name"),
    landmark: text("landmark"),
    preferredTime: text("preferred_time"),
    notes: text("notes"),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    pointsUsed: integer("points_used").notNull().default(0),
    voucherDiscount: integer("voucher_discount").notNull().default(0),
    voucherCode: text("voucher_code"),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    total: integer("total").notNull(),
    pointsEarned: integer("points_earned").notNull().default(0),
    bottles: integer("bottles").notNull().default(0),
    paymentMethod: text("payment_method").notNull(), // mpesa | pod
    paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid | paid | refunded
    status: text("status").notNull().default("received"), // received|paid|packed|out_for_delivery|delivered|cancelled|refunded
    riderId: integer("rider_id"),
    source: text("source").notNull().default("Website"),
    campaignId: integer("campaign_id"),
    qrCodeId: integer("qr_code_id"),
    promoCode: text("promo_code"),
    offerLabel: text("offer_label"),
    ageConfirmed: boolean("age_confirmed").notNull().default(false),
    idChecked: boolean("id_checked").notNull().default(false),
    stockDeducted: boolean("stock_deducted").notNull().default(false),
    pointsCredited: boolean("points_credited").notNull().default(false),
    isNewCustomer: boolean("is_new_customer").notNull().default(false),
    cancelReason: text("cancel_reason"),
    reminderSent: boolean("reminder_sent").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
    deliveredAt: ts("delivered_at"),
  },
  (t) => [index("orders_phone_idx").on(t.phone), index("orders_status_idx").on(t.status)],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  name: text("name").notNull(),
  spirit: text("spirit").notNull(),
  flavour: text("flavour").notNull(),
  sizeMl: integer("size_ml").notNull(),
  unitPrice: integer("unit_price").notNull(),
  qty: integer("qty").notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  method: text("method").notNull(), // stk | till | pod
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending | success | failed | review
  checkoutRequestId: text("checkout_request_id"),
  receipt: text("receipt"),
  resultDesc: text("result_desc"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const pointsLedger = pgTable("points_ledger", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  orderId: integer("order_id"),
  points: integer("points").notNull(),
  type: text("type").notNull(), // earn | redeem | expire | adjust | refund
  note: text("note"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const rewardRules = pgTable("reward_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("bottles"), // bottles | spend_month
  threshold: integer("threshold").notNull(),
  sizeMl: integer("size_ml"),
  spirit: text("spirit"),
  rewardType: text("reward_type").notNull().default("cash"), // cash | free_delivery
  rewardValue: integer("reward_value").notNull().default(0),
  rewardLabel: text("reward_label").notNull(),
  active: boolean("active").notNull().default(true),
});

export const vouchers = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  phone: text("phone").notNull(),
  type: text("type").notNull().default("cash"), // cash | free_delivery
  valueKsh: integer("value_ksh").notNull().default(0),
  label: text("label").notNull(),
  ruleId: integer("rule_id"),
  note: text("note"),
  redeemedOrderId: integer("redeemed_order_id"),
  redeemedAt: ts("redeemed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const topBuyersMonths = pgTable("top_buyers_months", {
  id: serial("id").primaryKey(),
  month: text("month").notNull().unique(), // YYYY-MM
  measure: text("measure").notNull(),
  topN: integer("top_n").notNull(),
  status: text("status").notNull().default("proposed"), // proposed | approved
  entries: jsonb("entries").notNull(),
  approvedAt: ts("approved_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  delta: integer("delta").notNull(),
  type: text("type").notNull(), // stock_in | adjustment | sale | cancel | count
  reason: text("reason"),
  orderId: integer("order_id"),
  userName: text("user_name"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  detail: text("detail"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  channel: text("channel").notNull().default("sms"),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("logged"), // logged | sent | failed
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: ts("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
});

export const enquiries = pgTable("enquiries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});
