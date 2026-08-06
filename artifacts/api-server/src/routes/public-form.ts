import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";

const router: IRouter = Router();

/* ── GET /public/customer-form/:token ── */
router.get("/public/customer-form/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  if (!token) { res.status(400).json({ error: "Token required" }); return; }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq((customersTable as any).shareToken, token));

  if (!customer) {
    res.status(404).json({ error: "लिंक अमान्य या समाप्त हो गया है" });
    return;
  }

  res.json({
    id: customer.id,
    serialNumber: customer.serialNumber,
    name: customer.name,
    phone: customer.phone,
    whatsappPhone: customer.whatsappPhone ?? null,
    houseNumber: (customer as any).houseNumber ?? null,
    floorNumber: (customer as any).floorNumber ?? null,
    address: customer.address ?? null,
    location: (customer as any).location ?? null,
    visitingAmount: (customer as any).visitingAmount
      ? parseFloat((customer as any).visitingAmount)
      : null,
  });
});

/* ── POST /public/customer-form/:token ── */
router.post("/public/customer-form/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  if (!token) { res.status(400).json({ error: "Token required" }); return; }

  const { name, phone, whatsappPhone, houseNumber, floorNumber, address, location, serviceType } = req.body;

  if (!name || !phone) {
    res.status(400).json({ error: "Name and phone are required" });
    return;
  }

  const [existing] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq((customersTable as any).shareToken, token));

  if (!existing) {
    res.status(404).json({ error: "लिंक अमान्य या समाप्त हो गया है" });
    return;
  }

  await db
    .update(customersTable)
    .set({
      name,
      phone,
      whatsappPhone: whatsappPhone || null,
      houseNumber: houseNumber || null,
      floorNumber: floorNumber || null,
      address: address || null,
      location: location || null,
      serviceType: serviceType || null,
    } as any)
    .where(eq(customersTable.id, existing.id));

  res.json({
    success: true,
    message: "आपकी जानकारी सफलतापूर्वक सुरक्षित हो गई। धन्यवाद!",
  });
});

export default router;
