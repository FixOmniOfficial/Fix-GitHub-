CREATE TABLE IF NOT EXISTS "auth_profiles" (
  "id" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  "role" text NOT NULL DEFAULT 'user',
  "permissions" text[] NOT NULL DEFAULT '{}',
  "user_type" text NOT NULL DEFAULT 'admin',
  "app_user_id" integer,
  "professional_id" integer,
  "app_customer_id" integer,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_profiles_app_user_id_unique"
  ON "auth_profiles" ("app_user_id") WHERE "app_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_profiles_professional_id_unique"
  ON "auth_profiles" ("professional_id") WHERE "professional_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_profiles_app_customer_id_unique"
  ON "auth_profiles" ("app_customer_id") WHERE "app_customer_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "auth_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "Users can read their own auth profile" ON "auth_profiles";
CREATE POLICY "Users can read their own auth profile"
  ON "auth_profiles" FOR SELECT
  USING (auth.uid() = id);