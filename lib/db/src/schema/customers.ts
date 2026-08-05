import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  serialNumber: serial("serial_number"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  whatsappPhone: text("whatsapp_phone"),
  houseNumber: text("house_number"),
  floorNumber: text("floor_number"),
  address: text("address"),
  location: text("location"),
  visitingAmount: numeric("visiting_amount", { precision: 10, scale: 2 }),
  dpUrl: text("dp_url"),
  notes: text("notes"),
  shareToken: text("share_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, serialNumber: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
