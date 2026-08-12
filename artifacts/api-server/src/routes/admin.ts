import { Router, type IRouter, type Request, type Response } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { eq, count, avg, isNotNull } from 'drizzle-orm';
import {
  db, customersTable, professionalsTable, bookingsTable, serviceCategoriesTable, appSettingsTable,
} from '@workspace/db';
import { sql } from 'drizzle-orm';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middlewares/requireAuth';

const router: IRouter = Router();

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

/** Count how many Clerk users currently hold super_admin (exhaustive paginated scan). */
async function countSuperAdmins(): Promise<number> {
  let count = 0, offset = 0;
  const PAGE = 100;
  while (true) {
    const { data, totalCount } = await clerkClient.users.getUserList({ limit: PAGE, offset });
    count += data.filter((u) => (u.publicMetadata as any)?.role === 'super_admin').length;
    offset += PAGE;
    if (offset >= totalCount) break;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLERK USERS (existing admin panel)
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/admin/users — list all Clerk users with roles */
router.get('/admin/users', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const response = await clerkClient.users.getUserList({ limit: 100 });
    const users = response.data.map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.emailAddresses[0]?.emailAddress || 'Unknown',
      email: u.emailAddresses[0]?.emailAddress ?? null,
      role: (u.publicMetadata as any)?.role ?? 'user',
      permissions: (u.publicMetadata as any)?.permissions ?? [],
      banned: u.banned,
      createdAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
      imageUrl: u.imageUrl,
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
  const { userId } = getAuth(req);
  const callerRole = String((req as any).clerkUserRole ?? '');

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
    const target = await clerkClient.users.getUser(id);
    const targetRole = String((target.publicMetadata as any)?.role ?? 'user');
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
    await clerkClient.users.updateUserMetadata(id, { publicMetadata: { role } });
    res.json({ success: true, role });
  } catch {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/** POST /api/admin/users/:id/ban — ban or unban a user */
router.post('/admin/users/:id/ban', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { ban } = req.body as { ban?: boolean };
  const { userId } = getAuth(req);
  if (id === userId) {
    res.status(400).json({ error: 'Cannot ban yourself' });
    return;
  }
  const callerRole = String((req as any).clerkUserRole ?? '');
  try {
    const target = await clerkClient.users.getUser(id);
    const targetRole = String((target.publicMetadata as any)?.role ?? 'user');
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
    if (ban) {
      await clerkClient.users.banUser(id);
    } else {
      await clerkClient.users.unbanUser(id);
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
 *    admin/super_admin in Clerk, a sentinel ('__seeded__') is written to
 *    first_admin_claimed_by so no ordinary user can claim the slot on a
 *    subsequent login. This Clerk scan happens BEFORE any promotion attempt.
 *
 * 2. ATOMIC: The DB UPDATE WHERE id=1 AND first_admin_claimed_by IS NULL is
 *    evaluated by PostgreSQL against the singleton row with a row-level write
 *    lock; only one concurrent caller can flip NULL → non-NULL. All others
 *    receive empty RETURNING and skip promotion.
 *
 * 3. VERIFY-AFTER-CLAIM: After winning the DB race, we re-verify Clerk before
 *    promoting. If an admin appeared between our scan and our claim win, we
 *    relinquish by writing the sentinel — the caller is NOT promoted.
 */
router.post('/admin/ensure-first-admin', requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: 'Login required' }); return; }
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
      const me = await clerkClient.users.getUser(userId);
      const role = (me.publicMetadata as any)?.role ?? 'user';
      res.json({ promoted: false, role });
      return;
    }

    // ── PHASE 2: backward-compat scan (exhaustive paginated Clerk check) ──────
    // If ANY admin/super_admin already exists in Clerk we seed the sentinel so
    // no future caller can claim the slot, then return without promoting.
    let hasExistingAdmin = false;
    let offset = 0;
    const PAGE = 100;
    outer: while (true) {
      const { data: page, totalCount } = await clerkClient.users.getUserList({ limit: PAGE, offset });
      for (const u of page) {
        const r = (u.publicMetadata as any)?.role as string | undefined;
        if (r === 'admin' || r === 'super_admin') { hasExistingAdmin = true; break outer; }
      }
      offset += PAGE;
      if (offset >= totalCount) break;
    }

    if (hasExistingAdmin) {
      // Seed sentinel so this path is never re-entered on subsequent logins
      await db
        .update(appSettingsTable)
        .set({ firstAdminClaimedBy: '__seeded__' })
        .where(sql`id = 1 AND first_admin_claimed_by IS NULL`);
      const me = await clerkClient.users.getUser(userId);
      const role = (me.publicMetadata as any)?.role ?? 'user';
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
      const me = await clerkClient.users.getUser(userId);
      const role = (me.publicMetadata as any)?.role ?? 'user';
      res.json({ promoted: false, role });
      return;
    }

    // ── PHASE 4: verify-after-claim (admin may have appeared between phases 2-3)
    let adminAppearedAfterClaim = false;
    offset = 0;
    outer2: while (true) {
      const { data: page, totalCount } = await clerkClient.users.getUserList({ limit: PAGE, offset });
      for (const u of page) {
        if (u.id === userId) continue; // ignore ourselves (not yet promoted)
        const r = (u.publicMetadata as any)?.role as string | undefined;
        if (r === 'admin' || r === 'super_admin') { adminAppearedAfterClaim = true; break outer2; }
      }
      offset += PAGE;
      if (offset >= totalCount) break;
    }

    if (adminAppearedAfterClaim) {
      // An admin appeared between our scan and our claim — relinquish
      await db
        .update(appSettingsTable)
        .set({ firstAdminClaimedBy: '__seeded__' })
        .where(sql`id = 1`);
      const me = await clerkClient.users.getUser(userId);
      const role = (me.publicMetadata as any)?.role ?? 'user';
      res.json({ promoted: false, role });
      return;
    }

    // ── PHASE 5: promote — on Clerk failure, compensate by releasing the claim
    try {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: { role: 'super_admin' },
      });
    } catch (clerkErr) {
      await db
        .update(appSettingsTable)
        .set({ firstAdminClaimedBy: null })
        .where(sql`id = 1`);
      throw clerkErr;
    }

    res.json({ promoted: true, role: 'super_admin' });
  } catch {
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STAFF / SUB-ADMIN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/admin/staff — list all staff Clerk users */
router.get('/admin/staff', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { data: allUsers } = await clerkClient.users.getUserList({ limit: 200 });
    const staff = allUsers
      .filter((u) => {
        const r = (u.publicMetadata as any)?.role;
        return r === 'staff' || r === 'sub_admin';
      })
      .map((u) => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.emailAddresses[0]?.emailAddress || 'Unknown',
        email: u.emailAddresses[0]?.emailAddress ?? null,
        role: (u.publicMetadata as any)?.role ?? 'staff',
        permissions: ((u.publicMetadata as any)?.permissions ?? []) as string[],
        banned: u.banned,
        createdAt: u.createdAt,
        lastSignInAt: u.lastSignInAt,
        imageUrl: u.imageUrl,
      }));
    res.json(staff);
  } catch {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

/** POST /api/admin/staff — create a new staff Clerk account */
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
    const created = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
      firstName: firstName || '',
      lastName: lastName || '',
      publicMetadata: { role: 'staff', permissions: validPerms },
    });
    res.json({
      id: created.id,
      name: [created.firstName, created.lastName].filter(Boolean).join(' ') || email,
      email,
      role: 'staff',
      permissions: validPerms,
    });
  } catch (e: any) {
    const msg = e?.errors?.[0]?.message || 'Failed to create staff account';
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
    const user = await clerkClient.users.getUser(id);
    const currentRole = (user.publicMetadata as any)?.role as string | undefined;
    // Guard: only allow mutation on staff/sub_admin accounts
    if (!currentRole || !STAFF_ROLES.has(currentRole)) {
      res.status(403).json({ error: 'Target user is not a staff account' });
      return;
    }
    await clerkClient.users.updateUserMetadata(id, {
      publicMetadata: { role: currentRole, permissions: validPerms },
    });
    res.json({ success: true, permissions: validPerms });
  } catch {
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

/** DELETE /api/admin/staff/:id — remove staff account (only staff/sub_admin targets) */
router.delete('/admin/staff/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { userId } = getAuth(req);
  if (id === userId) { res.status(400).json({ error: 'Cannot delete yourself' }); return; }
  try {
    const target = await clerkClient.users.getUser(id);
    const targetRole = (target.publicMetadata as any)?.role as string | undefined;
    // Guard: only allow deletion of staff/sub_admin accounts through this endpoint
    if (!targetRole || !STAFF_ROLES.has(targetRole)) {
      res.status(403).json({ error: 'Target user is not a staff account' });
      return;
    }
    await clerkClient.users.deleteUser(id);
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
  const { name, icon, accent, professionType, sortOrder } = req.body as {
    name?: string; icon?: string; accent?: string; professionType?: string; sortOrder?: number;
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
        icon: icon?.trim() || '🔧',
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
  const { name, icon, accent, professionType, sortOrder, isActive } = req.body as {
    name?: string; icon?: string; accent?: string; professionType?: string;
    sortOrder?: number; isActive?: boolean;
  };
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name.trim();
  if (icon !== undefined) updateData.icon = icon.trim();
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
// ANALYTICS DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/admin/analytics — real-time platform counts */
router.get('/admin/analytics', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [
      customersResult,
      techniciansResult,
      allStaffUsers,
      bookingsResult,
      ratingsCountResult,
      avgRatingResult,
      activeCatsResult,
    ] = await Promise.all([
      db.select({ value: count() }).from(customersTable),
      db.select({ value: count() }).from(professionalsTable),
      clerkClient.users.getUserList({ limit: 200 }),
      db.select({ value: count() }).from(bookingsTable),
      db.select({ value: count() }).from(bookingsTable).where(isNotNull(bookingsTable.rating)),
      db.select({ value: avg(bookingsTable.rating) }).from(bookingsTable).where(isNotNull(bookingsTable.rating)),
      db.select({ value: count() }).from(serviceCategoriesTable).where(eq(serviceCategoriesTable.isActive, true)),
    ]);

    const staffCount = allStaffUsers.data.filter((u) => {
      const r = (u.publicMetadata as any)?.role;
      return r === 'staff' || r === 'sub_admin';
    }).length;

    const avgRatingRaw = avgRatingResult[0]?.value;

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
