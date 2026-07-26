import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, customersTable, jobsTable, remindersTable, highlightsTable, appliancesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetReportStatsQueryParams,
  GetReportStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [customers, jobs, reminders] = await Promise.all([
    db.select().from(customersTable),
    db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt)),
    db.select().from(remindersTable),
  ]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const pendingJobs = jobs.filter((j) => j.status === "pending").length;
  const inProgressJobs = jobs.filter((j) => j.status === "in_progress").length;
  const completedJobs = jobs.filter((j) => j.status === "completed").length;
  const totalRevenue = jobs.reduce((sum, j) => sum + parseFloat(j.paidAmount as string), 0);
  const pendingPayments = jobs
    .filter((j) => j.paymentStatus !== "paid")
    .reduce((sum, j) => sum + Math.max(0, parseFloat(j.amount as string) - parseFloat(j.paidAmount as string)), 0);
  const overduePayments = jobs
    .filter((j) => j.paymentStatus === "unpaid" && j.status === "completed")
    .reduce((sum, j) => sum + parseFloat(j.amount as string), 0);

  const todayReminders = reminders.filter((r) => {
    const ra = new Date(r.reminderAt);
    return r.isActive && ra >= todayStart && ra < todayEnd;
  }).length;

  const allHighlights = await db.select().from(highlightsTable);

  const recentJobs = jobs.slice(0, 5).map((j) => {
    const jobHighlights = allHighlights.filter((h) => h.jobId === j.id);
    return {
      ...j,
      customerName: null,
      customerPhone: null,
      applianceType: null,
      amount: parseFloat(j.amount as string),
      paidAmount: parseFloat(j.paidAmount as string),
      highlights: jobHighlights.map((h) => ({
        ...h,
        captionSize: parseFloat(h.captionSize as string),
        zoomLevel: parseFloat(h.zoomLevel as string),
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
      scheduledDate: j.scheduledDate ?? null,
      completedDate: j.completedDate ?? null,
    };
  });

  res.json(
    GetDashboardSummaryResponse.parse({
      totalCustomers: customers.length,
      totalJobs: jobs.length,
      pendingJobs,
      inProgressJobs,
      completedJobs,
      totalRevenue,
      pendingPayments,
      todayReminders,
      overduePayments,
      recentActivity: recentJobs,
    })
  );
});

router.get("/reports/stats", async (req, res): Promise<void> => {
  const query = GetReportStatsQueryParams.safeParse(req.query);
  const period = query.success ? (query.data.period ?? "month") : "month";

  const [allJobs, allAppliances] = await Promise.all([
    db.select().from(jobsTable),
    db.select().from(appliancesTable),
  ]);
  const now = new Date();

  let filtered = allJobs;
  if (period === "week") {
    const cutoff = new Date(now.getTime() - 7 * 86400000);
    filtered = allJobs.filter((j) => new Date(j.createdAt) >= cutoff);
  } else if (period === "month") {
    const cutoff = new Date(now.getTime() - 30 * 86400000);
    filtered = allJobs.filter((j) => new Date(j.createdAt) >= cutoff);
  } else if (period === "year") {
    const cutoff = new Date(now.getTime() - 365 * 86400000);
    filtered = allJobs.filter((j) => new Date(j.createdAt) >= cutoff);
  }

  const statusCounts: Record<string, number> = {};
  const paymentCounts: Record<string, { count: number; amount: number }> = {};
  const revMap: Record<string, { revenue: number; jobs: number }> = {};

  for (const j of filtered) {
    statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;

    if (!paymentCounts[j.paymentStatus]) {
      paymentCounts[j.paymentStatus] = { count: 0, amount: 0 };
    }
    paymentCounts[j.paymentStatus].count += 1;
    paymentCounts[j.paymentStatus].amount += parseFloat(j.amount as string);

    const dateKey = j.createdAt.toISOString().slice(0, 10);
    if (!revMap[dateKey]) revMap[dateKey] = { revenue: 0, jobs: 0 };
    revMap[dateKey].revenue += parseFloat(j.paidAmount as string);
    revMap[dateKey].jobs += 1;
  }

  const applianceTypeCounts: Record<string, number> = {};
  for (const a of allAppliances) {
    applianceTypeCounts[a.type] = (applianceTypeCounts[a.type] ?? 0) + 1;
  }

  const jobsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
  const jobsByPayment = Object.entries(paymentCounts).map(([paymentStatus, { count, amount }]) => ({
    paymentStatus,
    count,
    amount,
  }));
  const revenueData = Object.entries(revMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { revenue, jobs }]) => ({ date, revenue, jobs }));
  const topAppliances = Object.entries(applianceTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  res.json(
    GetReportStatsResponse.parse({
      period,
      jobsByStatus,
      jobsByPayment,
      revenueData,
      topAppliances,
    })
  );
});

export default router;
