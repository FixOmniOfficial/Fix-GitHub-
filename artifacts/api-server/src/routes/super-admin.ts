/**
 * Super Admin routes
 *  GET  /api/public/screen-visibility          — public (mobile app reads on load)
 *  GET  /api/admin/screen-visibility           — all rows incl. disabled (requireAdmin)
 *  PATCH /api/admin/screen-visibility/:key     — toggle on/off (requireSuperAdmin)
 *  GET  /api/admin/feature-modules             — list all modules (requireAdmin)
 *  PATCH /api/admin/feature-modules/:key       — update status (requireSuperAdmin)
 *  GET  /api/admin/form-options                — list options (requireAdmin)
 *  POST /api/admin/form-options                — add option (requireSuperAdmin)
 *  PATCH /api/admin/form-options/:id           — edit option (requireSuperAdmin)
 *  DELETE /api/admin/form-options/:id          — delete option (requireSuperAdmin)
 *  POST /api/admin/form-options/save-all       — bulk replace (requireSuperAdmin)
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  screenVisibilityTable,
  featureModulesTable,
  formOptionsTable,
} from "@workspace/db";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ── Default screen seeds ───────────────────────────────────────────────────────
const DEFAULT_SCREENS = [
  { screenKey: "customer_home",           label: "Customer Home",           userType: "customer",    sortOrder: 1 },
  { screenKey: "customer_bookings",       label: "Customer Bookings",       userType: "customer",    sortOrder: 2 },
  { screenKey: "customer_notifications",  label: "Customer Notifications",  userType: "customer",    sortOrder: 3 },
  { screenKey: "customer_more",           label: "Customer More / Profile", userType: "customer",    sortOrder: 4 },
  { screenKey: "technician_home",         label: "Technician Home",         userType: "technician",  sortOrder: 5 },
  { screenKey: "technician_dashboard",    label: "Technician Dashboard",    userType: "technician",  sortOrder: 6 },
  { screenKey: "technician_kyc",          label: "Technician KYC",          userType: "technician",  sortOrder: 7 },
  { screenKey: "technician_submissions",  label: "Technician Submissions",  userType: "technician",  sortOrder: 8 },
  { screenKey: "technician_form_manager", label: "Technician Form Manager", userType: "technician",  sortOrder: 9 },
];

const DEFAULT_MODULES = [
  { moduleKey: "push_notifications", label: "Push Notifications",        description: "Real-time push alerts for bookings and KYC changes",    status: "draft" },
  { moduleKey: "language_switcher",  label: "In-App Language Switcher",  description: "Live Hindi/English toggle inside the mobile app",       status: "draft" },
  { moduleKey: "ratings_system",     label: "Ratings & Reviews",         description: "Customers can rate technicians after a completed job",  status: "draft" },
  { moduleKey: "payment_tracking",   label: "Payment Tracking",          description: "Track technician payments and dues",                    status: "published" },
  { moduleKey: "kyc_verification",   label: "KYC Verification",          description: "Technician document verification flow",                 status: "published" },
];

const DEFAULT_FORM_OPTIONS = [
  { label: "Service",       value: "Service",       icon: "🛠️", optionType: "service_type", sortOrder: 1 },
  { label: "Repair",        value: "Repair",        icon: "🔧", optionType: "service_type", sortOrder: 2 },
  { label: "Installation",  value: "Installation",  icon: "📦", optionType: "service_type", sortOrder: 3 },
  { label: "Maintenance",   value: "Maintenance",   icon: "⚙️", optionType: "service_type", sortOrder: 4 },
  { label: "Inspection",    value: "Inspection",    icon: "🔍", optionType: "service_type", sortOrder: 5 },
];

async function ensureDefaults() {
  const [screens, modules, opts] = await Promise.all([
    db.select().from(screenVisibilityTable),
    db.select().from(featureModulesTable),
    db.select().from(formOptionsTable),
  ]);

  const seeding: Promise<unknown>[] = [];

  if (screens.length === 0) {
    seeding.push(db.insert(screenVisibilityTable).values(DEFAULT_SCREENS));
  }
  if (modules.length === 0) {
    seeding.push(db.insert(featureModulesTable).values(DEFAULT_MODULES));
  }
  if (opts.length === 0) {
    seeding.push(db.insert(formOptionsTable).values(DEFAULT_FORM_OPTIONS));
  }

  if (seeding.length > 0) await Promise.all(seeding);
}

// ── PUBLIC: screen visibility (mobile app reads on startup) ───────────────────
router.get("/public/screen-visibility", async (_req, res): Promise<void> => {
  await ensureDefaults();
  const rows = await db.select().from(screenVisibilityTable).orderBy(screenVisibilityTable.sortOrder);
  res.json(rows);
});

// ── ADMIN: all screen rows (incl. disabled) ───────────────────────────────────
router.get("/admin/screen-visibility", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  await ensureDefaults();
  const rows = await db.select().from(screenVisibilityTable).orderBy(screenVisibilityTable.sortOrder);
  res.json(rows);
});

// ── SUPER ADMIN: toggle a screen on/off ──────────────────────────────────────
router.patch("/admin/screen-visibility/:key", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { key } = req.params;
  const { isEnabled } = req.body as { isEnabled: boolean };

  if (typeof isEnabled !== "boolean") {
    res.status(400).json({ error: "isEnabled must be a boolean" });
    return;
  }

  const [updated] = await db
    .update(screenVisibilityTable)
    .set({ isEnabled })
    .where(eq(screenVisibilityTable.screenKey, key))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Screen not found" });
    return;
  }

  res.json(updated);
});

// ── ADMIN: list feature modules ───────────────────────────────────────────────
router.get("/admin/feature-modules", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  await ensureDefaults();
  const rows = await db.select().from(featureModulesTable).orderBy(featureModulesTable.id);
  res.json(rows);
});

// ── SUPER ADMIN: update module status ────────────────────────────────────────
router.patch("/admin/feature-modules/:key", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { key } = req.params;
  const { status } = req.body as { status: string };

  if (!["draft", "published"].includes(status)) {
    res.status(400).json({ error: "status must be 'draft' or 'published'" });
    return;
  }

  const [updated] = await db
    .update(featureModulesTable)
    .set({ status })
    .where(eq(featureModulesTable.moduleKey, key))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Module not found" });
    return;
  }

  res.json(updated);
});

// ── PUBLIC: form options (mobile booking form reads on load) ──────────────────
router.get("/public/form-options", async (_req, res): Promise<void> => {
  await ensureDefaults();
  const rows = await db
    .select()
    .from(formOptionsTable)
    .orderBy(formOptionsTable.sortOrder, formOptionsTable.id);
  res.json(rows.filter(r => r.isActive));
});

// ── ADMIN: list form options ──────────────────────────────────────────────────
router.get("/admin/form-options", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  await ensureDefaults();
  const rows = await db.select().from(formOptionsTable).orderBy(formOptionsTable.sortOrder, formOptionsTable.id);
  res.json(rows);
});

// ── SUPER ADMIN: add a form option ───────────────────────────────────────────
router.post("/admin/form-options", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { label, value, icon, optionType, sortOrder, isActive } = req.body as Record<string, unknown>;

  if (!label || !value) {
    res.status(400).json({ error: "label and value are required" });
    return;
  }

  const [created] = await db.insert(formOptionsTable).values({
    label:      String(label),
    value:      String(value),
    icon:       icon ? String(icon) : null,
    optionType: optionType ? String(optionType) : "service_type",
    sortOrder:  typeof sortOrder === "number" ? sortOrder : 0,
    isActive:   typeof isActive === "boolean" ? isActive : true,
  }).returning();

  res.status(201).json(created);
});

// ── SUPER ADMIN: edit a form option ──────────────────────────────────────────
router.patch("/admin/form-options/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { label, value, icon, optionType, sortOrder, isActive } = req.body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (label      !== undefined) updateData.label      = String(label);
  if (value      !== undefined) updateData.value      = String(value);
  if (icon       !== undefined) updateData.icon       = icon ? String(icon) : null;
  if (optionType !== undefined) updateData.optionType = String(optionType);
  if (sortOrder  !== undefined) updateData.sortOrder  = Number(sortOrder);
  if (isActive   !== undefined) updateData.isActive   = Boolean(isActive);

  const [updated] = await db
    .update(formOptionsTable)
    .set(updateData as Parameters<typeof db.update>[0] extends infer T ? T : never)
    .where(eq(formOptionsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Option not found" }); return; }
  res.json(updated);
});

// ── SUPER ADMIN: delete a form option ────────────────────────────────────────
router.delete("/admin/form-options/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(formOptionsTable).where(eq(formOptionsTable.id, id));
  res.json({ success: true });
});

// ── SUPER ADMIN: bulk save — replace all options of a given type ──────────────
router.post("/admin/form-options/save-all", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const { options, optionType = "service_type" } = req.body as {
    options: Array<{ id?: number; label: string; value: string; icon?: string; sortOrder?: number; isActive?: boolean }>;
    optionType?: string;
  };

  if (!Array.isArray(options)) {
    res.status(400).json({ error: "options must be an array" });
    return;
  }

  // Delete all existing of this type, then re-insert
  await db.delete(formOptionsTable).where(eq(formOptionsTable.optionType, String(optionType)));

  if (options.length > 0) {
    await db.insert(formOptionsTable).values(
      options.map((o, idx) => ({
        label:      o.label || "Option",
        value:      o.value || o.label || "option",
        icon:       o.icon  || null,
        optionType: String(optionType),
        sortOrder:  o.sortOrder ?? idx,
        isActive:   o.isActive ?? true,
      }))
    );
  }

  const updated = await db
    .select()
    .from(formOptionsTable)
    .orderBy(formOptionsTable.sortOrder, formOptionsTable.id);

  res.json(updated);
});

export default router;
