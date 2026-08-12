/**
 * Admin Sandbox Routes — INTERNAL USE ONLY, super_admin gated
 * POST   /api/admin/sandbox/generate   — create fake test technician/customer
 * GET    /api/admin/sandbox/data       — list all test data
 * DELETE /api/admin/sandbox/clear      — delete ALL is_test_data=true rows
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { professionalsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { clerkClient, getAuth } from "@clerk/express";

const router: IRouter = Router();

// ── Super-admin guard (inline, no panel check) ─────────────────────────────
async function requireSuperAdminSandbox(req: Request, res: Response, next: () => void) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Login required" }); return; }
  const user = await clerkClient.users.getUser(userId);
  const role = (user.publicMetadata as any)?.role ?? "user";
  if (role !== "super_admin") { res.status(403).json({ error: "Super admin only" }); return; }
  next();
}

// Fake Indian data pools
const FAKE_NAMES = [
  "Ramesh Kumar Test", "Suresh Singh Test", "Mohan Verma Test",
  "Anil Sharma Test", "Ravi Gupta Test", "Manoj Yadav Test",
  "Vijay Prasad Test", "Sanjay Mehta Test", "Ajay Patel Test",
  "Deepak Tiwari Test",
];
const PROFESSION_TYPES = ["ac_technician", "electrician", "plumber", "carpenter", "painter", "repair"];
const FAKE_PHONES = [
  "9000000001", "9000000002", "9000000003", "9000000004", "9000000005",
  "9000000006", "9000000007", "9000000008", "9000000009", "9000000010",
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randPhone(): string {
  return `9${String(Math.floor(Math.random() * 9e8)).padStart(9, '0')}`;
}

// Generate unique TECH code for test entries
async function nextTestCode(): Promise<string> {
  const [row] = await db.execute(
    sql`SELECT MAX(CAST(SUBSTRING(unique_code FROM 6) AS INTEGER)) AS max_num 
        FROM professionals WHERE unique_code LIKE 'TEST-%'`
  ) as any[];
  const maxNum = row?.max_num ?? 0;
  return `TEST-${String(maxNum + 1).padStart(4, '0')}`;
}

// ── POST /api/admin/sandbox/generate ──────────────────────────────────────────
router.post("/admin/sandbox/generate", requireAuth, requireSuperAdminSandbox,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const count = Math.min(Math.max(parseInt((req.body?.count as string) ?? "1"), 1), 10);
      const created = [];
      for (let i = 0; i < count; i++) {
        const name = `${rand(FAKE_NAMES)} #${Date.now() % 1000}`;
        const phone = randPhone();
        const professionType = rand(PROFESSION_TYPES);
        const uniqueCode = await nextTestCode();
        const [tech] = await db.insert(professionalsTable).values({
          name,
          phone,
          professionType,
          uniqueCode,
          isTestData: true,
          avatarEmoji: "🤖",
          shopName: "TEST SANDBOX",
        }).returning();
        created.push(tech);
      }
      res.status(201).json({ created, count: created.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Generate failed" });
    }
  }
);

// ── GET /api/admin/sandbox/data ───────────────────────────────────────────────
router.get("/admin/sandbox/data", requireAuth, requireSuperAdminSandbox,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const technicians = await db.select().from(professionalsTable)
        .where(eq(professionalsTable.isTestData, true))
        .orderBy(professionalsTable.createdAt);
      res.json({ technicians, total: technicians.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Fetch failed" });
    }
  }
);

// ── DELETE /api/admin/sandbox/clear ───────────────────────────────────────────
router.delete("/admin/sandbox/clear", requireAuth, requireSuperAdminSandbox,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Delete KYC docs for test technicians first (FK)
      await db.execute(
        sql`DELETE FROM kyc_documents WHERE professional_id IN (
              SELECT id FROM professionals WHERE is_test_data = true
            )`
      );
      // Delete test tech_customers
      await db.execute(sql`DELETE FROM tech_customers WHERE is_test_data = true`);
      // Delete test payments + entries
      await db.execute(
        sql`DELETE FROM tech_payment_entries WHERE payment_id IN (
              SELECT id FROM tech_payments WHERE is_test_data = true
            )`
      );
      await db.execute(sql`DELETE FROM tech_payments WHERE is_test_data = true`);
      // Delete test reminders
      await db.execute(sql`DELETE FROM tech_reminders WHERE tech_code IN (
        SELECT unique_code FROM professionals WHERE is_test_data = true
      )`);
      // Delete technicians themselves
      const deleted = await db.delete(professionalsTable)
        .where(eq(professionalsTable.isTestData, true))
        .returning({ id: professionalsTable.id });
      // Delete test app_customers
      await db.execute(sql`DELETE FROM app_customers WHERE is_test_data = true`);
      res.json({ deleted: deleted.length, message: "All test data cleared" });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Clear failed" });
    }
  }
);

export default router;
