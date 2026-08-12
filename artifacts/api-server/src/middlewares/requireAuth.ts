import { getAuth, clerkClient } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

/** Attaches userId to req; returns 401 if not signed in */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Login required' });
    return;
  }
  (req as any).clerkUserId = userId;
  next();
}

/**
 * Fetches the Clerk user and attaches clerkUserRole + clerkPermissions to req.
 * Use this after requireAuth on routes that need role/permission checks.
 */
export async function attachUserContext(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) { next(); return; }
  try {
    const user = await clerkClient.users.getUser(userId);
    (req as any).clerkUserRole    = (user.publicMetadata as any)?.role ?? 'user';
    (req as any).clerkPermissions = ((user.publicMetadata as any)?.permissions ?? []) as string[];
    next();
  } catch {
    next(); // non-fatal — downstream code should handle missing context
  }
}

/** Requires kyc_review permission, admin, or super_admin. Call after requireAuth. */
export async function requireKycReview(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: 'Login required' }); return; }
  try {
    const user = await clerkClient.users.getUser(userId);
    const role:  string   = (user.publicMetadata as any)?.role ?? 'user';
    const perms: string[] = (user.publicMetadata as any)?.permissions ?? [];
    if (role !== 'admin' && role !== 'super_admin' && !perms.includes('kyc_review')) {
      res.status(403).json({ error: 'KYC review permission required' });
      return;
    }
    (req as any).clerkUserRole    = role;
    (req as any).clerkPermissions = perms;
    next();
  } catch {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

/** Requires role === 'admin' OR 'super_admin' in publicMetadata. Call after requireAuth. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: 'Login required' }); return; }
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = (user.publicMetadata as any)?.role;
    if (role !== 'admin' && role !== 'super_admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    (req as any).clerkUserRole = role;
    next();
  } catch {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

/** Requires role === 'super_admin'. Call after requireAuth. */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: 'Login required' }); return; }
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = (user.publicMetadata as any)?.role;
    if (role !== 'super_admin') {
      res.status(403).json({ error: 'Super Admin access required' });
      return;
    }
    (req as any).clerkUserRole = role;
    next();
  } catch {
    res.status(500).json({ error: 'Auth check failed' });
  }
}
