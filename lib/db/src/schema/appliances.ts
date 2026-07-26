import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appliancesTable = pgTable("appliances", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  type: text("type").notNull(),
  brand: text("brand"),
  model: text("model"),
  serialNo: text("serial_no"),
  purchaseDate: text("purchase_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertApplianceSchema = createInsertSchema(appliancesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppliance = z.infer<typeof insertApplianceSchema>;
export type Appliance = typeof appliancesTable.$inferSelect;
