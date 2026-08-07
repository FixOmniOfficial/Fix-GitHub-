import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const techCustomersTable = pgTable("tech_customers", {
  id: serial("id").primaryKey(),
  techCode: text("tech_code").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  jobType: text("job_type"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TechCustomer = typeof techCustomersTable.$inferSelect;
