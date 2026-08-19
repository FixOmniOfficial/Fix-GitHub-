import { Router, type IRouter, type Request, type Response } from 'express';
import { eq, count, avg, isNotNull } from 'drizzle-orm';
import {
  db, customersTable, professionalsTable, bookingsTable, serviceCategoriesTable, appSettingsTable,
  authProfilesTable,
} from '@workspace/db';
import { sql } from 'drizzle-orm';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middlewares/requireAuth';
import { sendOtpEmail } from '../lib/email';
import { supabaseAdmin } from '../lib/supabase';
import bcrypt from 'bcryptjs';

const router: IRouter = Router();

// ─── Router-level auth safety net ─────────────────────────────────────────────
// Every /admin/* route requires at minimum a valid Supabase session.
// Path-scoped so this does NOT bleed into other routers mounted after this one.
// Individual routes add requireAdmin / requireSuperAdmin on top of this.
router.use('/admin', requireAuth);

// ─── Master Panel Access Guard ────────────────────────────────────────────────
// Checks panel_enabled flag before every admin route.
// Skips: panel-toggle (so super_admin can re-enable) + ensure-first-admin.
const PANEL_BYPASS_PATHS = new Set(['/admin/panel-toggle', '/admin/ensure-first-admin']);
router.use(async (req: Request, res: Response, next) => {
  if (PANEL_BYPASS_PATHS.has(req.path)) { next(); return; }
  try {
    const [settings] = await db.select({ panelEnabled: appSettingsTable.panelEnabled })
      .from(appSettingsTable).where(sql`id = 1`);
    if (settings?.panelEnabled === false) {
      res.status(503).json({ error: 'Admin panel is currently disabled by administrator' });
      return;
    }
    next();
  } catch { next(); } // fail open if DB unavailable
});

const VALID_ROLES = ['super_admin', 'admin', 'staff', 'technician', 'viewer'];
const STAFF_PERMISSIONS = ['booking_management', 'user_management', 'analytics', 'kyc_review'];
const STAFF_ROLES = new Set(['staff', 'sub_admin']);

// ─── Role hierarchy helpers ───────────────────────────────────────────────────
/** Returns true when `callerRole` outranks `targetRole` enough to mutate it. */
function canMutate(callerRole: string, targetRole: string): boolean {
  // super_admin can mutate anyone
  if (callerRole === 'super_admin') return true;
  // admin can mutate only non-super_admin targets
  if (callerRole === 'admin') return targetRole !== 'super_admin';
  return false;
}

/** Count how many auth_profiles currently hold super_admin role. */
async function countSuperAdmins(): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(authProfilesTable)
    .where(eq(authProfilesTable.role, 'super_admin'));
  return Number(rows[0]?.value ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS (admin panel)
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/admin/users — list all users with roles from auth_profiles */
router.get('/admin/users', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const profiles = await db.select().from(authProfilesTable);
    // Fetch email from Supabase auth for each profile
    const users = await Promise.all(profiles.map(async (p) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(p.id);
      const user = data?.user;
      const email = user?.email ?? null;
      const createdAt = user?.created_at ?? p.createdAt.toISOString();
      const lastSignInAt = user?.last_sign_in_at ?? null;
      const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? email ?? 'Unknown';
      const imageUrl = user?.user_metadata?.avatar_url ?? null;
      return {
        id: p.id,
        name,
        email,
        role: p.role,
        permissions: p.permissions,
        banned: !p.isActive,
        createdAt,
        lastSignInAt,
        imageUrl,
      };
    }));
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/** PATCH /api/admin/users/:id/role — set role */
router.patch('/admin/users/:id/role', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { role } = req.body as { role?: string };
  if (!role || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    return;
  }
  const callerCtx = req.supabaseContext!;
  const userId = callerCtx.supabaseUserId;
  const callerRole = callerCtx.supabaseRole;

  // Self-demotion guard
  if (id === userId && role !== 'admin' && role !== 'super_admin') {
    res.status(400).json({ error: 'Cannot remove your own admin role' });
    return;
  }
  // Only super_admin can assign super_admin
  if (role === 'super_admin' && callerRole !== 'super_admin') {
    res.status(403).json({ error: 'Only Super Admin can assign the Super Admin role' });
    return;
  }
  try {
    const [target] = await db.select().from(authProfilesTable).where(eq(authProfilesTable.id, id)).limit(1);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const targetRole = target.role;
    // Hierarchy check: admin cannot mutate super_admin accounts
    if (!canMutate(callerRole, targetRole)) {
      res.status(403).json({ error: 'Insufficient privilege to change this user\'s role' });
      return;
    }
    // Prevent demoting the last super_admin
    if (targetRole === 'super_admin' && role !== 'super_admin') {
      const superCount = await countSuperAdmins();
      if (superCount <= 1) {
        res.status(400).json({ error: 'Cannot demote the only Super Admin' });
        return;
      }
    }
    await db
      .update(authProfilesTable)
      .set({ role })
      .where(eq(authProfilesTable.id, id));
    res.json({ success: true, role });
  } catch {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/** POST /api/admin/users/:id/ban — ban or unban a user */
router.post('/admin/users/:id/ban', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { ban } = req.body as { ban?: boolean };
  const userId = req.supabaseContext!.supabaseUserId;
  const callerRole = req.supabaseContext!.supabaseRole;
  if (id === userId) {
    res.status(400).json({ error: 'Cannot ban yourself' });
    return;
  }
  try {
    const [target] = await db.select().from(authProfilesTable).where(eq(authProfilesTable.id, id)).limit(1);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const targetRole = target.role;
    // Hierarchy check: admin cannot ban super_admin accounts
    if (!canMutate(callerRole, targetRole)) {
      res.status(403).json({ error: 'Insufficient privilege to ban this user' });
      return;
    }
    // Prevent banning the last super_admin
    if (targetRole === 'super_admin' && ban) {
      const superCount = await countSuperAdmins();
      if (superCount <= 1) {
        res.status(400).json({ error: 'Cannot ban the only Super Admin' });
        return;
      }
    }
    // Update auth_profiles is_active
    await db
      .update(authProfilesTable)
      .set({ isActive: !ban })
      .where(eq(authProfilesTable.id, id));
    // Update Supabase auth ban duration
    if (ban) {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        ban_duration: '876600h', // ~100 years
      });
    } else {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        ban_duration: 'none',
      });
    }
    res.json({ success: true, banned: !!ban });
  } catch {
    res.status(500).json({ error: 'Failed to update ban status' });
  }
});

/**
 * PATCH /api/admin/panel-toggle — super_admin turns the admin panel ON or OFF.
 * Body: { enabled: boolean }
 * This route is EXEMPT from the panel access guard (so super_admin can re-enable).
 */
router.patch('/admin/panel-toggle', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: '"enabled" (boolean) is required' });
    return;
  }
  try {
    await db.update(appSettingsTable).set({ panelEnabled: enabled }).where(sql`id = 1`);
    res.json({ panelEnabled: enabled, message: enabled ? 'Admin panel enabled' : 'Admin panel disabled' });
  } catch {
    res.status(500).json({ error: 'Failed to update panel status' });
  }
});

/**
 * POST /api/admin/ensure-first-admin
 *
 * Safely bootstraps the first super_admin with three guarantees:
 *
 * 1. BACKWARD-COMPATIBLE: On existing deployments that already have an
 *    admin/super_admin in auth_profiles, a sentinel ('__seeded__') is written to
 *    first_admin_claimed_by so no ordinary user can claim the slot on a
 *    subsequent login. This scan happens BEFORE any promotion attempt.
 *
 * 2. ATOMIC: The DB UPDATE WHERE id=1 AND first_admin_claimed_by IS NULL is
 *    evaluated by PostgreSQL against the singleton row with a row-level write
 *    lock; only one concurrent caller can flip NULL → non-NULL. All others
 *    receive empty RETURNING and skip promotion.
 *
 * 3. VERIFY-AFTER-CLAIM: After winning the DB race, we re-verify auth_profiles
 *    before promoting. If an admin appeared between our scan and our claim win,
 *    we relinquish by writing the sentinel — the caller is NOT promoted.
 */
router.post('/admin/ensure-first-admin', requireAuth, async (req: Request, res: Response) => {
  const userId = req.supabaseContext!.supabaseUserId;
  try {
    // ── PHASE 0: ensure the singleton settings row exists (id=1) ─────────────
    await db
      .insert(appSettingsTable)
      .values({ id: 1 } as any)
      .onConflictDoNothing({ target: appSettingsTable.id });

    // ── PHASE 1: short-circuit if already claimed ─────────────────────────────
    const [current] = await db
      .select({ firstAdminClaimedBy: appSettingsTable.firstAdminClaimedBy })
      .from(appSettingsTable)
      .where(sql`id = 1`);
    if (current?.firstAdminClaimedBy != null) {
      const [myProfile] = await db.select().from(authProfilesTable).where(eq(authProfilesTable.id, userId)).limit(1);
      const role = myProfile?.role ?? 'user';
      res.json({ promoted: false, role });
      return;
    }

    // ── PHASE 2: backward-compat scan (check auth_profiles for existing admins)
    // If ANY admin/super_admin already exists we seed the sentinel so
    // no future caller can claim the slot, then return without promoting.
    const existingAdmins = await db
      .select({ value: count() })
      .from(authProfilesTable)
      .where(sql`${authProfilesTable.role} IN ('admin', 'super_admin')`);
    const hasExistingAdmin = Number(existingAdmins[0]?.value ?? 0) > 0;

    if (hasExistingAdmin) {
      // Seed sentinel so this path is never re-entered on subsequent logins
      await db
        .update(appSettingsTable)
        .set({ firstAdminClaimedBy: '__seeded__' })
        .where(sql`id = 1 AND first_admin_claimed_by IS NULL`);
      const [myProfile] = await db.select().from(authProfilesTable).where(eq(authProfilesTable.id, userId)).limit(1);
      const role = myProfile?.role ?? 'user';
      res.json({ promoted: false, role });
      return;
    }

    // ── PHASE 3: atomic claim — only one concurrent caller wins ──────────────
    const claimed = await db
      .update(appSettingsTable)
      .set({ firstAdminClaimedBy: userId })
      .where(sql`id = 1 AND first_admin_claimed_by IS NULL`)
      .returning({ firstAdminClaimedBy: appSettingsTable.firstAdminClaimedBy });

    if (claimed.length === 0) {
      // Lost the race — another concurrent request claimed the slot
      const [myProfile] = await db.select().from(authProfilesTable).where(eq(authProfilesTable.id, userId)).limit(1);
      const role = myProfile?.role ?? 'user';
      res.json({ promoted: false, role });
      return;
    }

    // ── PHASE 4: verify-after-claim (admin may have appeared between phases 2-3)
    const adminsAfterClaim = await db
      .select({ value: count() })
      .from(authProfilesTable)
      .where(sql`${authProfilesTable.role} IN ('admin', 'super_admin') AND ${authProfilesTable.id} != ${userId}`);
    const adminAppearedAfterClaim = Number(adminsAfterClaim[0]?.value ?? 0) > 0;

    if (adminAppearedAfterClaim) {
      // An admin appeared between our scan and our claim — relinquish
      await db
        .update(appSettingsTable)
        .set({ firstAdminClaimedBy: '__seeded__' })
        .where(sql`id = 1`);
      const [myProfile] = await db.select().from(authProfilesTable).where(eq(authProfilesTable.id, userId)).limit(1);
      const role = myProfile?.role ?? 'user';
      res.json({ promoted: false, role });
      return;
    }

    // ── PHASE 5: promote — on DB failure, compensate by releasing the claim
    try {
      await db
        .update(authProfilesTable)
        .set({ role: 'super_admin' })
        .where(eq(authProfilesTable.id, userId));
    } catch (dbErr) {
      await db
        .update(appSettingsTable)
        .set({ firstAdminClaimedBy: null })
        .where(sql`id = 1`);
      throw dbErr;
    }

    res.json({ promoted: true, role: 'super_admin' });
  } catch {
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STAFF / SUB-ADMIN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/admin/staff — list all staff users from auth_profiles */
router.get('/admin/staff', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const profiles = await db
      .select()
      .from(authProfilesTable)
      .where(sql`${authProfilesTable.role} IN ('staff', 'sub_admin')`);

    const staff = await Promise.all(profiles.map(async (p) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(p.id);
      const user = data?.user;
      const email = user?.email ?? null;
      const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? email ?? 'Unknown';
      const imageUrl = user?.user_metadata?.avatar_url ?? null;
      return {
        id: p.id,
        name,
        email,
        role: p.role,
        permissions: p.permissions,
        banned: !p.isActive,
        createdAt: p.createdAt.toISOString(),
        lastSignInAt: user?.last_sign_in_at ?? null,
        imageUrl,
      };
    }));
    res.json(staff);
  } catch {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

/** POST /api/admin/staff — create a new staff account via Supabase admin */
router.post('/admin/staff', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, permissions = [] } = req.body as {
    firstName?: string; lastName?: string; email?: string; password?: string; permissions?: string[];
  };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  const validPerms = (permissions as string[]).filter((p) => STAFF_PERMISSIONS.includes(p));
  try {
    // Create Supabase auth user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: [firstName, lastName].filter(Boolean).join(' ') || email,
      },
    });
    if (error || !data.user) {
      res.status(400).json({ error: error?.message ?? 'Failed to create staff account' });
      return;
    }
    const newUserId = data.user.id;
    // Update or insert auth_profiles with staff role/permissions
    await db
      .insert(authProfilesTable)
      .values({
        id: newUserId,
        role: 'staff',
        permissions: validPerms,
        userType: 'admin',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: authProfilesTable.id,
        set: { role: 'staff', permissions: validPerms, userType: 'admin', isActive: true },
      });
    const name = [firstName, lastName].filter(Boolean).join(' ') || email;
    res.json({
      id: newUserId,
      name,
      email,
      role: 'staff',
      permissions: validPerms,
    });
  } catch (e: any) {
    const msg = e?.message || 'Failed to create staff account';
    res.status(400).json({ error: msg });
  }
});

/** PATCH /api/admin/staff/:id/permissions — update staff permissions (only staff/sub_admin targets) */
router.patch('/admin/staff/:id/permissions', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { permissions } = req.body as { permissions?: string[] };
  if (!Array.isArray(permissions)) {
    res.status(400).json({ error: 'permissions must be an array' });
    return;
  }
  const validPerms = permissions.filter((p) => STAFF_PERMISSIONS.includes(p));
  try {
    const [profile] = await db.select().from(authProfilesTable).where(eq(authProfilesTable.id, id)).limit(1);
    if (!profile) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const currentRole = profile.role;
    // Guard: only allow mutation on staff/sub_admin accounts
    if (!STAFF_ROLES.has(currentRole)) {
      res.status(403).json({ error: 'Target user is not a staff account' });
      return;
    }
    await db
      .update(authProfilesTable)
      .set({ permissions: validPerms })
      .where(eq(authProfilesTable.id, id));
    res.json({ success: true, permissions: validPerms });
  } catch {
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

/** DELETE /api/admin/staff/:id — remove staff account (only staff/sub_admin targets) */
router.delete('/admin/staff/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const userId = req.supabaseContext!.supabaseUserId;
  if (id === userId) { res.status(400).json({ error: 'Cannot delete yourself' }); return; }
  try {
    const [target] = await db.select().from(authProfilesTable).where(eq(authProfilesTable.id, id)).limit(1);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const targetRole = target.role;
    // Guard: only allow deletion of staff/sub_admin accounts through this endpoint
    if (!STAFF_ROLES.has(targetRole)) {
      res.status(403).json({ error: 'Target user is not a staff account' });
      return;
    }
    // Delete from auth_profiles first, then from Supabase auth
    await db.delete(authProfilesTable).where(eq(authProfilesTable.id, id));
    await supabaseAdmin.auth.admin.deleteUser(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete staff account' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CATEGORY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/admin/service-categories */
router.get('/admin/service-categories', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const cats = await db
      .select()
      .from(serviceCategoriesTable)
      .orderBy(serviceCategoriesTable.sortOrder, serviceCategoriesTable.id);
    res.json(cats);
  } catch {
    res.status(500).json({ error: 'Failed to fetch service categories' });
  }
});

/** POST /api/admin/service-categories */
router.post('/admin/service-categories', requireAuth, requireAdmin, async (req, res) => {
  const { name, icon, imageUrl, accent, professionType, sortOrder } = req.body as {
    name?: string; icon?: string; imageUrl?: string; accent?: string; professionType?: string; sortOrder?: number;
  };
  if (!name || !professionType) {
    res.status(400).json({ error: 'name and professionType are required' });
    return;
  }
  try {
    const [created] = await db
      .insert(serviceCategoriesTable)
      .values({
        name: name.trim(),
        icon: icon?.trim() || 'settings',
        imageUrl: imageUrl?.trim() || null,
        accent: accent?.trim() || '#6b7280',
        professionType: professionType.trim(),
        sortOrder: sortOrder ?? 0,
        isActive: true,
      })
      .returning();
    res.json(created);
  } catch {
    res.status(500).json({ error: 'Failed to create service category' });
  }
});

/** PATCH /api/admin/service-categories/:id */
router.patch('/admin/service-categories/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params['id']), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const { name, icon, imageUrl, accent, professionType, sortOrder, isActive } = req.body as {
    name?: string; icon?: string; imageUrl?: string | null; accent?: string; professionType?: string;
    sortOrder?: number; isActive?: boolean;
  };
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name.trim();
  if (icon !== undefined) updateData.icon = icon.trim();
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl?.trim() || null;
  if (accent !== undefined) updateData.accent = accent.trim();
  if (professionType !== undefined) updateData.professionType = professionType.trim();
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
  if (isActive !== undefined) updateData.isActive = isActive;
  try {
    const [updated] = await db
      .update(serviceCategoriesTable)
      .set(updateData)
      .where(eq(serviceCategoriesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: 'Category not found' }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update service category' });
  }
});

/** DELETE /api/admin/service-categories/:id */
router.delete('/admin/service-categories/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params['id']), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    await db.delete(serviceCategoriesTable).where(eq(serviceCategoriesTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete service category' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TECHNICIANS MANAGEMENT (admin panel → professionalsTable)
// ─────────────────────────────────────────────────────────────────────────────

function validateAdminPhone(phone: string): string | null {
  const clean = phone.trim().replace(/\D/g, '');
  if (clean.length !== 10) return 'Phone must be exactly 10 digits.';
  if (!/^[6-9]/.test(clean)) return 'Phone must start with 6, 7, 8, or 9 (Indian mobile).';
  return null; // valid
}

/** GET /api/admin/technicians — list all mobile technicians (incl. test data) */
router.get('/admin/technicians', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(professionalsTable).orderBy(professionalsTable.createdAt);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
});

/** POST /api/admin/technicians — create technician with strict validation */
router.post('/admin/technicians', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, phone, professionType, avatarEmoji, visitingCharge } = req.body;
    if (!name?.trim() || !professionType?.trim()) {
      res.status(400).json({ error: 'name and professionType are required' }); return;
    }
    if (phone?.trim()) {
      const err = validateAdminPhone(phone);
      if (err) { res.status(400).json({ error: err }); return; }
      const cleanPhone = phone.trim().replace(/\D/g, '');
      const dup = await db.select({ id: professionalsTable.id })
        .from(professionalsTable).where(eq(professionalsTable.phone, cleanPhone)).limit(1);
      if (dup.length) { res.status(409).json({ error: 'This mobile number is already registered.' }); return; }
    }
    // Generate unique TECH code
    let uniqueCode: string;
    for (;;) {
      const n = Math.floor(1000 + Math.random() * 9000);
      uniqueCode = `TECH-${n}`;
      const exists = await db.select({ id: professionalsTable.id })
        .from(professionalsTable).where(eq(professionalsTable.uniqueCode, uniqueCode)).limit(1);
      if (!exists.length) break;
    }
    const cleanPhone = phone?.trim() ? phone.trim().replace(/\D/g, '') : null;
    const [row] = await db.insert(professionalsTable).values({
      name: name.trim(), phone: cleanPhone, professionType: professionType.trim(),
      avatarEmoji: avatarEmoji?.trim() || '🔧',
      visitingCharge: visitingCharge ? String(visitingCharge) : null,
      uniqueCode,
    }).returning();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: 'Failed to create technician' });
  }
});

/** PATCH /api/admin/technicians/:id — update technician with strict phone validation */
router.patch('/admin/technicians/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params['id']), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const { name, phone, professionType, avatarEmoji, visitingCharge, isActive } = req.body;
    if (phone?.trim()) {
      const err = validateAdminPhone(phone);
      if (err) { res.status(400).json({ error: err }); return; }
      const cleanPhone = phone.trim().replace(/\D/g, '');
      const dup = await db.select({ id: professionalsTable.id })
        .from(professionalsTable)
        .where(sql`${professionalsTable.phone} = ${cleanPhone} AND ${professionalsTable.id} != ${id}`)
        .limit(1);
      if (dup.length) { res.status(409).json({ error: 'This mobile number is already registered to another technician.' }); return; }
    }
    const updates: Record<string, any> = {};
    if (name?.trim())        updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim() ? phone.trim().replace(/\D/g, '') : null;
    if (professionType?.trim()) updates.professionType = professionType.trim();
    if (avatarEmoji?.trim()) updates.avatarEmoji = avatarEmoji.trim();
    if (visitingCharge !== undefined) updates.visitingCharge = visitingCharge ? String(visitingCharge) : null;
    if (isActive !== undefined) updates.isActive = isActive;
    const [row] = await db.update(professionalsTable).set(updates).where(eq(professionalsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: 'Technician not found' }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: 'Failed to update technician' });
  }
});

/** DELETE /api/admin/technicians/:id */
router.delete('/admin/technicians/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params['id']), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    await db.execute(sql`DELETE FROM kyc_documents WHERE professional_id = ${id}`);
    await db.delete(professionalsTable).where(eq(professionalsTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete technician' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TECHNICIAN ADMIN RECOVERY TOOLS
// ─────────────────────────────────────────────────────────────────────────────

function genOtp6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function genTempPasscode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** POST /api/admin/technicians/:id/send-otp — Push a fresh email OTP to technician */
router.post('/admin/technicians/:id/send-otp', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params['id']), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const [row] = await db.select().from(professionalsTable).where(eq(professionalsTable.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: 'Technician not found' }); return; }
    if (!row.email) {
      res.status(400).json({ error: 'Technician का email registered नहीं है — पहले email add करें।' }); return;
    }

    const otp = genOtp6();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.update(professionalsTable)
      .set({ otpCode: otp, otpExpiresAt: expiresAt, otpAttempts: 0 } as any)
      .where(eq(professionalsTable.id, id));

    const { sent, demoOtp } = await sendOtpEmail({
      to: row.email,
      recipientName: row.name,
      otp,
      extraLines: [`🔑 Your Technician ID: <strong style="color:#a5b4fc;">${row.uniqueCode}</strong>`],
    });

    res.json({ success: true, sent, techName: row.name, techEmail: row.email, ...(demoOtp ? { demoOtp } : {}) });
  } catch (e) {
    console.error('send-otp error:', e);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

/** POST /api/admin/technicians/:id/temp-passcode — Generate 10-min temp passcode */
router.post('/admin/technicians/:id/temp-passcode', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params['id']), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const [row] = await db.select().from(professionalsTable).where(eq(professionalsTable.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: 'Technician not found' }); return; }

    const tempPasscode = genTempPasscode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await db.update(professionalsTable)
      .set({ tempPasscode, tempPasscodeExpiresAt: expiresAt } as any)
      .where(eq(professionalsTable.id, id));

    res.json({
      success: true,
      tempPasscode,
      expiresAt: expiresAt.toISOString(),
      techName: row.name,
      uniqueCode: row.uniqueCode,
      note: 'Technician को यह passcode दें। Login करने पर नया password set करना होगा।',
    });
  } catch {
    res.status(500).json({ error: 'Failed to generate temp passcode' });
  }
});

/** GET /api/admin/technicians/:id/tech-id — Recall/display Tech ID */
router.get('/admin/technicians/:id/tech-id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params['id']), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const [row] = await db.select({
      id: professionalsTable.id,
      name: professionalsTable.name,
      uniqueCode: professionalsTable.uniqueCode,
      phone: professionalsTable.phone,
      email: professionalsTable.email,
      professionType: professionalsTable.professionType,
    }).from(professionalsTable).where(eq(professionalsTable.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: 'Technician not found' }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: 'Failed to fetch tech ID' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OTP MODE TOGGLE — admin can switch between EMAIL and SMS delivery
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/admin/otp-mode — return current otpMode setting */
router.get('/admin/otp-mode', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [s] = await db.select({ otpMode: appSettingsTable.otpMode })
      .from(appSettingsTable).where(sql`id = 1`);
    res.json({ otpMode: s?.otpMode ?? 'EMAIL' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

/** PATCH /api/admin/otp-mode — set otpMode to "EMAIL" or "SMS" */
router.patch('/admin/otp-mode', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { mode } = req.body;
    if (mode !== 'EMAIL' && mode !== 'SMS') {
      res.status(400).json({ error: 'mode must be "EMAIL" or "SMS"' }); return;
    }
    await db.update(appSettingsTable).set({ otpMode: mode }).where(sql`id = 1`);
    res.json({ success: true, otpMode: mode });
  } catch { res.status(500).json({ error: 'Failed to update OTP mode' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/admin/analytics — real-time platform counts */
router.get('/admin/analytics', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [
      customersResult,
      techniciansResult,
      staffResult,
      bookingsResult,
      ratingsCountResult,
      avgRatingResult,
      activeCatsResult,
    ] = await Promise.all([
      db.select({ value: count() }).from(customersTable),
      db.select({ value: count() }).from(professionalsTable),
      db.select({ value: count() }).from(authProfilesTable)
        .where(sql`${authProfilesTable.role} IN ('staff', 'sub_admin')`),
      db.select({ value: count() }).from(bookingsTable),
      db.select({ value: count() }).from(bookingsTable).where(isNotNull(bookingsTable.rating)),
      db.execute(sql`SELECT COALESCE(AVG(CAST(rating AS NUMERIC)), 0) AS value FROM bookings WHERE rating IS NOT NULL AND rating ~ '^[0-9]+(\.[0-9]+)?$'`),
      db.select({ value: count() }).from(serviceCategoriesTable).where(eq(serviceCategoriesTable.isActive, true)),
    ]);

    const staffCount = Number(staffResult[0]?.value ?? 0);
    const avgRatingRaw = (avgRatingResult as any)?.rows?.[0]?.value ?? (avgRatingResult as any)?.[0]?.value;

    res.json({
      totalCustomers:   Number(customersResult[0]?.value ?? 0),
      totalTechnicians: Number(techniciansResult[0]?.value ?? 0),
      totalStaff:       staffCount,
      totalBookings:    Number(bookingsResult[0]?.value ?? 0),
      ratingsCount:     Number(ratingsCountResult[0]?.value ?? 0),
      avgRating:        avgRatingRaw ? parseFloat(String(avgRatingRaw)).toFixed(1) : '0.0',
      activeCategories: Number(activeCatsResult[0]?.value ?? 0),
    });
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
