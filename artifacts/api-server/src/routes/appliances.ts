import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, appliancesTable, customersTable } from "@workspace/db";
import {
  ListAppliancesQueryParams,
  ListAppliancesResponse,
  CreateApplianceBody,
  CreateApplianceResponse,
  GetApplianceParams,
  GetApplianceResponse,
  UpdateApplianceParams,
  UpdateApplianceBody,
  UpdateApplianceResponse,
  DeleteApplianceParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/appliances", async (req, res): Promise<void> => {
  const query = ListAppliancesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let appliances = await db
    .select()
    .from(appliancesTable)
    .orderBy(desc(appliancesTable.createdAt));

  if (query.data.customerId) {
    appliances = appliances.filter((a) => a.customerId === query.data.customerId);
  }
  if (query.data.type) {
    appliances = appliances.filter((a) =>
      a.type.toLowerCase().includes((query.data.type ?? "").toLowerCase())
    );
  }

  const enriched = await Promise.all(
    appliances.map(async (a) => {
      const [customer] = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, a.customerId));
      return { ...a, customerName: customer?.name ?? null, createdAt: a.createdAt.toISOString() };
    })
  );

  res.json(ListAppliancesResponse.parse(enriched));
});

router.post("/appliances", async (req, res): Promise<void> => {
  const parsed = CreateApplianceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [appliance] = await db.insert(appliancesTable).values(parsed.data).returning();
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, appliance.customerId));

  res.status(201).json(
    CreateApplianceResponse.parse({
      ...appliance,
      customerName: customer?.name ?? null,
      createdAt: appliance.createdAt.toISOString(),
    })
  );
});

router.get("/appliances/:id", async (req, res): Promise<void> => {
  const params = GetApplianceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [appliance] = await db
    .select()
    .from(appliancesTable)
    .where(eq(appliancesTable.id, params.data.id));

  if (!appliance) {
    res.status(404).json({ error: "Appliance not found" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, appliance.customerId));
  res.json(
    GetApplianceResponse.parse({
      ...appliance,
      customerName: customer?.name ?? null,
      createdAt: appliance.createdAt.toISOString(),
    })
  );
});

router.patch("/appliances/:id", async (req, res): Promise<void> => {
  const params = UpdateApplianceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateApplianceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [appliance] = await db
    .update(appliancesTable)
    .set(parsed.data)
    .where(eq(appliancesTable.id, params.data.id))
    .returning();

  if (!appliance) {
    res.status(404).json({ error: "Appliance not found" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, appliance.customerId));
  res.json(
    UpdateApplianceResponse.parse({
      ...appliance,
      customerName: customer?.name ?? null,
      createdAt: appliance.createdAt.toISOString(),
    })
  );
});

router.delete("/appliances/:id", async (req, res): Promise<void> => {
  const params = DeleteApplianceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [appliance] = await db
    .delete(appliancesTable)
    .where(eq(appliancesTable.id, params.data.id))
    .returning();

  if (!appliance) {
    res.status(404).json({ error: "Appliance not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
