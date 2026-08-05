import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import {
  GetPublicCustomerFormParams,
  GetPublicCustomerFormResponse,
  SubmitPublicCustomerFormBody,
  SubmitPublicCustomerFormResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/* ── GET /public/customer-form/:token — fetch customer data by share token ── */
router.get("/public/customer-form/:token", async (req, res): Promise<void> => {
  const params = GetPublicCustomerFormParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq((customersTable as any).shareToken, params.data.token));

  if (!customer) {
    res.status(404).json({ error: "लिंक अमान्य या समाप्त हो गया है" });
    return;
  }

  res.json(
    GetPublicCustomerFormResponse.parse({
      id: customer.id,
      serialNumber: customer.serialNumber,
      name: customer.name,
      phone: customer.phone,
      whatsappPhone: customer.whatsappPhone ?? null,
      houseNumber: (customer as any).houseNumber ?? null,
      floorNumber: (customer as any).floorNumber ?? null,
      address: customer.address ?? null,
      location: (customer as any).location ?? null,
    })
  );
});

/* ── POST /public/customer-form/:token — submit customer self-service form ── */
router.post("/public/customer-form/:token", async (req, res): Promise<void> => {
  const params = GetPublicCustomerFormParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SubmitPublicCustomerFormBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq((customersTable as any).shareToken, params.data.token));

  if (!existing) {
    res.status(404).json({ error: "लिंक अमान्य या समाप्त हो गया है" });
    return;
  }

  await db
    .update(customersTable)
    .set({
      name: body.data.name,
      phone: body.data.phone,
      whatsappPhone: body.data.whatsappPhone || null,
      houseNumber: body.data.houseNumber || null,
      floorNumber: body.data.floorNumber || null,
      address: body.data.address || null,
      location: body.data.location || null,
    } as any)
    .where(eq(customersTable.id, existing.id));

  res.json(
    SubmitPublicCustomerFormResponse.parse({
      success: true,
      message: "आपकी जानकारी सफलतापूर्वक सुरक्षित हो गई। धन्यवाद!",
    })
  );
});

export default router;
