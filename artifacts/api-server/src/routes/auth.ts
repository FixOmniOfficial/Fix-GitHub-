import { db, appUsersTable } from '@workspace/db';
import { eq, or } from 'drizzle-orm';
import { Router, type IRouter, type Request, type Response } from 'express';
import {
  hashPassword,
  verifyPassword,
  saveOtp,
  verifyOtp,
  createSession,
  clearSession,
  getSessionId,
  setSessionCookie,
  ensureDefaultAdmin,
  type CustomSessionUser,
} from '../lib/custom-auth';

const router: IRouter = Router();

// Seed default admin on startup
ensureDefaultAdmin().catch(console.error);

function toSessionUser(u: typeof appUsersTable.$inferSelect): CustomSessionUser {
  return { id: u.id, name: u.name, username: u.username, email: u.email, phone: u.phone, role: u.role };
}

// GET /api/auth/me
router.get('/auth/user', (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json({ user: null });
    return;
  }
  res.json({ user: req.user });
});

// POST /api/auth/login  { login, password }
router.post('/auth/login', async (req: Request, res: Response) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (!login || !password) {
    res.status(400).json({ error: 'Login और password दोनों जरूरी हैं' });
    return;
  }

  const [user] = await db.select().from(appUsersTable)
    .where(or(eq(appUsersTable.username, login), eq(appUsersTable.email, login)))
    .limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'User नहीं मिला या account बंद है' });
    return;
  }
  if (!user.passwordHash) {
    res.status(401).json({ error: 'Password set नहीं है। Admin से संपर्क करें।' });
    return;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Password गलत है' });
    return;
  }

  // Update last login
  await db.update(appUsersTable).set({ lastLoginAt: new Date() }).where(eq(appUsersTable.id, user.id));

  const sid = await createSession({ user: toSessionUser(user) });
  setSessionCookie(res, sid);
  res.json({ user: toSessionUser(user) });
});

// POST /api/auth/logout
router.post('/auth/logout', async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

// GET /api/logout (redirect-based for replit-auth-web compatibility)
router.get('/logout', async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect('/');
});

// POST /api/auth/send-otp  { login }  — forgot password
router.post('/auth/send-otp', async (req: Request, res: Response) => {
  const { login } = req.body as { login?: string };
  if (!login) {
    res.status(400).json({ error: 'Username या email दर्ज करें' });
    return;
  }

  const [user] = await db.select().from(appUsersTable)
    .where(or(eq(appUsersTable.username, login), eq(appUsersTable.email, login), eq(appUsersTable.phone, login)))
    .limit(1);

  if (!user || !user.isActive) {
    // Don't reveal if user exists
    res.json({ success: true, message: 'OTP भेजा गया (यदि account मिला)' });
    return;
  }

  const otp = await saveOtp(user.id, 'reset');

  // In production: send via SMS/WhatsApp/email
  // For now: return in response so admin/user can see it
  console.log(`[OTP] User "${user.username}" ka OTP: ${otp}`);

  res.json({
    success: true,
    userId: user.id,
    // In dev mode, expose OTP so it can be shown in UI
    otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    message: `OTP generate हुआ${user.phone ? ` (${user.phone} पर भेजा जाएगा)` : ''}`,
  });
});

// POST /api/auth/verify-otp  { userId, otp }
router.post('/auth/verify-otp', async (req: Request, res: Response) => {
  const { userId, otp } = req.body as { userId?: number; otp?: string };
  if (!userId || !otp) {
    res.status(400).json({ error: 'userId और OTP दोनों जरूरी हैं' });
    return;
  }

  const valid = await verifyOtp(userId, otp);
  if (!valid) {
    res.status(401).json({ error: 'OTP गलत है या expire हो गया' });
    return;
  }

  // Issue a temp token (re-use session) for password reset
  const [user] = await db.select().from(appUsersTable).where(eq(appUsersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: 'User नहीं मिला' }); return; }

  res.json({ success: true, userId: user.id });
});

// POST /api/auth/reset-password  { userId, newPassword }
router.post('/auth/reset-password', async (req: Request, res: Response) => {
  const { userId, newPassword } = req.body as { userId?: number; newPassword?: string };
  if (!userId || !newPassword) {
    res.status(400).json({ error: 'userId और newPassword जरूरी हैं' });
    return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: 'Password कम से कम 4 अक्षर का होना चाहिए' });
    return;
  }

  const hash = await hashPassword(newPassword);
  await db.update(appUsersTable).set({ passwordHash: hash }).where(eq(appUsersTable.id, userId));

  res.json({ success: true, message: 'Password बदल गया। अब login करें।' });
});

// POST /api/auth/change-password  { currentPassword, newPassword }  (for logged-in users)
router.post('/auth/change-password', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: 'Login करें पहले' }); return; }

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'दोनों passwords जरूरी हैं' }); return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: 'New password कम से कम 4 अक्षर का होना चाहिए' }); return;
  }

  const [user] = await db.select().from(appUsersTable).where(eq(appUsersTable.id, req.user.id)).limit(1);
  if (!user?.passwordHash) { res.status(400).json({ error: 'Password set नहीं है' }); return; }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) { res.status(401).json({ error: 'Current password गलत है' }); return; }

  const hash = await hashPassword(newPassword);
  await db.update(appUsersTable).set({ passwordHash: hash }).where(eq(appUsersTable.id, user.id));
  res.json({ success: true, message: 'Password बदल गया' });
});

export default router;
