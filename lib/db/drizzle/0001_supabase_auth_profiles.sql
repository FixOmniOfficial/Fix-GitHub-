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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auth_profiles_id_auth_users_fkey'
      AND conrelid = 'public.auth_profiles'::regclass
  ) THEN
    ALTER TABLE "auth_profiles"
      ADD CONSTRAINT "auth_profiles_id_auth_users_fkey"
      FOREIGN KEY ("id") REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auth_profiles ("id", "role", "permissions", "user_type")
  VALUES (NEW.id, 'user', '{}', COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer'))
  ON CONFLICT ("id") DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();