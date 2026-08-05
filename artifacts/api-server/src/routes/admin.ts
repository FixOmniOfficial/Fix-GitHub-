import { Router, type IRouter, type Request, type Response } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { requireAuth, requireAdmin } from '../middlewares/requireAuth';

const router: IRouter = Router();

/** GET /api/admin/users — list all Clerk users with roles */
router.get('/admin/users', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const response = await clerkClient.users.getUserList({ limit: 100 });
    const users = response.data.map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.emailAddresses[0]?.emailAddress || 'Unknown',
      email: u.emailAddresses[0]?.emailAddress ?? null,
      role: (u.publicMetadata as any)?.role ?? 'user',
      banned: u.banned,
      createdAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
      imageUrl: u.imageUrl,
    }));
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/** PATCH /api/admin/users/:id/role — set role */
router.patch('/admin/users/:id/role', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body as { role?: string };
  if (!role || !['admin', 'technician', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'Invalid role. Must be admin, technician, or viewer.' });
    return;
  }
  // Prevent removing own admin role
  const { userId } = getAuth(req);
  if (id === userId && role !== 'admin') {
    res.status(400).json({ error: 'Admin cannot remove their own admin role' });
    return;
  }
  try {
    await clerkClient.users.updateUserMetadata(id, { publicMetadata: { role } });
    res.json({ success: true, role });
  } catch {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/** POST /api/admin/users/:id/ban — ban or unban a user */
router.post('/admin/users/:id/ban', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { ban } = req.body as { ban?: boolean };
  const { userId } = getAuth(req);
  if (id === userId) {
    res.status(400).json({ error: 'Cannot ban yourself' });
    return;
  }
  try {
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
 * POST /api/admin/ensure-first-admin
 * If no admin exists yet, promote the calling user to admin.
 * Safe to call on every login — idempotent.
 */
router.post('/admin/ensure-first-admin', requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: 'Login required' }); return; }

  try {
    const { data: allUsers } = await clerkClient.users.getUserList({ limit: 100 });
    const hasAdmin = allUsers.some((u) => (u.publicMetadata as any)?.role === 'admin');

    if (!hasAdmin) {
      // First user — make them admin
      await clerkClient.users.updateUserMetadata(userId, { publicMetadata: { role: 'admin' } });
      res.json({ promoted: true, role: 'admin' });
    } else {
      // Get calling user's current role
      const me = allUsers.find((u) => u.id === userId);
      const role = (me?.publicMetadata as any)?.role ?? 'user';
      res.json({ promoted: false, role });
    }
  } catch {
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

export default router;
