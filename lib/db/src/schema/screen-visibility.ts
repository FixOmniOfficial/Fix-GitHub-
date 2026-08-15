import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const screenVisibilityTable = pgTable("screen_visibility", {
  id:         serial("id").primaryKey(),
  screenKey:  text("screen_key").notNull().unique(),
  label:      text("label").notNull(),
  userType:   text("user_type").notNull().default("both"),   // "customer" | "technician" | "both"
  isEnabled:  boolean("is_enabled").notNull().default(true),
  sortOrder:  integer("sort_order").notNull().default(0),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ScreenVisibility = typeof screenVisibilityTable.$inferSelect;
