import type { Request, Response, NextFunction } from 'express';
import { requireSupabaseAuth } from "./supabaseAuth";

/** Attaches Supabase identity and Fix Omni role context to the request. */
export const requireAuth = requireSupabaseAuth;

/** Kept for existing routes; context is already loaded by requireAuth. */
export function attachUserContext(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

/** Requires kyc_review permission, admin, or super_admin. */
export function requireKycReview(req: Request, res: Response, next: NextFunction): void {
  const context = req.supabaseContext;
  if (!context) {
    res.status(401).json({ error: "Login required" });
    return;
  }
  if (
    context.supabaseRole !== "admin" &&
    context.supabaseRole !== "super_admin" &&
    !context.supabasePermissions.includes("kyc_review")
  ) {
    res.status(403).json({ error: "KYC review permission required" });
    return;
  }
  next();
}

/** Requires an administrator role. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = req.supabaseContext?.supabaseRole;
  if (role !== "admin" && role !== "super_admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

/** Requires the super administrator role. */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.supabaseContext?.supabaseRole !== "super_admin") {
    res.status(403).json({ error: "Super Admin access required" });
    return;
  }
  next();
}

/** Requires a Supabase identity linked to a technician record. */
export function requireLinkedTechnician(req: Request, res: Response, next: NextFunction): void {
  if (!req.supabaseContext) {
    res.status(401).json({ error: "Login required" });
    return;
  }
  if (!req.supabaseContext.supabaseProfile.professionalId) {
    res.status(403).json({ error: "Technician account required" });
    return;
  }
  next();
}

/** Allows uploads only for an administrator or a Supabase-linked technician. */
export function requireUploadActor(req: Request, res: Response, next: NextFunction): void {
  const role = req.supabaseContext?.supabaseRole;
  if (role === "admin" || role === "super_admin") {
    next();
    return;
  }
  requireLinkedTechnician(req, res, next);
}
