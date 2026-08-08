import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appCustomersTable, techCustomersTable } from "@workspace/db";

const router: IRouter = Router();

/* ── GET /public/customer-form/:techCode ──
   Called by the customer-facing form page to validate the link
   and optionally return the technician's visiting charge.          */
router.get("/public/customer-form/:techCode", async (req, res): Promise<void> => {
  const { techCode } = req.params;
  if (!techCode) { res.status(400).json({ error: "techCode required" }); return; }

  const [tech] = await db
    .select()
    .from(appCustomersTable)
    .where(eq(appCustomersTable.uniqueCode, techCode));

  if (!tech) {
    res.status(404).json({ error: "लिंक अमान्य है। कृपया technician से नया link लें।" });
    return;
  }

  // visitingAmount is not stored per app-customer yet; return null so the
  // form still renders (the banner is hidden when visitingAmount is null).
  res.json({
    techName: tech.name,
    visitingAmount: null,
  });
});

/* ── POST /public/customer-form/:techCode ──
   Customer submits their details → creates a new entry in
   the technician's customer list (tech_customers table).            */
router.post("/public/customer-form/:techCode", async (req, res): Promise<void> => {
  const { techCode } = req.params;
  if (!techCode) { res.status(400).json({ error: "techCode required" }); return; }

  const [tech] = await db
    .select()
    .from(appCustomersTable)
    .where(eq(appCustomersTable.uniqueCode, techCode));

  if (!tech) {
    res.status(404).json({ error: "लिंक अमान्य है। कृपया technician से नया link लें।" });
    return;
  }

  const { name, phone, whatsappPhone, houseNumber, floorNumber, address, location, serviceType } = req.body;

  if (!name || !phone) {
    res.status(400).json({ error: "Name and phone are required" });
    return;
  }

  // Build notes from extra fields so nothing is lost
  const extraParts: string[] = [];
  if (houseNumber)  extraParts.push(`House: ${houseNumber}`);
  if (floorNumber)  extraParts.push(`Floor: ${floorNumber}`);
  if (location)     extraParts.push(`Location: ${location}`);
  if (whatsappPhone && whatsappPhone !== phone) extraParts.push(`WhatsApp: ${whatsappPhone}`);
  const notes = extraParts.length ? extraParts.join(" | ") : null;

  await db.insert(techCustomersTable).values({
    techCode,
    name:    name.trim(),
    phone:   phone.trim(),
    address: address?.trim() || null,
    jobType: serviceType?.trim() || null,
    notes,
  });

  res.json({
    success: true,
    message: "आपकी जानकारी सफलतापूर्वक सुरक्षित हो गई। धन्यवाद!",
  });
});

export default router;
