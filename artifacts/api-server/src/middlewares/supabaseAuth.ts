import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { authProfilesTable, db } from "@workspace/db";
import { supabaseAdmin } from "../lib/supabase";

export type SupabaseRequestContext = {
  supabaseUserId: string;
  supabaseEmail: string | null;
  supabaseRole: string;
  supabasePermissions: string[];
  supabaseProfile: typeof authProfilesTable.$inferSelect;
};

declare global {
  namespace Express {
    interface Request {
      supabaseContext?: SupabaseRequestContext;
    }
  }
}

function getBearerToken(req: Request): string | null {
  const value = req.header("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim() || null;
}

export async function requireSupabaseAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Login required" });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    req.log?.warn({ error: error?.message }, "Rejected invalid Supabase access token");
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
    return;
  }

  const [profile] = await db
    .select()
    .from(authProfilesTable)
    .where(eq(authProfilesTable.id, data.user.id))
    .limit(1);

  if (!profile || !profile.isActive) {
    res.status(403).json({ error: "This account is not enabled for Fix Omni." });
    return;
  }

  req.supabaseContext = {
    supabaseUserId: data.user.id,
    supabaseEmail: data.user.email ?? null,
    supabaseRole: profile.role,
    supabasePermissions: profile.permissions,
    supabaseProfile: profile,
  };
  next();
}