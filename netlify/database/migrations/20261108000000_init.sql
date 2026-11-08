CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"rider_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_name" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'Holiday' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"offer_type" text DEFAULT 'percent' NOT NULL,
	"offer_value" integer DEFAULT 0 NOT NULL,
	"applies_to" text DEFAULT 'all' NOT NULL,
	"applies_value" text,
	"min_spend" integer DEFAULT 0 NOT NULL,
	"usage_limit_per_phone" integer DEFAULT 0 NOT NULL,
	"free_delivery_above" integer,
	"headline" text NOT NULL,
	"banner_text" text,
	"banner_color" text DEFAULT 'amber',
	"terms" text,
	"featured_product_ids" text DEFAULT '',
	"promo_code" text,
	"partner" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"zone_name" text,
	"tags" text DEFAULT '' NOT NULL,
	"first_source" text,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"top_buyer_consent" boolean DEFAULT false NOT NULL,
	"opted_out" boolean DEFAULT false NOT NULL,
	"last_order_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"areas" text NOT NULL,
	"fee_ksh" integer NOT NULL,
	"target_minutes" integer NOT NULL,
	"pod_allowed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'logged' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"spirit" text NOT NULL,
	"flavour" text NOT NULL,
	"size_ml" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" text NOT NULL,
	"customer_id" integer NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"fulfilment" text NOT NULL,
	"zone_id" integer,
	"zone_name" text,
	"landmark" text,
	"preferred_time" text,
	"notes" text,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"points_used" integer DEFAULT 0 NOT NULL,
	"voucher_discount" integer DEFAULT 0 NOT NULL,
	"voucher_code" text,
	"delivery_fee" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"bottles" integer DEFAULT 0 NOT NULL,
	"payment_method" text NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"rider_id" integer,
	"source" text DEFAULT 'Website' NOT NULL,
	"campaign_id" integer,
	"qr_code_id" integer,
	"promo_code" text,
	"offer_label" text,
	"age_confirmed" boolean DEFAULT false NOT NULL,
	"id_checked" boolean DEFAULT false NOT NULL,
	"stock_deducted" boolean DEFAULT false NOT NULL,
	"points_credited" boolean DEFAULT false NOT NULL,
	"is_new_customer" boolean DEFAULT false NOT NULL,
	"cancel_reason" text,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"method" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"checkout_request_id" text,
	"receipt" text,
	"result_desc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"order_id" integer,
	"points" integer NOT NULL,
	"type" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"spirit" text NOT NULL,
	"flavour" text NOT NULL,
	"size_ml" integer NOT NULL,
	"price_ksh" integer NOT NULL,
	"offer_price_ksh" integer,
	"offer_end" timestamp with time zone,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"low_stock_at" integer DEFAULT 6 NOT NULL,
	"points_multiplier" integer DEFAULT 1 NOT NULL,
	"abv" text,
	"brand" text,
	"description" text,
	"photo" text,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"owner_name" text,
	"campaign_id" integer,
	"offer_type" text DEFAULT 'percent' NOT NULL,
	"offer_value" integer DEFAULT 10 NOT NULL,
	"applies_to" text DEFAULT 'all' NOT NULL,
	"applies_value" text,
	"min_spend" integer DEFAULT 0 NOT NULL,
	"usage_limit_per_phone" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "qr_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"qr_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"visitor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'bottles' NOT NULL,
	"threshold" integer NOT NULL,
	"size_ml" integer,
	"spirit" text,
	"reward_type" text DEFAULT 'cash' NOT NULL,
	"reward_value" integer DEFAULT 0 NOT NULL,
	"reward_label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"transport" text DEFAULT 'Motorbike',
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"delta" integer NOT NULL,
	"type" text NOT NULL,
	"reason" text,
	"order_id" integer,
	"user_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "top_buyers_months" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"measure" text NOT NULL,
	"top_n" integer NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"entries" jsonb NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "top_buyers_months_month_unique" UNIQUE("month")
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"customer_id" integer NOT NULL,
	"phone" text NOT NULL,
	"type" text DEFAULT 'cash' NOT NULL,
	"value_ksh" integer DEFAULT 0 NOT NULL,
	"label" text NOT NULL,
	"rule_id" integer,
	"note" text,
	"redeemed_order_id" integer,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vouchers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "qr_scans_qr_idx" ON "qr_scans" USING btree ("qr_id");