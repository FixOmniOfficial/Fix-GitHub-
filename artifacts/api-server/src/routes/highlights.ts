import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, highlightsTable } from "@workspace/db";
import {
  ListHighlightsQueryParams,
  ListHighlightsResponse,
  CreateHighlightBody,
  CreateHighlightResponse,
  UpdateHighlightParams,
  UpdateHighlightBody,
  UpdateHighlightResponse,
  DeleteHighlightParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeHighlight(h: typeof highlightsTable.$inferSelect) {
  return {
    ...h,
    captionSize: parseFloat(h.captionSize as string),
    zoomLevel: parseFloat(h.zoomLevel as string),
    createdAt: h.createdAt.toISOString(),
  };
}

router.get("/highlights", async (req, res): Promise<void> => {
  const query = ListHighlightsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let highlights = await db.select().from(highlightsTable);

  if (query.data.jobId) {
    highlights = highlights.filter((h) => h.jobId === query.data.jobId);
  }
  if (query.data.customerId) {
    highlights = highlights.filter((h) => h.customerId === query.data.customerId);
  }

  res.json(ListHighlightsResponse.parse(highlights.map(serializeHighlight)));
});

router.post("/highlights", async (req, res): Promise<void> => {
  const parsed = CreateHighlightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [highlight] = await db.insert(highlightsTable).values(parsed.data).returning();
  res.status(201).json(CreateHighlightResponse.parse(serializeHighlight(highlight)));
});

router.patch("/highlights/:id", async (req, res): Promise<void> => {
  const params = UpdateHighlightParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateHighlightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [highlight] = await db
    .update(highlightsTable)
    .set(parsed.data)
    .where(eq(highlightsTable.id, params.data.id))
    .returning();

  if (!highlight) {
    res.status(404).json({ error: "Highlight not found" });
    return;
  }

  res.json(UpdateHighlightResponse.parse(serializeHighlight(highlight)));
});

router.delete("/highlights/:id", async (req, res): Promise<void> => {
  const params = DeleteHighlightParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [highlight] = await db
    .delete(highlightsTable)
    .where(eq(highlightsTable.id, params.data.id))
    .returning();

  if (!highlight) {
    res.status(404).json({ error: "Highlight not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
