import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, jobsTable, customersTable, appliancesTable, highlightsTable } from "@workspace/db";
import {
  ListJobsQueryParams,
  ListJobsResponse,
  CreateJobBody,
  CreateJobResponse,
  GetJobParams,
  GetJobResponse,
  UpdateJobParams,
  UpdateJobBody,
  UpdateJobResponse,
  DeleteJobParams,
  UpdateJobPaymentParams,
  UpdateJobPaymentBody,
  UpdateJobPaymentResponse,
  ListRecentJobsQueryParams,
  ListRecentJobsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getNextJobNumber(): Promise<string> {
  const jobs = await db.select().from(jobsTable).orderBy(desc(jobsTable.id));
  const num = (jobs.length + 1).toString().padStart(4, "0");
  return `JOB-${num}`;
}

function serializeJob(
  job: typeof jobsTable.$inferSelect,
  customerName?: string | null,
  customerPhone?: string | null,
  applianceType?: string | null,
  highlights: typeof highlightsTable.$inferSelect[] = []
) {
  return {
    ...job,
    customerName: customerName ?? null,
    customerPhone: customerPhone ?? null,
    applianceType: applianceType ?? null,
    amount: parseFloat(job.amount as string),
    paidAmount: parseFloat(job.paidAmount as string),
    highlights: highlights.map((h) => ({
      ...h,
      captionSize: parseFloat(h.captionSize as string),
      zoomLevel: parseFloat(h.zoomLevel as string),
      createdAt: h.createdAt.toISOString(),
    })),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    scheduledDate: job.scheduledDate ?? null,
    completedDate: job.completedDate ?? null,
  };
}

router.get("/jobs/recent", async (req, res): Promise<void> => {
  const query = ListRecentJobsQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 10) : 10;

  const jobs = await db
    .select()
    .from(jobsTable)
    .orderBy(desc(jobsTable.createdAt))
    .limit(limit);

  const enriched = await Promise.all(
    jobs.map(async (j) => {
      const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, j.customerId));
      const highlights = await db.select().from(highlightsTable).where(eq(highlightsTable.jobId, j.id));
      return serializeJob(j, customer?.name, customer?.phone, null, highlights);
    })
  );

  res.json(ListRecentJobsResponse.parse(enriched));
});

router.get("/jobs", async (req, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let jobs = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt));

  const { customerId, status, paymentStatus, search } = query.data;

  if (customerId) jobs = jobs.filter((j) => j.customerId === customerId);
  if (status) jobs = jobs.filter((j) => j.status === status);
  if (paymentStatus) jobs = jobs.filter((j) => j.paymentStatus === paymentStatus);

  const enriched = await Promise.all(
    jobs.map(async (j) => {
      const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, j.customerId));
      const highlights = await db.select().from(highlightsTable).where(eq(highlightsTable.jobId, j.id));
      const serialized = serializeJob(j, customer?.name, customer?.phone, null, highlights);
      return serialized;
    })
  );

  let filtered = enriched;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (j) =>
        j.jobNumber.toLowerCase().includes(s) ||
        (j.description && j.description.toLowerCase().includes(s)) ||
        (j.customerName && j.customerName.toLowerCase().includes(s))
    );
  }

  res.json(ListJobsResponse.parse(filtered));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const jobNumber = await getNextJobNumber();
  const [job] = await db
    .insert(jobsTable)
    .values({ ...parsed.data, jobNumber })
    .returning();

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, job.customerId));
  res.status(201).json(CreateJobResponse.parse(serializeJob(job, customer?.name, customer?.phone)));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, job.customerId));
  const highlights = await db.select().from(highlightsTable).where(eq(highlightsTable.jobId, job.id));

  res.json(GetJobResponse.parse(serializeJob(job, customer?.name, customer?.phone, null, highlights)));
});

router.patch("/jobs/:id", async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db
    .update(jobsTable)
    .set(parsed.data)
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, job.customerId));
  const highlights = await db.select().from(highlightsTable).where(eq(highlightsTable.jobId, job.id));
  res.json(UpdateJobResponse.parse(serializeJob(job, customer?.name, customer?.phone, null, highlights)));
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .delete(jobsTable)
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/jobs/:id/payment", async (req, res): Promise<void> => {
  const params = UpdateJobPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateJobPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db
    .update(jobsTable)
    .set(parsed.data)
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, job.customerId));
  const highlights = await db.select().from(highlightsTable).where(eq(highlightsTable.jobId, job.id));
  res.json(UpdateJobPaymentResponse.parse(serializeJob(job, customer?.name, customer?.phone, null, highlights)));
});

export default router;
