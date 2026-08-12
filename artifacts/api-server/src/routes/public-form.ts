import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, professionalsTable, techCustomersTable, bookingsTable, appSettingsTable } from "@workspace/db";
import { PROFESSION_LABELS } from "@workspace/db";
import crypto from "crypto";

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

// ── POST /public/book/:techCode  (primary) ────────────────────────────────────
// ── POST /public/customer-form/:techCode  (legacy alias) ──────────────────────
//    Customer submits booking → inserts into bookings table + tech_customers
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
    serviceType,
  } = req.body as Record<string, string | undefined>;

  if (!name?.trim()) { res.status(400).json({ error: "Full name is required." }); return; }
  if (!phone?.trim()) { res.status(400).json({ error: "Mobile number is required." }); return; }
  if (!serviceType?.trim()) { res.status(400).json({ error: "Service type is required." }); return; }

  const bookingUid = `BK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  // ── Insert into bookings table ─────────────────────────────────────────────
  const [booking] = await db.insert(bookingsTable).values({
    bookingUid,
    customerName:   name.trim(),
    phone:          phone.trim(),
    whatsappPhone:  whatsappPhone?.trim() || null,
    houseNumber:    houseNumber?.trim() || null,
    floorNumber:    floorNumber?.trim() || null,
    address:        address?.trim() || null,
    location:       location?.trim() || null,
    serviceType:    serviceType.trim(),
    professionalId: tech.id,
    professionType: tech.professionType,
    visitingCharge: tech.visitingCharge ?? null,
    status:         "pending",
  }).returning();

  // ── Also mirror into tech_customers (appears in technician's customer tab) ──
  const notes = [
    houseNumber ? `House: ${houseNumber}` : null,
    floorNumber ? `Floor: ${floorNumber}` : null,
    location    ? `Location: ${location}` : null,
    whatsappPhone && whatsappPhone !== phone ? `WhatsApp: ${whatsappPhone}` : null,
  ].filter(Boolean).join(" | ") || null;

  await db.insert(techCustomersTable).values({
    techCode: tech.uniqueCode!,
    name:     name.trim(),
    phone:    phone.trim(),
    address:  address?.trim() || null,
    jobType:  serviceType.trim(),
    notes,
  }).onConflictDoNothing();

  res.status(201).json({
    success:    true,
    bookingUid: booking.bookingUid,
    techPhone:  tech.phone,   // returned so client can open WhatsApp to notify tech
    message:    "✅ Thank You! Your booking has been submitted successfully. The technician will contact you shortly.",
  });
}
router.post("/public/book/:techCode",       submitBooking);
router.post("/public/customer-form/:token", submitBooking);

export default router;
