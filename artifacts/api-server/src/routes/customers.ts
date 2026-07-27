import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
import { db, customersTable, jobsTable, appliancesTable } from "@workspace/db";
import {
  ListCustomersQueryParams,
  ListCustomersResponse,
  CreateCustomerBody,
  CreateCustomerResponse,
  GetCustomerParams,
  GetCustomerResponse,
  UpdateCustomerParams,
  UpdateCustomerBody,
  UpdateCustomerResponse,
  DeleteCustomerParams,
  GetCustomerHistoryParams,
  GetCustomerHistoryResponse,
  GetCustomerWhatsappFormParams,
  GetCustomerWhatsappFormResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/customers", async (req, res): Promise<void> => {
  const query = ListCustomersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { search, paymentStatus } = query.data;

  let customers = await db
    .select()
    .from(customersTable)
    .orderBy(desc(customersTable.createdAt));

  // Enrich with job stats
  const enriched = await Promise.all(
    customers.map(async (c) => {
      const jobs = await db
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.customerId, c.id));

      const totalJobs = jobs.length;
      const unpaidAmount = jobs
        .filter((j) => j.paymentStatus !== "paid")
        .reduce((sum, j) => sum + (parseFloat(j.amount as string) - parseFloat(j.paidAmount as string)), 0);
      const lastJob = jobs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        totalJobs,
        unpaidAmount,
        lastJobDate: lastJob ? lastJob.createdAt.toISOString() : null,
      };
    })
  );

  let filtered = enriched;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.phone.includes(s) ||
        (c.whatsappPhone && c.whatsappPhone.includes(s))
    );
  }
  if (paymentStatus === "unpaid") {
    filtered = filtered.filter((c) => c.unpaidAmount > 0);
  }

  res.json(ListCustomersResponse.parse(filtered));
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db.insert(customersTable).values(parsed.data).returning();
  const result = { ...customer, totalJobs: 0, unpaidAmount: 0, lastJobDate: null };
  res.status(201).json(CreateCustomerResponse.parse(result));
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, params.data.id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const jobs = await db.select().from(jobsTable).where(eq(jobsTable.customerId, customer.id));
  const totalJobs = jobs.length;
  const unpaidAmount = jobs
    .filter((j) => j.paymentStatus !== "paid")
    .reduce((sum, j) => sum + (parseFloat(j.amount as string) - parseFloat(j.paidAmount as string)), 0);
  const lastJob = jobs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  res.json(
    GetCustomerResponse.parse({
      ...customer,
      totalJobs,
      unpaidAmount,
      lastJobDate: lastJob ? lastJob.createdAt.toISOString() : null,
    })
  );
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db
    .update(customersTable)
    .set(parsed.data)
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const jobs = await db.select().from(jobsTable).where(eq(jobsTable.customerId, customer.id));
  const totalJobs = jobs.length;
  const unpaidAmount = jobs
    .filter((j) => j.paymentStatus !== "paid")
    .reduce((sum, j) => sum + (parseFloat(j.amount as string) - parseFloat(j.paidAmount as string)), 0);

  res.json(UpdateCustomerResponse.parse({ ...customer, totalJobs, unpaidAmount, lastJobDate: null }));
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db
    .delete(customersTable)
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/customers/:id/history", async (req, res): Promise<void> => {
  const params = GetCustomerHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, params.data.id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const jobs = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.customerId, params.data.id))
    .orderBy(desc(jobsTable.createdAt));

  const appliances = await db
    .select()
    .from(appliancesTable)
    .where(eq(appliancesTable.customerId, params.data.id));

  const totalPaid = jobs.reduce((sum, j) => sum + parseFloat(j.paidAmount as string), 0);
  const totalDue = jobs.reduce(
    (sum, j) => sum + Math.max(0, parseFloat(j.amount as string) - parseFloat(j.paidAmount as string)),
    0
  );

  const jobsWithExtras = jobs.map((j) => ({
    ...j,
    customerName: customer.name,
    customerPhone: customer.phone,
    applianceType: null,
    amount: parseFloat(j.amount as string),
    paidAmount: parseFloat(j.paidAmount as string),
    highlights: [],
    updatedAt: j.updatedAt.toISOString(),
    createdAt: j.createdAt.toISOString(),
    scheduledDate: j.scheduledDate ?? null,
    completedDate: j.completedDate ?? null,
  }));

  const appliancesWithExtras = appliances.map((a) => ({
    ...a,
    customerName: customer.name,
    createdAt: a.createdAt.toISOString(),
  }));

  const totalJobs = jobs.length;
  const unpaidAmount = totalDue;
  const lastJob = jobs[0];

  res.json(
    GetCustomerHistoryResponse.parse({
      customer: {
        ...customer,
        totalJobs,
        unpaidAmount,
        lastJobDate: lastJob ? lastJob.createdAt.toISOString() : null,
      },
      jobs: jobsWithExtras,
      appliances: appliancesWithExtras,
      totalPaid,
      totalDue,
    })
  );
});

router.get("/customers/:id/whatsapp-form", async (req, res): Promise<void> => {
  const params = GetCustomerWhatsappFormParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, params.data.id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const phone = customer.whatsappPhone ?? customer.phone;
  const cleanPhone = phone.replace(/[^0-9]/g, "");

  const messageTemplate =
    `नमस्ते ${customer.name} जी,\n\nहमारे सर्विस सेंटर में आपका स्वागत है। कृपया अपनी अप्लायंस की जानकारी भरें:\n\n` +
    `1. अप्लायंस का प्रकार (AC/Fridge/Washing Machine/Other):\n` +
    `2. ब्रांड:\n` +
    `3. मॉडल:\n` +
    `4. समस्या का विवरण:\n\n` +
    `धन्यवाद!`;

  const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageTemplate)}`;

  res.json(
    GetCustomerWhatsappFormResponse.parse({
      whatsappLink,
      messageTemplate,
      customerName: customer.name,
      phone,
    })
  );
});

export default router;
