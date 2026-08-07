import { pgTable, text, serial, numeric, timestamp } from "drizzle-orm/pg-core";

export const techFormSubmissionsTable = pgTable("tech_form_submissions", {
  id: serial("id").primaryKey(),
  professionalId: serial("professional_id").notNull(),
  techCode: text("tech_code").notNull(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  fullAddress: text("full_address"),
  sector: text("sector"),
  floorNumber: text("floor_number"),
  houseNumber: text("house_number"),
  location: text("location"),
  visitingCharge: numeric("visiting_charge", { precision: 10, scale: 2 }),
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending | completed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TechFormSubmission = typeof techFormSubmissionsTable.$inferSelect;
