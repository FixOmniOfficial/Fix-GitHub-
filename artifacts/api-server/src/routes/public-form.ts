import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, professionalsTable, techCustomersTable, techFormSubmissionsTable, appSettingsTable, serviceCategoriesTable } from "@workspace/db";
import { PROFESSION_LABELS } from "@workspace/db";

const router: IRouter = Router();

// ── Helper: get or create app settings ────────────────────────────────────────
async function getPublicSettings() {
  const [s] = await db.select().from(appSettingsTable);
  if (s) return s;
  const [created] = await db.insert(appSettingsTable).values({}).returning();
  return created;
}

// ── Helper: resolve technician by code ────────────────────────────────────────
async function resolveTech(techCode: string) {
  const [p] = await db
    .select()
    .from(professionalsTable)
    .where(eq(professionalsTable.uniqueCode, techCode.toUpperCase()));
  return p ?? null;
}

// ── GET /public/app-settings ──────────────────────────────────────────────────
//    Returns public-safe app branding + form icons (no auth required)
router.get("/public/app-settings", async (_req, res): Promise<void> => {
  const s = await getPublicSettings();
  res.json({
    appName:        s.appName,
    appLogoUrl:     s.appLogoUrl,
    playStoreUrl:   s.playStoreUrl,
    webAppUrl:      s.webAppUrl,
    iconTechnician: s.iconTechnician,
    iconServiceType: s.iconServiceType,
    iconFullName:   s.iconFullName,
    iconMobileNo:   s.iconMobileNo,
    iconHouseNo:    s.iconHouseNo,
    iconSelectFloor: s.iconSelectFloor,
    iconFullAddress: s.iconFullAddress,
    iconGps:        s.iconGps,
  });
});

// ── GET /public/book/:techCode  (primary branded route) ───────────────────────
// ── GET /public/customer-form/:techCode  (legacy alias) ───────────────────────
//    Returns full technician profile for the customer booking form
async function getTechProfile(req: any, res: any): Promise<void> {
  const techCode = req.params.techCode || req.params.token;
  if (!techCode) { res.status(400).json({ error: "Technician code is required." }); return; }

  const tech = await resolveTech(techCode);
  if (!tech) {
    res.status(404).json({ error: "Technician profile not found. Please verify the booking link." });
    return;
  }

  res.json({
    id:             tech.id,
    techName:       tech.name,
    techCode:       tech.uniqueCode,
    category:       PROFESSION_LABELS[tech.professionType] ?? tech.professionType,
    professionType: tech.professionType,
    phone:          tech.phone,
    rating:         tech.rating ? Number(tech.rating) : 4.5,
    avatarEmoji:    tech.avatarEmoji ?? "👤",
    visitingCharge: tech.visitingCharge ? Number(tech.visitingCharge) : null,
    shopName:       tech.shopName,
  });
}
router.get("/public/book/:techCode",       getTechProfile);
router.get("/public/customer-form/:token", getTechProfile);

// ── GET /public/service-categories ───────────────────────────────────────────
//    Returns only active categories (for customer booking form chips)
router.get("/public/service-categories", async (_req, res): Promise<void> => {
  const cats = await db
    .select({
      id:             serviceCategoriesTable.id,
      name:           serviceCategoriesTable.name,
      icon:           serviceCategoriesTable.icon,
      accent:         serviceCategoriesTable.accent,
      professionType: serviceCategoriesTable.professionType,
      sortOrder:      serviceCategoriesTable.sortOrder,
    })
    .from(serviceCategoriesTable)
    .where(eq(serviceCategoriesTable.isActive, true))
    .orderBy(serviceCategoriesTable.sortOrder, serviceCategoriesTable.id);
  res.json(cats);
});

// ── POST /public/book/:techCode  (primary) ────────────────────────────────────
// ── POST /public/customer-form/:techCode  (legacy alias) ──────────────────────
//    ISOLATION RULE: writes ONLY to technician-scoped tables.
//    Never touches bookingsTable or any global/dashboard table.
async function submitBooking(req: any, res: any): Promise<void> {
  const techCode = req.params.techCode || req.params.token;
  if (!techCode) { res.status(400).json({ error: "Technician code is required." }); return; }

  const tech = await resolveTech(techCode);
  if (!tech) {
    res.status(404).json({ error: "Technician profile not found. Please verify the booking link." });
    return;
  }

  const {
    name, phone, whatsappPhone,
    houseNumber, floorNumber, address, location,
    serviceType,   // legacy single string
    serviceTypes,  // new multi-select array
  } = req.body as Record<string, unknown>;

  if (!String(name ?? '').trim()) { res.status(400).json({ error: "Full name is required." }); return; }
  if (!String(phone ?? '').trim()) { res.status(400).json({ error: "Mobile number is required." }); return; }

  // Normalise serviceTypes: accept array or single string (backward-compat with old clients)
  const rawTypes = serviceTypes ?? (serviceType ? [serviceType] : []);
  const typesArr: string[] = (Array.isArray(rawTypes) ? rawTypes : [rawTypes])
    .map(String)
    .map(s => s.trim())
    .filter(Boolean);

  if (typesArr.length === 0) {
    res.status(400).json({ error: "Please select at least one service type." });
    return;
  }

  const serviceTypesJson = JSON.stringify(typesArr);
  const serviceLabel     = typesArr.join(", ");

  // ── 1. Save full submission record under this technician ───────────────────
  const addressParts = [
    houseNumber ? `House: ${houseNumber}` : null,
    floorNumber ? `Floor: ${floorNumber}` : null,
    location    ? `Location: ${location}` : null,
    whatsappPhone && whatsappPhone !== phone ? `WhatsApp: ${whatsappPhone}` : null,
  ].filter(Boolean).join(" | ") || null;

  const [submission] = await db.insert(techFormSubmissionsTable).values({
    professionalId: tech.id,
    techCode:       tech.uniqueCode!,
    customerName:   String(name).trim(),
    phone:          String(phone).trim(),
    fullAddress:    address ? String(address).trim() || null : null,
    houseNumber:    houseNumber ? String(houseNumber).trim() || null : null,
    floorNumber:    floorNumber ? String(floorNumber).trim() || null : null,
    location:       location ? String(location).trim() || null : null,
    notes:          addressParts,
    serviceTypes:   serviceTypesJson,
    visitingCharge: tech.visitingCharge ? String(tech.visitingCharge) : null,
    status:         "pending",
  }).returning();

  // ── 2. Mirror into technician's customer list (techCustomersTable) ─────────
  const fullNotes = [
    addressParts,
    `Service: ${serviceLabel}`,
    `Form submission – ${new Date().toISOString().slice(0, 10)}`,
  ].filter(Boolean).join("\n");

  await db.insert(techCustomersTable).values({
    techCode: tech.uniqueCode!,
    name:     String(name).trim(),
    phone:    String(phone).trim(),
    address:  address ? String(address).trim() || null : null,
    jobType:  serviceLabel,
    notes:    fullNotes,
  }).onConflictDoNothing();

  res.status(201).json({
    success:       true,
    submissionId:  submission.id,
    techPhone:     tech.phone,   // returned so client can open WhatsApp to notify tech
    message:       "✅ Thank You! Your booking has been submitted successfully. The technician will contact you shortly.",
  });
}
router.post("/public/book/:techCode",       submitBooking);
router.post("/public/customer-form/:token", submitBooking);

export default router;
