-- 0004_base_repair.sql
-- Idempotently brings a pre-migration production database up to the full
-- 0000_add_avatar_otp_mode schema.  Every statement is safe to re-run.

-- ── Missing tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "tech_payment_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "payment_id" integer NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "payment_method" text DEFAULT 'cash' NOT NULL,
  "paid_at" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tech_payment_entries_payment_id_tech_payments_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."tech_payments"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "kyc_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "professional_id" integer NOT NULL,
  "full_name" text NOT NULL,
  "email" text,
  "pan_card_path" text,
  "address_proof_path" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "reviewed_by" text,
  "reviewer_name" text,
  "review_notes" text,
  "reviewed_at" timestamp with time zone,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kyc_documents_professional_id_unique" UNIQUE("professional_id")
);

-- ── Missing columns: professionals ───────────────────────────────────────────

ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "rating" numeric(3, 1) DEFAULT '4.5';
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "shop_name" text;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "is_test_data" boolean DEFAULT false NOT NULL;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "otp_code" text;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "otp_expires_at" timestamp with time zone;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "otp_attempts" integer DEFAULT 0;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "temp_passcode" text;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "temp_passcode_expires_at" timestamp with time zone;

-- ── Missing columns: app_customers ───────────────────────────────────────────

ALTER TABLE "app_customers" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "app_customers" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "app_customers" ADD COLUMN IF NOT EXISTS "otp_code" text;
ALTER TABLE "app_customers" ADD COLUMN IF NOT EXISTS "otp_expires_at" timestamp with time zone;
ALTER TABLE "app_customers" ADD COLUMN IF NOT EXISTS "otp_attempts" integer DEFAULT 0;

-- ── Missing columns: app_settings ────────────────────────────────────────────

ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "app_name" text DEFAULT 'Fixomni App' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "app_logo_url" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "play_store_url" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "web_app_url" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "icon_technician" text DEFAULT '👤' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "icon_service_type" text DEFAULT '🛠️' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "icon_full_name" text DEFAULT '👤' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "icon_mobile_no" text DEFAULT '📞' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "icon_house_no" text DEFAULT '🏠' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "icon_select_floor" text DEFAULT '🏢' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "icon_full_address" text DEFAULT '🗺️' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "icon_gps" text DEFAULT '🎯' NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "first_admin_claimed_by" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "panel_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "otp_mode" text DEFAULT 'EMAIL' NOT NULL;

-- ── Missing columns: bookings ─────────────────────────────────────────────────

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "service_type" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "viewed_at" timestamp with time zone;

-- ── Missing columns: tech_customers ──────────────────────────────────────────

ALTER TABLE "tech_customers" ADD COLUMN IF NOT EXISTS "rating" text;

-- ── Missing columns: tech_reminders ──────────────────────────────────────────

ALTER TABLE "tech_reminders" ADD COLUMN IF NOT EXISTS "ringtone" text DEFAULT 'default';
ALTER TABLE "tech_reminders" ADD COLUMN IF NOT EXISTS "is_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "tech_reminders" ADD COLUMN IF NOT EXISTS "customer_name" text;
ALTER TABLE "tech_reminders" ADD COLUMN IF NOT EXISTS "customer_phone" text;

-- ── Normalize empty-string emails → NULL before adding UNIQUE ─────────────────

UPDATE "professionals" SET "email" = NULL WHERE "email" = '';
UPDATE "app_customers" SET "email" = NULL WHERE "email" = '';

-- ── Rename auto-named constraints to the expected explicit names ──────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_share_token_key'
      AND conrelid = 'public.customers'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_share_token_unique'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE "customers" RENAME CONSTRAINT "customers_share_token_key" TO "customers_share_token_unique";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'professionals_unique_code_key'
      AND conrelid = 'public.professionals'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'professionals_unique_code_unique'
      AND conrelid = 'public.professionals'::regclass
  ) THEN
    ALTER TABLE "professionals" RENAME CONSTRAINT "professionals_unique_code_key" TO "professionals_unique_code_unique";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_booking_uid_key'
      AND conrelid = 'public.bookings'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_booking_uid_unique'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE "bookings" RENAME CONSTRAINT "bookings_booking_uid_key" TO "bookings_booking_uid_unique";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_customers_unique_code_key'
      AND conrelid = 'public.app_customers'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_customers_unique_code_unique'
      AND conrelid = 'public.app_customers'::regclass
  ) THEN
    ALTER TABLE "app_customers" RENAME CONSTRAINT "app_customers_unique_code_key" TO "app_customers_unique_code_unique";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_professional_id_fkey'
      AND conrelid = 'public.bookings'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_professional_id_professionals_id_fk'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE "bookings" RENAME CONSTRAINT "bookings_professional_id_fkey" TO "bookings_professional_id_professionals_id_fk";
  END IF;
END $$;

-- ── Add missing unique constraints (email columns were just added above) ───────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'professionals_email_unique'
      AND conrelid = 'public.professionals'::regclass
  ) THEN
    ALTER TABLE "professionals" ADD CONSTRAINT "professionals_email_unique" UNIQUE("email");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'app_customers_email_unique'
      AND conrelid = 'public.app_customers'::regclass
  ) THEN
    ALTER TABLE "app_customers" ADD CONSTRAINT "app_customers_email_unique" UNIQUE("email");
  END IF;
END $$;

-- ── Ensure session index exists ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" USING btree ("expire");
