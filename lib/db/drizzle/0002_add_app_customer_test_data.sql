ALTER TABLE "app_customers"
  ADD COLUMN IF NOT EXISTS "is_test_data" boolean DEFAULT false NOT NULL;