import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const homeConfigTable = pgTable("home_config", {
  id: serial("id").primaryKey(),
  helplineNumber: text("helpline_number").notNull().default("9999999999"),
  helplineName: text("helpline_name").notNull().default("Admin Helpline"),
  isLocked: boolean("is_locked").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
