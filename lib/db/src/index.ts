/**
 * Database connection — flexible adapter
 *
 * Priority order for connection string:
 *   1. SUPABASE_DB_URL  — Supabase direct PostgreSQL URL (add in Secrets to switch)
 *   2. DATABASE_URL     — Replit built-in / local PostgreSQL (default)
 *
 * To migrate to Supabase later:
 *   Add SUPABASE_DB_URL secret → Supabase project → Settings → Database → URI
 *   No code changes needed.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "[DB] No database connection configured. " +
    "Set DATABASE_URL (local) or SUPABASE_DB_URL (Supabase) in environment secrets."
  );
}

const dbSource = process.env.SUPABASE_DB_URL ? "Supabase" : "Local PostgreSQL";
console.log(`[DB] Connected to: ${dbSource}`);

export const pool = new Pool({
  connectionString,
  // Supabase requires SSL in production; local Replit does not — handle both
  ssl: process.env.SUPABASE_DB_URL
    ? { rejectUnauthorized: false }
    : undefined,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
