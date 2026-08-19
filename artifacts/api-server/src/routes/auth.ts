import { db, appUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { supabaseAdmin } from "../lib/supabase";

const router: IRouter = Router();

function publicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/**
 * Supabase's anon key is deliberately a public client key. Returning it here
 * lets the web and Expo clients work in all Replit preview paths without
 * embedding environment-specific URLs in their bundles.
 */
router.get("/auth/config", (_req: Request, res: Response): void => {
  const config = publicConfig();
  if (!config) {
    res.status(503).json({ error: "Supabase public configuration is unavailable." });
    return;
  }
  res.json(config);
});

function contextUser(req: Request) {
  const context = req.supabaseContext!;
  return {
    id: context.supabaseUserId,
    email: context.supabaseEmail,
    name: context.supabaseEmail?.split("@")[0] ?? "Fix Omni user",
    role: context.supabaseRole,
    permissions: context.supabasePermissions,
    userType: context.supabaseProfile.userType,
    appUserId: context.supabaseProfile.appUserId,
    professionalId: context.supabaseProfile.professionalId,
    appCustomerId: context.supabaseProfile.appCustomerId,
  };
}

/** Current Supabase identity plus the server-owned application role. */
router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = contextUser(req);
  if (user.appUserId) {
    const [appUser] = await db
      .select({ name: appUsersTable.name, username: appUsersTable.username, phone: appUsersTable.phone })
      .from(appUsersTable)
      .where(eq(appUsersTable.id, user.appUserId))
      .limit(1);
    if (appUser) Object.assign(user, appUser);
  }
  res.json({ user });
});

/** Compatibility envelope for callers that previously used /auth/user. */
router.get("/auth/user", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = contextUser(req);
  res.json({ user });
});

/**
 * Browser and Expo clients authenticate directly with Supabase.  Keeping this
 * endpoint explicitly unavailable prevents the retired cookie-login path from
 * silently creating a second authentication system.
 */
router.post("/auth/login", (_req: Request, res: Response): void => {
  res.status(410).json({ error: "Use Supabase Auth to sign in." });
});

router.post("/auth/logout", (_req: Request, res: Response): void => {
  res.json({ success: true });
});

/** Sends Supabase's standard password recovery email without revealing identity existence. */
router.post("/auth/send-password-reset", async (req: Request, res: Response): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  const config = publicConfig();
  if (!config) {
    res.status(503).json({ error: "Supabase configuration is unavailable." });
    return;
  }
  const redirectTo = req.body?.redirectTo;
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: typeof redirectTo === "string" ? redirectTo : undefined,
  });
  if (error) req.log?.warn({ error: error.message }, "Supabase password recovery request failed");
  res.json({ success: true, message: "If an account exists, a recovery email has been sent." });
});

/** A valid access token authorizes changing the password for that same identity. */
router.post("/auth/change-password", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    req.supabaseContext!.supabaseUserId,
    { password },
  );
  if (error) {
    req.log?.error({ error: error.message }, "Supabase password update failed");
    res.status(500).json({ error: "Could not update password." });
    return;
  }
  res.json({ success: true });
});

export default router;