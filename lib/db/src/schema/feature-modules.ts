import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const featureModulesTable = pgTable("feature_modules", {
  id:          serial("id").primaryKey(),
  moduleKey:   text("module_key").notNull().unique(),
  label:       text("label").notNull(),
  description: text("description"),
  status:      text("status").notNull().default("draft"),   // "draft" | "published"
  sortOrder:   text("sort_order").notNull().default("0"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type FeatureModule = typeof featureModulesTable.$inferSelect;
