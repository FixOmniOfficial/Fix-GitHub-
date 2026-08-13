/**
 * Admin Sandbox Routes — INTERNAL USE ONLY, super_admin gated
 *
 * POST   /api/admin/sandbox/generate           — create fake test technicians
 * POST   /api/admin/sandbox/generate-customers — create fake test customers
 * GET    /api/admin/sandbox/data               — list all test data (techs + customers)
 * DELETE /api/admin/sandbox/clear              — delete ALL is_test_data=true rows
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { professionalsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { clerkClient, getAuth } from "@clerk/express";

const router: IRouter = Router();

// ── Super-admin guard ─────────────────────────────────────────────────────────
async function requireSuperAdminSandbox(req: Request, res: Response, next: () => void) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Login required" }); return; }
  const user = await clerkClient.users.getUser(userId);
  const role = (user.publicMetadata as any)?.role ?? "user";
  if (role !== "super_admin") { res.status(403).json({ error: "Super admin only" }); return; }
  next();
}

// ── Fake data pools ───────────────────────────────────────────────────────────
const FAKE_TECH_NAMES = [
  "Ramesh Kumar Test", "Suresh Singh Test", "Mohan Verma Test",
  "Anil Sharma Test", "Ravi Gupta Test", "Manoj Yadav Test",
  "Vijay Prasad Test", "Sanjay Mehta Test", "Ajay Patel Test",
  "Deepak Tiwari Test",
];
const FAKE_CUSTOMER_NAMES = [
  "Priya Sharma Test", "Anjali Singh Test", "Rahul Verma Test",
  "Neha Gupta Test", "Kavita Yadav Test", "Pooja Mehta Test",
  "Sunita Patel Test", "Geeta Tiwari Test", "Meera Joshi Test",
  "Anita Nair Test",
];
const PROFESSION_TYPES = ["ac_technician", "electrician", "plumber", "carpenter", "painter", "repair"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randPhone(): string {
  return `9${String(Math.floor(Math.random() * 9e8)).padStart(9, '0')}`;
}

// Generate unique TEST-XXXX code for technicians
async function nextTestCode(): Promise<string> {
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(CAST(SUBSTRING(unique_code FROM 6) AS INTEGER)), 0) AS max_num 
        FROM professionals WHERE unique_code LIKE 'TEST-%'`
  );
  const rows: any[] = (result as any).rows ?? (Array.isArray(result) ? result : []);
  const maxNum = Number(rows[0]?.max_num ?? 0);
  return `TEST-${String(maxNum + 1).padStart(4, '0')}`;
}

// Generate unique CUST-XXXX code for customers
async function nextCustCode(): Promise<string> {
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(CAST(SUBSTRING(unique_code FROM 6) AS INTEGER)), 0) AS max_num 
        FROM app_customers WHERE unique_code LIKE 'CUST-%'`
  );
  const rows: any[] = (result as any).rows ?? (Array.isArray(result) ? result : []);
  const maxNum = Number(rows[0]?.max_num ?? 0);
  return `CUST-${String(maxNum + 1).padStart(4, '0')}`;
}

// ── POST /api/admin/sandbox/generate — fake technicians ───────────────────────
router.post("/admin/sandbox/generate", requireAuth, requireSuperAdminSandbox,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const count = Math.min(Math.max(parseInt((req.body?.count as string) ?? "1"), 1), 10);
      const created = [];
      for (let i = 0; i < count; i++) {
        const name = `${rand(FAKE_TECH_NAMES)} #${Date.now() % 1000}`;
        const phone = randPhone();
        const professionType = rand(PROFESSION_TYPES);
        const uniqueCode = await nextTestCode();
        const [tech] = await db.insert(professionalsTable).values({
          name, phone, professionType, uniqueCode,
          isTestData: true, avatarEmoji: "🤖", shopName: "TEST SANDBOX",
        }).returning();
        created.push(tech);
      }
      res.status(201).json({ created, count: created.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Generate failed" });
    }
  }
);

// ── POST /api/admin/sandbox/generate-customers — fake customers ───────────────
router.post("/admin/sandbox/generate-customers", requireAuth, requireSuperAdminSandbox,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const count = Math.min(Math.max(parseInt((req.body?.count as string) ?? "1"), 1), 10);
      const created = [];
      for (let i = 0; i < count; i++) {
        const name = `${rand(FAKE_CUSTOMER_NAMES)} #${Date.now() % 1000}`;
        const phone = randPhone();
        const uniqueCode = await nextCustCode();
        // Use raw SQL since appCustomersTable schema doesn't expose is_test_data
        const result = await db.execute(
          sql`INSERT INTO app_customers (name, phone, unique_code, is_test_data)
              VALUES (${name}, ${phone}, ${uniqueCode}, true)
              RETURNING id, name, phone, unique_code AS "uniqueCode", created_at AS "createdAt"`
        );
        const rows: any[] = (result as any).rows ?? [];
        if (rows[0]) created.push(rows[0]);
      }
      res.status(201).json({ created, count: created.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Generate customers failed" });
    }
  }
);

// ── GET /api/admin/sandbox/data — list technicians + customers ────────────────
router.get("/admin/sandbox/data", requireAuth, requireSuperAdminSandbox,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const technicians = await db.select().from(professionalsTable)
        .where(eq(professionalsTable.isTestData, true))
        .orderBy(professionalsTable.createdAt);

      const custResult = await db.execute(
        sql`SELECT id, name, phone, unique_code AS "uniqueCode", created_at AS "createdAt"
            FROM app_customers WHERE is_test_data = true ORDER BY created_at`
      );
      const customers: any[] = (custResult as any).rows ?? [];

      res.json({ technicians, customers, total: technicians.length + customers.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Fetch failed" });
    }
  }
);

// ── DELETE /api/admin/sandbox/clear ──────────────────────────────────────────
router.delete("/admin/sandbox/clear", requireAuth, requireSuperAdminSandbox,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      await db.execute(
        sql`DELETE FROM kyc_documents WHERE professional_id IN (
              SELECT id FROM professionals WHERE is_test_data = true
            )`
      );
      await db.execute(sql`DELETE FROM tech_customers WHERE is_test_data = true`);
      await db.execute(
        sql`DELETE FROM tech_payment_entries WHERE payment_id IN (
              SELECT id FROM tech_payments WHERE is_test_data = true
            )`
      );
      await db.execute(sql`DELETE FROM tech_payments WHERE is_test_data = true`);
      await db.execute(sql`DELETE FROM tech_reminders WHERE tech_code IN (
        SELECT unique_code FROM professionals WHERE is_test_data = true
      )`);
      const deleted = await db.delete(professionalsTable)
        .where(eq(professionalsTable.isTestData, true))
        .returning({ id: professionalsTable.id });
      await db.execute(sql`DELETE FROM app_customers WHERE is_test_data = true`);
      res.json({ deleted: deleted.length, message: "All test data cleared" });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Clear failed" });
    }
  }
);

export default router;
