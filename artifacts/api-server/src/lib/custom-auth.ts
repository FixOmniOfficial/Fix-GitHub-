import crypto from 'crypto';
import { db, sessionsTable, appUsersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';

export const SESSION_COOKIE = 'sid';
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
export const OTP_TTL = 10 * 60 * 1000; // 10 minutes

export interface CustomSessionUser {
  id: number;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: string;
}

export interface CustomSessionData {
  user: CustomSessionUser;
}

// ── Password helpers ──────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── OTP helpers ───────────────────────────────────────────────
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function saveOtp(userId: number, type: 'reset' | 'login'): Promise<string> {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL);
  await db.update(appUsersTable)
    .set({ otpCode: otp, otpExpiresAt: expiresAt, otpType: type })
    .where(eq(appUsersTable.id, userId));
  return otp;
}

export async function verifyOtp(userId: number, code: string): Promise<boolean> {
  const [user] = await db.select().from(appUsersTable).where(eq(appUsersTable.id, userId));
  if (!user || !user.otpCode || !user.otpExpiresAt) return false;
  if (user.otpCode !== code) return false;
  if (user.otpExpiresAt < new Date()) return false;
  // Clear OTP after use
  await db.update(appUsersTable)
    .set({ otpCode: null, otpExpiresAt: null, otpType: null })
    .where(eq(appUsersTable.id, userId));
  return true;
}

// ── Session helpers ───────────────────────────────────────────
export function getSessionId(req: Request): string | null {
  return (req.cookies?.[SESSION_COOKIE] as string) ?? null;
}

export async function createSession(data: CustomSessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString('hex');
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<CustomSessionData | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid));
  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }
  return row.sess as unknown as CustomSessionData;
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid: string | null): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL,
  });
}

// ── Seed default admin ────────────────────────────────────────
export async function ensureDefaultAdmin(): Promise<void> {
  const existing = await db.select({ id: appUsersTable.id })
    .from(appUsersTable)
    .where(eq(appUsersTable.username, 'admin'))
    .limit(1);
  if (existing.length > 0) return;

  const hash = await hashPassword('admin123');
  await db.insert(appUsersTable).values({
    name: 'Admin',
    username: 'admin',
    email: 'admin@servicecenter.local',
    role: 'admin',
    permissions: ['all'],
    isActive: true,
    passwordHash: hash,
  });
  console.log('[Auth] Default admin created → username: admin, password: admin123');
}
