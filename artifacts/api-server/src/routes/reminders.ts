import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, remindersTable, customersTable } from "@workspace/db";
import {
  ListRemindersQueryParams,
  ListRemindersResponse,
  CreateReminderBody,
  CreateReminderResponse,
  UpdateReminderParams,
  UpdateReminderBody,
  UpdateReminderResponse,
  DeleteReminderParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeReminder(r: typeof remindersTable.$inferSelect, customerName?: string | null) {
  return {
    ...r,
    customerName: customerName ?? null,
    reminderAt: r.reminderAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/reminders", async (req, res): Promise<void> => {
  const query = ListRemindersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let reminders = await db
    .select()
    .from(remindersTable)
    .orderBy(desc(remindersTable.reminderAt));

  if (query.data.customerId) {
    reminders = reminders.filter((r) => r.customerId === query.data.customerId);
  }
  if (query.data.isActive !== undefined) {
    reminders = reminders.filter((r) => r.isActive === query.data.isActive);
  }

  const enriched = await Promise.all(
    reminders.map(async (r) => {
      if (r.customerId) {
        const [customer] = await db
          .select()
          .from(customersTable)
          .where(eq(customersTable.id, r.customerId));
        return serializeReminder(r, customer?.name);
      }
      return serializeReminder(r);
    })
  );

  res.json(ListRemindersResponse.parse(enriched));
});

router.post("/reminders", async (req, res): Promise<void> => {
  const parsed = CreateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [reminder] = await db.insert(remindersTable).values(parsed.data).returning();
  res.status(201).json(CreateReminderResponse.parse(serializeReminder(reminder)));
});

router.patch("/reminders/:id", async (req, res): Promise<void> => {
  const params = UpdateReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [reminder] = await db
    .update(remindersTable)
    .set(parsed.data)
    .where(eq(remindersTable.id, params.data.id))
    .returning();

  if (!reminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  res.json(UpdateReminderResponse.parse(serializeReminder(reminder)));
});

router.delete("/reminders/:id", async (req, res): Promise<void> => {
  const params = DeleteReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [reminder] = await db
    .delete(remindersTable)
    .where(eq(remindersTable.id, params.data.id))
    .returning();

  if (!reminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
