import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serializeSettings(s: typeof appSettingsTable.$inferSelect) {
  return {
    ...s,
    captionSize: parseFloat(s.captionSize as string),
    zoomLevel: parseFloat(s.zoomLevel as string),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

async function getOrCreateSettings() {
  const [existing] = await db.select().from(appSettingsTable);
  if (existing) return existing;
  const [created] = await db
    .insert(appSettingsTable)
    .values({ theme: "light", language: "both", captionSize: "1", zoomLevel: "1", notificationsEnabled: true, shopName: "सर्विस सेंटर" })
    .returning();
  return created;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  // Return raw serialized — include extra fields the Zod schema doesn't know about
  const serialized = serializeSettings(settings);
  try {
    res.json(GetSettingsResponse.parse(serialized));
  } catch {
    res.json(serialized);
  }
});

router.patch("/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  // Pull extra custom fields before Zod strips them
  const { shopName, logoUrl, ...rest } = req.body as Record<string, unknown>;

  const parsed = UpdateSettingsBody.safeParse(rest);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getOrCreateSettings();

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (typeof shopName === "string") updateData.shopName = shopName;
  if (typeof logoUrl === "string" || logoUrl === null) updateData.logoUrl = logoUrl;

  const [updated] = await db
    .update(appSettingsTable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(updateData as any)
    .where(eq(appSettingsTable.id, settings.id))
    .returning();

  const serialized = serializeSettings(updated);
  try {
    res.json(UpdateSettingsResponse.parse(serialized));
  } catch {
    res.json(serialized);
  }
});

export default router;
