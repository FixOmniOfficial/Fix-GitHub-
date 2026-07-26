import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeSettings(s: typeof appSettingsTable.$inferSelect) {
  return {
    ...s,
    captionSize: parseFloat(s.captionSize as string),
    zoomLevel: parseFloat(s.zoomLevel as string),
  };
}

async function getOrCreateSettings() {
  const [existing] = await db.select().from(appSettingsTable);
  if (existing) return existing;

  const [created] = await db
    .insert(appSettingsTable)
    .values({
      theme: "light",
      language: "both",
      captionSize: "14",
      zoomLevel: "1",
      notificationsEnabled: true,
    })
    .returning();
  return created;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(GetSettingsResponse.parse(serializeSettings(settings)));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getOrCreateSettings();
  const [updated] = await db
    .update(appSettingsTable)
    .set(parsed.data)
    .where(eq(appSettingsTable.id, settings.id))
    .returning();

  res.json(UpdateSettingsResponse.parse(serializeSettings(updated)));
});

export default router;
