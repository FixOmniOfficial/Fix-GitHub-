#!/usr/bin/env node
/**
 * Applies the Supabase-specific SQL that cannot be represented by the Drizzle
 * schema alone (Auth foreign key, RLS policy, trigger, and partial indexes).
 *
 * The SQL is deliberately idempotent and runs before every API start. This
 * ensures a clean Supabase database has the authorization guarantees required
 * by the API before any user reconciliation is allowed.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error("SUPABASE_DB_URL is required to apply Supabase migrations.");
}

const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(directory, "../drizzle");
const migrations = [
  "0001_supabase_auth_profiles.sql",
  "0002_add_app_customer_test_data.sql",
  "0003_lock_down_public_schema.sql",
];
const baseMigration = "0000_add_avatar_otp_mode.sql";
const baseTables = [
  "customers",
  "appliances",
  "jobs",
  "highlights",
  "reminders",
  "app_users",
  "app_settings",
  "sessions",
  "users",
  "professionals",
  "bookings",
  "market_rates",
  "helpline_messages",
  "app_ratings",
  "service_categories",
  "home_config",
  "app_customers",
  "tech_form_configs",
  "tech_form_submissions",
  "tech_customers",
  "tech_reminders",
  "tech_payments",
  "tech_payment_entries",
  "kyc_documents",
];
const baseColumns = {
  customers: ["id", "serial_number", "name", "phone", "whatsapp_phone", "house_number", "floor_number", "address", "location", "visiting_amount", "dp_url", "notes", "share_token", "service_type", "created_at", "updated_at"],
  appliances: ["id", "customer_id", "type", "brand", "model", "serial_no", "purchase_date", "notes", "created_at", "updated_at"],
  jobs: ["id", "job_number", "customer_id", "appliance_id", "description", "status", "payment_status", "amount", "paid_amount", "technician_name", "scheduled_date", "completed_date", "is_highlighted", "is_number_highlighted", "created_at", "updated_at"],
  highlights: ["id", "job_id", "customer_id", "label", "color", "caption_size", "is_numbered", "is_ticked", "zoom_level", "created_at"],
  reminders: ["id", "customer_id", "job_id", "title", "description", "reminder_at", "is_active", "is_triggered", "created_at", "updated_at"],
  app_users: ["id", "name", "username", "email", "phone", "role", "permissions", "is_active", "password_hash", "otp_code", "otp_expires_at", "otp_type", "last_login_at", "created_at", "updated_at"],
  app_settings: ["id", "app_name", "app_logo_url", "play_store_url", "web_app_url", "shop_name", "logo_url", "global_wallpaper", "personal_wallpaper", "caption_size", "zoom_level", "theme", "language", "home_layout", "notifications_enabled", "icon_technician", "icon_service_type", "icon_full_name", "icon_mobile_no", "icon_house_no", "icon_select_floor", "icon_full_address", "icon_gps", "first_admin_claimed_by", "panel_enabled", "otp_mode", "created_at", "updated_at"],
  sessions: ["sid", "sess", "expire"],
  users: ["id", "email", "first_name", "last_name", "profile_image_url", "created_at", "updated_at"],
  professionals: ["id", "name", "profession_type", "phone", "email", "password_hash", "avatar_emoji", "avatar_url", "visiting_charge", "rating", "shop_name", "unique_code", "is_active", "is_test_data", "otp_code", "otp_expires_at", "otp_attempts", "temp_passcode", "temp_passcode_expires_at", "created_at", "updated_at"],
  bookings: ["id", "booking_uid", "customer_name", "phone", "whatsapp_phone", "house_number", "floor_number", "address", "location", "booking_time", "visiting_charge", "professional_id", "profession_type", "service_type", "status", "rating", "notes", "viewed_at", "created_at", "updated_at"],
  market_rates: ["id", "profession_type", "service_name", "rate", "unit", "created_at", "updated_at"],
  helpline_messages: ["id", "sender_type", "sender_name", "phone", "message", "is_resolved", "admin_reply", "created_at"],
  app_ratings: ["id", "rater_type", "rater_name", "rating", "comment", "created_at"],
  service_categories: ["id", "name", "icon", "accent", "profession_type", "sort_order", "is_active", "created_at", "updated_at"],
  home_config: ["id", "helpline_number", "helpline_name", "is_locked", "updated_at"],
  app_customers: ["id", "name", "phone", "email", "password_hash", "unique_code", "otp_code", "otp_expires_at", "otp_attempts", "created_at"],
  tech_form_configs: ["id", "professional_id", "default_visiting_charge", "custom_message", "is_active", "created_at", "updated_at"],
  tech_form_submissions: ["id", "professional_id", "tech_code", "customer_name", "phone", "full_address", "sector", "floor_number", "house_number", "location", "visiting_charge", "notes", "status", "created_at", "updated_at"],
  tech_customers: ["id", "tech_code", "name", "phone", "address", "job_type", "notes", "status", "rating", "created_at", "updated_at"],
  tech_reminders: ["id", "tech_code", "title", "note", "reminder_at", "ringtone", "is_enabled", "is_done", "customer_name", "customer_phone", "created_at"],
  tech_payments: ["id", "tech_code", "customer_name", "customer_phone", "job_description", "amount_billed", "amount_received", "status", "created_at", "updated_at"],
  tech_payment_entries: ["id", "payment_id", "amount", "payment_method", "paid_at", "note", "created_at"],
  kyc_documents: ["id", "professional_id", "full_name", "email", "pan_card_path", "address_proof_path", "status", "reviewed_by", "reviewer_name", "review_notes", "reviewed_at", "submitted_at", "updated_at"],
};
const baseConstraintNames = [
  ...baseTables.map((table) => `${table}_pkey`),
  "customers_share_token_unique",
  "jobs_job_number_unique",
  "app_users_username_unique",
  "users_email_unique",
  "professionals_email_unique",
  "professionals_unique_code_unique",
  "bookings_booking_uid_unique",
  "app_customers_email_unique",
  "app_customers_unique_code_unique",
  "kyc_documents_professional_id_unique",
  "bookings_professional_id_professionals_id_fk",
  "tech_payment_entries_payment_id_tech_payments_id_fk",
];
const baseIndexNames = ["IDX_session_expire"];

const client = new Client({
  connectionString,
  ssl: connectionString.includes("supabase.co")
    ? { rejectUnauthorized: false }
    : undefined,
});

function checksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

async function getAppliedMigration(filename, hash) {
  const existing = await client.query(
    `SELECT checksum
       FROM public.fixomni_schema_migrations
      WHERE filename = $1`,
    [filename],
  );
  if (!existing.rowCount) return false;
  if (existing.rows[0].checksum !== hash) {
    throw new Error(`Migration ${filename} changed after it was applied. Create a new migration instead.`);
  }
  console.log(`Supabase migration already applied: ${filename}`);
  return true;
}

async function recordMigration(filename, hash) {
  await client.query(
    `INSERT INTO public.fixomni_schema_migrations (filename, checksum)
     VALUES ($1, $2)`,
    [filename, hash],
  );
}

async function applyMigration(filename) {
  const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
  const hash = checksum(sql);
  if (await getAppliedMigration(filename, hash)) return;

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await recordMigration(filename, hash);
    await client.query("COMMIT");
    console.log(`Applied Supabase migration: ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`Failed Supabase migration ${filename}: ${error.message}`);
  }
}

async function baseSchemaProblems() {
  const columns = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [baseTables],
  );
  const actualColumns = new Map();
  for (const { table_name, column_name } of columns.rows) {
    const names = actualColumns.get(table_name) ?? new Set();
    names.add(column_name);
    actualColumns.set(table_name, names);
  }

  const constraints = await client.query(
    `SELECT conname
       FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
        AND conname = ANY($1::text[])`,
    [baseConstraintNames],
  );
  const actualConstraints = new Set(constraints.rows.map(({ conname }) => conname));
  const indexes = await client.query(
    `SELECT indexname
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])`,
    [baseIndexNames],
  );
  const actualIndexes = new Set(indexes.rows.map(({ indexname }) => indexname));

  const problems = [];
  for (const [table, requiredColumns] of Object.entries(baseColumns)) {
    const available = actualColumns.get(table);
    if (!available) {
      problems.push(`missing table public.${table}`);
      continue;
    }
    for (const column of requiredColumns) {
      if (!available.has(column)) problems.push(`missing column public.${table}.${column}`);
    }
  }
  for (const constraint of baseConstraintNames) {
    if (!actualConstraints.has(constraint)) problems.push(`missing base constraint ${constraint}`);
  }
  for (const index of baseIndexNames) {
    if (!actualIndexes.has(index)) problems.push(`missing base index ${index}`);
  }
  return problems;
}

async function establishBaseSchema() {
  const sql = await readFile(path.join(migrationsDirectory, baseMigration), "utf8");
  const hash = checksum(sql);
  const alreadyApplied = await getAppliedMigration(baseMigration, hash);
  const existingTables = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])`,
    [baseTables],
  );
  const problems = await baseSchemaProblems();
  if (alreadyApplied) {
    if (problems.length) {
      throw new Error(`Verified base schema has drifted: ${problems.join("; ")}`);
    }
    return;
  }
  if (existingTables.rowCount === 0) {
    await applyMigration(baseMigration);
    const afterBootstrapProblems = await baseSchemaProblems();
    if (!afterBootstrapProblems.length) return;
    throw new Error(`Base schema bootstrap was incomplete: ${afterBootstrapProblems.join("; ")}`);
  }
  if (problems.length) {
    throw new Error(
      `Supabase contains an incomplete Fix Omni base schema: ${problems.join("; ")}`,
    );
  }

  await client.query("BEGIN");
  try {
    await recordMigration(baseMigration, hash);
    await client.query("COMMIT");
    console.log(`Registered existing Supabase base schema: ${baseMigration}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

let migrationLockHeld = false;
try {
  await client.connect();
  await client.query("SELECT pg_advisory_lock(hashtext($1))", ["fixomni-supabase-migrations"]);
  migrationLockHeld = true;
  await client.query(
    `CREATE TABLE IF NOT EXISTS public.fixomni_schema_migrations (
      filename text PRIMARY KEY NOT NULL,
      checksum text NOT NULL,
      applied_at timestamp with time zone NOT NULL DEFAULT now()
    )`,
  );
  await establishBaseSchema();
  for (const filename of migrations) await applyMigration(filename);
} finally {
  if (migrationLockHeld) {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["fixomni-supabase-migrations"]).catch(() => {});
  }
  await client.end().catch(() => {});
}