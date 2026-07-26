import { pgTable, text, serial, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const highlightsTable = pgTable("highlights", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id"),
  customerId: integer("customer_id"),
  label: text("label").notNull(),
  color: text("color").notNull().default("#f59e0b"),
  captionSize: numeric("caption_size", { precision: 5, scale: 2 }).notNull().default("14"),
  isNumbered: boolean("is_numbered").notNull().default(false),
  isTicked: boolean("is_ticked").notNull().default(false),
  zoomLevel: numeric("zoom_level", { precision: 5, scale: 2 }).notNull().default("1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHighlightSchema = createInsertSchema(highlightsTable).omit({ id: true, createdAt: true });
export type InsertHighlight = z.infer<typeof insertHighlightSchema>;
export type Highlight = typeof highlightsTable.$inferSelect;
