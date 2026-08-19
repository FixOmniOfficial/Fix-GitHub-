#!/usr/bin/env node
/**
 * Reconciles legacy Fix Omni account records into Supabase.
 *
 * Source: DATABASE_URL (kept as the legacy rollback database)
 * Target: SUPABASE_DB_URL + Supabase Auth
 *
 * It is safe to run multiple times. Domain records are matched by stable
 * business identifiers, legacy bcrypt hashes are imported into Supabase Auth,
 * and active OTP / temporary passcode values are deliberately never copied.
 *
 * Optional:
 *   SUPABASE_BOOTSTRAP_SUPER_ADMIN_EMAIL=owner@example.com \
 *     pnpm --filter @workspace/api-server run reconcile:users
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceDbDirectory = path.resolve(scriptDirectory, "../../../lib/db");
const { Client } = require(
  require.resolve("pg", { paths: [workspaceDbDirectory] }),
);
const legacyUrl = process.env.DATABASE_URL;
const supabaseDbUrl = process.env.SUPABASE_DB_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const superAdminEmail = process.env.SUPABASE_BOOTSTRAP_SUPER_ADMIN_EMAIL
  ?.trim()
  .toLowerCase();

if (!legacyUrl || !supabaseDbUrl || !supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "DATABASE_URL, SUPABASE_DB_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

function normalizeSupabaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/(?:rest\/v1|auth\/v1)\/?$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function openPostgres(connectionString) {
  return new Client({
    connectionString,
    ssl: connectionString.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

function summary() {
  return {
    appUsers: { inserted: 0, updated: 0 },
    professionals: { inserted: 0, updated: 0 },
    customers: { inserted: 0, updated: 0 },
    authUsers: { created: 0, linked: 0 },
    profiles: { upserted: 0 },
    superAdmin: { invited: false, linked: false },
  };
}

async function hasId(target, table, id) {
  const result = await target.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

async function resolveTargetMatch(target, table, candidates) {
  const matchedIds = new Set();

  for (const { column, value } of candidates) {
    if (value === null || value === undefined || value === "") continue;
    const rows = await target.query(
      `SELECT id FROM ${table} WHERE lower(${column}) = lower($1)`,
      [String(value)],
    );
    if (rows.rowCount > 1) {
      throw new Error(`Ambiguous ${table}.${column} match for reconciliation.`);
    }
    if (rows.rowCount === 1) matchedIds.add(rows.rows[0].id);
  }

  if (matchedIds.size > 1) {
    throw new Error(`Conflicting ${table} identifiers point to different Supabase records.`);
  }
  return matchedIds.values().next().value ?? null;
}

function assertUniqueSourceAuthEmails(groups) {
  const owners = new Map();
  for (const { userType, rows } of groups) {
    for (const source of rows) {
      const email = source.email?.trim().toLowerCase();
      if (!email || !source.password_hash || source.is_active === false) continue;
      const owner = `${userType}:${source.id}`;
      const existing = owners.get(email);
      if (existing && existing !== owner) {
        throw new Error(`Legacy email ${email} belongs to multiple account types; resolve it manually before migration.`);
      }
      owners.set(email, owner);
    }
  }
}

async function reconcileAppUser(target, source, result) {
  const matchedId = await resolveTargetMatch(target, "app_users", [
    { column: "username", value: source.username },
    { column: "email", value: source.email },
  ]);
  const values = [
    source.name,
    source.username,
    source.email?.toLowerCase() ?? null,
    source.phone,
    source.role,
    source.permissions ?? [],
    source.is_active,
    source.password_hash,
    source.created_at,
    source.updated_at,
  ];

  if (matchedId) {
    const update = await target.query(
      `UPDATE app_users
          SET name = $1, username = $2, email = $3, phone = $4, role = $5,
              permissions = $6, is_active = $7, password_hash = $8,
              otp_code = NULL, otp_expires_at = NULL, otp_type = NULL,
              created_at = $9, updated_at = $10
        WHERE id = $11
      RETURNING id`,
      [...values, matchedId],
    );
    result.appUsers.updated += 1;
    return update.rows[0].id;
  }

  const useLegacyId = !(await hasId(target, "app_users", source.id));
  const insert = await target.query(
    useLegacyId
      ? `INSERT INTO app_users
          (id, name, username, email, phone, role, permissions, is_active, password_hash,
           otp_code, otp_expires_at, otp_type, last_login_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL, NULL, NULL, $10, $11)
         RETURNING id`
      : `INSERT INTO app_users
          (name, username, email, phone, role, permissions, is_active, password_hash,
           otp_code, otp_expires_at, otp_type, last_login_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NULL, NULL, NULL, $9, $10)
         RETURNING id`,
    useLegacyId ? [source.id, ...values] : values,
  );
  result.appUsers.inserted += 1;
  return insert.rows[0].id;
}

async function reconcileProfessional(target, source, result) {
  const matchedId = await resolveTargetMatch(target, "professionals", [
    { column: "unique_code", value: source.unique_code },
    { column: "email", value: source.email },
  ]);
  const values = [
    source.name,
    source.profession_type,
    source.phone,
    source.email?.toLowerCase() ?? null,
    source.password_hash,
    source.avatar_emoji,
    source.avatar_url,
    source.visiting_charge,
    source.rating,
    source.shop_name,
    source.unique_code,
    source.is_active,
    source.is_test_data ?? false,
    source.created_at,
    source.updated_at,
  ];

  if (matchedId) {
    const update = await target.query(
      `UPDATE professionals
          SET name = $1, profession_type = $2, phone = $3, email = $4,
              password_hash = $5, avatar_emoji = $6, avatar_url = $7,
              visiting_charge = $8, rating = $9, shop_name = $10, unique_code = $11,
              is_active = $12, is_test_data = $13, otp_code = NULL,
              otp_expires_at = NULL, otp_attempts = 0, temp_passcode = NULL,
              temp_passcode_expires_at = NULL, created_at = $14, updated_at = $15
        WHERE id = $16
      RETURNING id`,
      [...values, matchedId],
    );
    result.professionals.updated += 1;
    return update.rows[0].id;
  }

  const useLegacyId = !(await hasId(target, "professionals", source.id));
  const insert = await target.query(
    useLegacyId
      ? `INSERT INTO professionals
          (id, name, profession_type, phone, email, password_hash, avatar_emoji, avatar_url,
           visiting_charge, rating, shop_name, unique_code, is_active, is_test_data, otp_code,
           otp_expires_at, otp_attempts, temp_passcode, temp_passcode_expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 NULL, NULL, 0, NULL, NULL, $15, $16)
         RETURNING id`
      : `INSERT INTO professionals
          (name, profession_type, phone, email, password_hash, avatar_emoji, avatar_url,
           visiting_charge, rating, shop_name, unique_code, is_active, is_test_data, otp_code,
           otp_expires_at, otp_attempts, temp_passcode, temp_passcode_expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 NULL, NULL, 0, NULL, NULL, $14, $15)
         RETURNING id`,
    useLegacyId ? [source.id, ...values] : values,
  );
  result.professionals.inserted += 1;
  return insert.rows[0].id;
}

async function reconcileCustomer(target, source, result) {
  const matchedId = await resolveTargetMatch(target, "app_customers", [
    { column: "unique_code", value: source.unique_code },
    { column: "email", value: source.email },
  ]);
  const values = [
    source.name,
    source.phone,
    source.email?.toLowerCase() ?? null,
    source.password_hash,
    source.unique_code,
    source.is_test_data ?? false,
    source.created_at,
  ];

  if (matchedId) {
    const update = await target.query(
      `UPDATE app_customers
          SET name = $1, phone = $2, email = $3, password_hash = $4,
              unique_code = $5, is_test_data = $6, otp_code = NULL,
              otp_expires_at = NULL, otp_attempts = 0, created_at = $7
        WHERE id = $8
      RETURNING id`,
      [...values, matchedId],
    );
    result.customers.updated += 1;
    return update.rows[0].id;
  }

  const useLegacyId = !(await hasId(target, "app_customers", source.id));
  const insert = await target.query(
    useLegacyId
      ? `INSERT INTO app_customers
          (id, name, phone, email, password_hash, unique_code, is_test_data,
           otp_code, otp_expires_at, otp_attempts, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, 0, $8)
         RETURNING id`
      : `INSERT INTO app_customers
          (name, phone, email, password_hash, unique_code, is_test_data,
           otp_code, otp_expires_at, otp_attempts, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, 0, $7)
         RETURNING id`,
    useLegacyId ? [source.id, ...values] : values,
  );
  result.customers.inserted += 1;
  return insert.rows[0].id;
}

async function listAuthUsers(admin) {
  const byEmail = new Map();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list Supabase Auth users: ${error.message}`);
    for (const user of data.users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user);
    }
    if (data.users.length < 1000) break;
  }
  return byEmail;
}

async function ensureAuthUser(admin, authUsers, source, userType, result, createdAuthUserIds) {
  const email = source.email?.trim().toLowerCase();
  if (!email || !source.password_hash || source.is_active === false) return null;

  const existing = authUsers.get(email);
  if (existing) {
    result.authUsers.linked += 1;
    return existing;
  }

  const metadata = {
    full_name: source.name,
    phone: source.phone ?? undefined,
    userType,
    ...(userType === "technician" ? { professionType: source.profession_type } : {}),
  };
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password_hash: source.password_hash,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) {
    throw new Error(`Could not import Supabase Auth account for ${email}: ${error?.message ?? "unknown error"}`);
  }
  authUsers.set(email, data.user);
  createdAuthUserIds.push(data.user.id);
  result.authUsers.created += 1;
  return data.user;
}

async function getExistingProfile(target, authUserId) {
  const profile = await target.query(
    `SELECT role, permissions, user_type, app_user_id, professional_id, app_customer_id
       FROM auth_profiles
      WHERE id = $1`,
    [authUserId],
  );
  return profile.rows[0] ?? null;
}

async function assertProfileCanLink(target, authUserId, profile) {
  const existing = await getExistingProfile(target, authUserId);
  if (!existing) return null;

  const expectedLinks = {
    app_user_id: profile.appUserId,
    professional_id: profile.professionalId,
    app_customer_id: profile.appCustomerId,
  };
  for (const [column, existingId] of Object.entries({
    app_user_id: existing.app_user_id,
    professional_id: existing.professional_id,
    app_customer_id: existing.app_customer_id,
  })) {
    if (existingId !== null && existingId !== expectedLinks[column]) {
      throw new Error(`Supabase Auth profile ${authUserId} is already linked to a different ${column} record.`);
    }
  }
  return existing;
}

async function upsertProfile(target, authUserId, profile, result) {
  const existing = await assertProfileCanLink(target, authUserId, profile);
  const preserveSuperAdmin = existing?.role === "super_admin" && profile.role !== "super_admin";
  await target.query(
    `INSERT INTO auth_profiles
       (id, role, permissions, user_type, app_user_id, professional_id, app_customer_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       role = EXCLUDED.role,
       permissions = EXCLUDED.permissions,
       user_type = EXCLUDED.user_type,
       app_user_id = EXCLUDED.app_user_id,
       professional_id = EXCLUDED.professional_id,
       app_customer_id = EXCLUDED.app_customer_id,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()`,
    [
      authUserId,
      preserveSuperAdmin ? existing.role : profile.role,
      preserveSuperAdmin ? existing.permissions : profile.permissions,
      profile.userType,
      profile.appUserId,
      profile.professionalId,
      profile.appCustomerId,
      profile.isActive,
    ],
  );
  result.profiles.upserted += 1;
}

async function syncSequence(target, table) {
  const sequenceResult = await target.query(
    `SELECT pg_get_serial_sequence($1, 'id') AS sequence_name`,
    [table],
  );
  const sequenceName = sequenceResult.rows[0]?.sequence_name;
  if (!sequenceName) return;
  await target.query(
    `SELECT setval($1::regclass, COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`,
    [sequenceName],
  );
}

async function ensureRequestedSuperAdmin(admin, target, authUsers, result, createdAuthUserIds) {
  if (!superAdminEmail) return;
  let user = authUsers.get(superAdminEmail);
  if (!user) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(superAdminEmail, {
      data: { full_name: "Fix Omni Super Admin", userType: "admin" },
    });
    if (error || !data.user) {
      throw new Error(`Could not send Super Admin invitation: ${error?.message ?? "unknown error"}`);
    }
    user = data.user;
    authUsers.set(superAdminEmail, user);
    createdAuthUserIds.push(user.id);
    result.superAdmin.invited = true;
  }
  await upsertProfile(
    target,
    user.id,
    {
      role: "super_admin",
      permissions: ["all"],
      userType: "admin",
      appUserId: null,
      professionalId: null,
      appCustomerId: null,
      isActive: true,
    },
    result,
  );
  result.superAdmin.linked = true;
}

const legacy = openPostgres(legacyUrl);
const target = openPostgres(supabaseDbUrl);
const supabase = createClient(normalizeSupabaseUrl(supabaseUrl), serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const result = summary();

try {
  await legacy.connect();
  await target.connect();

  const appUsers = await legacy.query("SELECT * FROM app_users ORDER BY id");
  const professionals = await legacy.query("SELECT * FROM professionals ORDER BY id");
  const customers = await legacy.query("SELECT * FROM app_customers ORDER BY id");
  const authUsers = await listAuthUsers(supabase);
  assertUniqueSourceAuthEmails([
    { userType: "admin", rows: appUsers.rows },
    { userType: "technician", rows: professionals.rows },
    { userType: "customer", rows: customers.rows },
  ]);
  const createdAuthUserIds = [];

  await target.query("BEGIN");
  try {
    for (const source of appUsers.rows) {
      const appUserId = await reconcileAppUser(target, source, result);
      const authUser = await ensureAuthUser(supabase, authUsers, source, "admin", result, createdAuthUserIds);
      if (authUser) {
        await upsertProfile(target, authUser.id, {
          role: source.role,
          permissions: source.permissions ?? [],
          userType: "admin",
          appUserId,
          professionalId: null,
          appCustomerId: null,
          isActive: source.is_active,
        }, result);
      }
    }

    for (const source of professionals.rows) {
      const professionalId = await reconcileProfessional(target, source, result);
      const authUser = await ensureAuthUser(supabase, authUsers, source, "technician", result, createdAuthUserIds);
      if (authUser) {
        const priorProfile = await target.query(
          "SELECT role, permissions FROM auth_profiles WHERE id = $1",
          [authUser.id],
        );
        await upsertProfile(target, authUser.id, {
          role: priorProfile.rows[0]?.role ?? "user",
          permissions: priorProfile.rows[0]?.permissions ?? [],
          userType: "technician",
          appUserId: null,
          professionalId,
          appCustomerId: null,
          isActive: source.is_active,
        }, result);
      }
    }

    for (const source of customers.rows) {
      const appCustomerId = await reconcileCustomer(target, source, result);
      const authUser = await ensureAuthUser(supabase, authUsers, source, "customer", result, createdAuthUserIds);
      if (authUser) {
        const priorProfile = await target.query(
          "SELECT role, permissions FROM auth_profiles WHERE id = $1",
          [authUser.id],
        );
        await upsertProfile(target, authUser.id, {
          role: priorProfile.rows[0]?.role ?? "user",
          permissions: priorProfile.rows[0]?.permissions ?? [],
          userType: "customer",
          appUserId: null,
          professionalId: null,
          appCustomerId,
          isActive: true,
        }, result);
      }
    }

    await ensureRequestedSuperAdmin(supabase, target, authUsers, result, createdAuthUserIds);
    await syncSequence(target, "app_users");
    await syncSequence(target, "professionals");
    await syncSequence(target, "app_customers");
    await target.query("COMMIT");
  } catch (error) {
    await target.query("ROLLBACK");
    for (const userId of createdAuthUserIds) {
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
    }
    throw error;
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await legacy.end().catch(() => {});
  await target.end().catch(() => {});
}