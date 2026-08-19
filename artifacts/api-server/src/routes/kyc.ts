/**
 * KYC Routes
 *
 * Technician-facing (Supabase Auth identity linked to the technician record):
 *   GET  /api/kyc/status           — check own KYC status
 *   POST /api/kyc/submit           — submit / re-submit KYC
 *
 * Admin-facing (Supabase auth, requires kyc_review permission):
 *   GET    /api/admin/kyc          — list all KYC submissions
 *   GET    /api/admin/kyc/:id      — get one submission
 *   PATCH  /api/admin/kyc/:id/review — approve or reject
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, kycDocumentsTable, professionalsTable } from "@workspace/db";
import { requireAuth, requireKycReview, requireLinkedTechnician } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ── Technician auth helper ────────────────────────────────────────────────────
// The professional ID is loaded server-side from the verified Supabase profile.
async function resolveTechnician(req: Request): Promise<typeof professionalsTable.$inferSelect | null> {
  const professionalId = req.supabaseContext?.supabaseProfile.professionalId;
  if (!professionalId) return null;
  const [prof] = await db
    .select()
    .from(professionalsTable)
    .where(eq(professionalsTable.id, professionalId));
  return prof ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICIAN — GET /api/kyc/status
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/kyc/status", requireAuth, requireLinkedTechnician, async (req: Request, res: Response): Promise<void> => {
  const tech = await resolveTechnician(req);
  if (!tech) { res.status(403).json({ error: "Technician identity is unavailable" }); return; }
  const [doc] = await db
    .select()
    .from(kycDocumentsTable)
    .where(eq(kycDocumentsTable.professionalId, tech.id));
  if (!doc) {
    res.json({ status: "not_submitted", kycDoc: null });
    return;
  }
  res.json({
    status: doc.status,
    kycDoc: {
      id:               doc.id,
      fullName:         doc.fullName,
      email:            doc.email,
      panCardPath:      doc.panCardPath,
      addressProofPath: doc.addressProofPath,
      status:           doc.status,
      reviewNotes:      doc.reviewNotes,
      reviewerName:     doc.reviewerName,
      submittedAt:      doc.submittedAt,
      reviewedAt:       doc.reviewedAt,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICIAN — POST /api/kyc/submit
// Body: { fullName, email?, panCardPath?, addressProofPath? }
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/kyc/submit", requireAuth, requireLinkedTechnician, async (req: Request, res: Response): Promise<void> => {
  const tech = await resolveTechnician(req);
  if (!tech) { res.status(403).json({ error: "Technician identity is unavailable" }); return; }

  const { fullName, email, panCardPath, addressProofPath } = req.body as {
    fullName?: string; email?: string; panCardPath?: string; addressProofPath?: string;
  };
  if (!fullName?.trim()) { res.status(400).json({ error: "fullName is required" }); return; }

  try {
    const existing = await db
      .select({ id: kycDocumentsTable.id })
      .from(kycDocumentsTable)
      .where(eq(kycDocumentsTable.professionalId, tech.id));

    if (existing.length > 0) {
      // Re-submission — reset to pending
      const [updated] = await db
        .update(kycDocumentsTable)
        .set({
          fullName: fullName.trim(),
          email: email?.trim() || null,
          panCardPath: panCardPath || undefined,
          addressProofPath: addressProofPath || undefined,
          status: "pending",
          reviewedBy: null,
          reviewerName: null,
          reviewNotes: null,
          reviewedAt: null,
          submittedAt: new Date(),
        })
        .where(eq(kycDocumentsTable.professionalId, tech.id))
        .returning();
      res.json({ success: true, kyc: updated });
    } else {
      const [created] = await db
        .insert(kycDocumentsTable)
        .values({
          professionalId:   tech.id,
          fullName:         fullName.trim(),
          email:            email?.trim() || null,
          panCardPath:      panCardPath || null,
          addressProofPath: addressProofPath || null,
          status:           "pending",
        })
        .returning();
      res.json({ success: true, kyc: created });
    }
  } catch {
    res.status(500).json({ error: "Failed to submit KYC" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — GET /api/admin/kyc  (list all submissions)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/admin/kyc", requireAuth, requireKycReview, async (req: Request, res: Response): Promise<void> => {
  const { status } = req.query as { status?: string };
  try {
    const rows = await db
      .select({
        kyc:  kycDocumentsTable,
        tech: {
          id:             professionalsTable.id,
          name:           professionalsTable.name,
          professionType: professionalsTable.professionType,
          phone:          professionalsTable.phone,
          uniqueCode:     professionalsTable.uniqueCode,
          avatarEmoji:    professionalsTable.avatarEmoji,
        },
      })
      .from(kycDocumentsTable)
      .innerJoin(professionalsTable, eq(kycDocumentsTable.professionalId, professionalsTable.id))
      .orderBy(desc(kycDocumentsTable.submittedAt));

    const filtered = status && status !== "all"
      ? rows.filter(r => r.kyc.status === status)
      : rows;

    res.json(filtered.map(r => ({ ...r.kyc, tech: r.tech })));
  } catch {
    res.status(500).json({ error: "Failed to fetch KYC list" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — GET /api/admin/kyc/:id  (single submission)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/admin/kyc/:id", requireAuth, requireKycReview, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [row] = await db
      .select({ kyc: kycDocumentsTable, tech: professionalsTable })
      .from(kycDocumentsTable)
      .innerJoin(professionalsTable, eq(kycDocumentsTable.professionalId, professionalsTable.id))
      .where(eq(kycDocumentsTable.id, id));
    if (!row) { res.status(404).json({ error: "KYC submission not found" }); return; }
    res.json({ ...row.kyc, tech: row.tech });
  } catch {
    res.status(500).json({ error: "Failed to fetch KYC submission" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — PATCH /api/admin/kyc/:id/review  (approve or reject)
// Body: { action: "verified"|"rejected", notes? }
// ═══════════════════════════════════════════════════════════════════════════════
router.patch("/admin/kyc/:id/review", requireAuth, requireKycReview, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { action, notes } = req.body as { action?: string; notes?: string };
  if (action !== "verified" && action !== "rejected") {
    res.status(400).json({ error: "action must be 'verified' or 'rejected'" });
    return;
  }

  // Use Supabase context for reviewer identity — no Clerk needed
  const ctx = req.supabaseContext!;
  const userId = ctx.supabaseUserId;
  const reviewerName = ctx.supabaseEmail ?? "Admin";

  try {
    const [updated] = await db
      .update(kycDocumentsTable)
      .set({
        status:       action,
        reviewedBy:   userId,
        reviewerName,
        reviewNotes:  notes?.trim() || null,
        reviewedAt:   new Date(),
      })
      .where(eq(kycDocumentsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "KYC submission not found" }); return; }
    res.json({ success: true, kyc: updated });
  } catch {
    res.status(500).json({ error: "Failed to update KYC status" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICIAN — POST /api/kyc/revoke
// Called when a verified technician changes their profile name.
// Resets their KYC status to "not_submitted" so they must re-verify.
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/kyc/revoke", requireAuth, requireLinkedTechnician, async (req: Request, res: Response): Promise<void> => {
  const professionalId = req.supabaseContext!.supabaseProfile.professionalId!;
  try {
    await db
      .delete(kycDocumentsTable)
      .where(eq(kycDocumentsTable.professionalId, professionalId));
    res.json({ success: true, status: "not_submitted" });
  } catch {
    res.status(500).json({ error: "Failed to revoke KYC status" });
  }
});

export default router;
