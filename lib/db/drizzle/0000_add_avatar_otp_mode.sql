CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"serial_number" serial NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp_phone" text,
	"house_number" text,
	"floor_number" text,
	"address" text,
	"location" text,
	"visiting_amount" numeric(10, 2),
	"dp_url" text,
	"notes" text,
	"share_token" text,
	"service_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "appliances" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"type" text NOT NULL,
	"brand" text,
	"model" text,
	"serial_no" text,
	"purchase_date" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"appliance_id" integer,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"technician_name" text,
	"scheduled_date" text,
	"completed_date" text,
	"is_highlighted" boolean DEFAULT false NOT NULL,
	"is_number_highlighted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_job_number_unique" UNIQUE("job_number")
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"customer_id" integer,
	"label" text NOT NULL,
	"color" text DEFAULT '#f59e0b' NOT NULL,
	"caption_size" numeric(5, 2) DEFAULT '14' NOT NULL,
	"is_numbered" boolean DEFAULT false NOT NULL,
	"is_ticked" boolean DEFAULT false NOT NULL,
	"zoom_level" numeric(5, 2) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"job_id" integer,
	"title" text NOT NULL,
	"description" text,
	"reminder_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_triggered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"username" text,
	"email" text,
	"phone" text,
	"role" text DEFAULT 'technician' NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_hash" text,
	"otp_code" text,
	"otp_expires_at" timestamp with time zone,
	"otp_type" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_name" text DEFAULT 'Fixomni App' NOT NULL,
	"app_logo_url" text,
	"play_store_url" text,
	"web_app_url" text,
	"shop_name" text DEFAULT 'सर्विस सेंटर' NOT NULL,
	"logo_url" text,
	"global_wallpaper" text,
	"personal_wallpaper" text,
	"caption_size" numeric(5, 2) DEFAULT '1' NOT NULL,
	"zoom_level" numeric(5, 2) DEFAULT '1' NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL,
	"language" text DEFAULT 'both' NOT NULL,
	"home_layout" text,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"icon_technician" text DEFAULT '👤' NOT NULL,
	"icon_service_type" text DEFAULT '🛠️' NOT NULL,
	"icon_full_name" text DEFAULT '👤' NOT NULL,
	"icon_mobile_no" text DEFAULT '📞' NOT NULL,
	"icon_house_no" text DEFAULT '🏠' NOT NULL,
	"icon_select_floor" text DEFAULT '🏢' NOT NULL,
	"icon_full_address" text DEFAULT '🗺️' NOT NULL,
	"icon_gps" text DEFAULT '🎯' NOT NULL,
	"first_admin_claimed_by" text,
	"panel_enabled" boolean DEFAULT true NOT NULL,
	"otp_mode" text DEFAULT 'EMAIL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"profession_type" text NOT NULL,
	"phone" text,
	"email" text,
	"password_hash" text,
	"avatar_emoji" text DEFAULT '👤',
	"avatar_url" text,
	"visiting_charge" numeric(10, 2),
	"rating" numeric(3, 1) DEFAULT '4.5',
	"shop_name" text,
	"unique_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_test_data" boolean DEFAULT false NOT NULL,
	"otp_code" text,
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0,
	"temp_passcode" text,
	"temp_passcode_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professionals_email_unique" UNIQUE("email"),
	CONSTRAINT "professionals_unique_code_unique" UNIQUE("unique_code")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_uid" text NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp_phone" text,
	"house_number" text,
	"floor_number" text,
	"address" text,
	"location" text,
	"booking_time" timestamp with time zone,
	"visiting_charge" numeric(10, 2),
	"professional_id" integer,
	"profession_type" text NOT NULL,
	"service_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"rating" text,
	"notes" text,
	"viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_uid_unique" UNIQUE("booking_uid")
);
--> statement-breakpoint
CREATE TABLE "market_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"profession_type" text NOT NULL,
	"service_name" text NOT NULL,
	"rate" numeric(10, 2) NOT NULL,
	"unit" text DEFAULT 'per visit',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpline_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_type" text NOT NULL,
	"sender_name" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"admin_reply" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"rater_type" text NOT NULL,
	"rater_name" text,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'settings' NOT NULL,
	"accent" text DEFAULT '#6b7280' NOT NULL,
	"profession_type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"helpline_number" text DEFAULT '9999999999' NOT NULL,
	"helpline_name" text DEFAULT 'Admin Helpline' NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"password_hash" text,
	"unique_code" text NOT NULL,
	"otp_code" text,
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_customers_email_unique" UNIQUE("email"),
	CONSTRAINT "app_customers_unique_code_unique" UNIQUE("unique_code")
);
--> statement-breakpoint
CREATE TABLE "tech_form_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"professional_id" serial NOT NULL,
	"default_visiting_charge" numeric(10, 2) DEFAULT '0',
	"custom_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_form_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"professional_id" serial NOT NULL,
	"tech_code" text NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"full_address" text,
	"sector" text,
	"floor_number" text,
	"house_number" text,
	"location" text,
	"visiting_charge" numeric(10, 2),
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tech_code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"job_type" text,
	"notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"rating" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"tech_code" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"reminder_at" text,
	"ringtone" text DEFAULT 'default',
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tech_code" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"job_description" text,
	"amount_billed" numeric(10, 2) DEFAULT '0' NOT NULL,
	"amount_received" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_payment_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"paid_at" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_documents" (
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
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tech_payment_entries" ADD CONSTRAINT "tech_payment_entries_payment_id_tech_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."tech_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");