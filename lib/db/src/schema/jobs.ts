import { pgTable, text, serial, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobNumber: text("job_number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  applianceId: integer("appliance_id"),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  technicianName: text("technician_name"),
  scheduledDate: text("scheduled_date"),
  completedDate: text("completed_date"),
  isHighlighted: boolean("is_highlighted").notNull().default(false),
  isNumberHighlighted: boolean("is_number_highlighted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, jobNumber: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
