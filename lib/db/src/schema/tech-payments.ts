import { pgTable, text, serial, numeric, timestamp } from "drizzle-orm/pg-core";

export const techPaymentsTable = pgTable("tech_payments", {
  id: serial("id").primaryKey(),
  techCode: text("tech_code").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  jobDescription: text("job_description"),
  amountBilled: numeric("amount_billed", { precision: 10, scale: 2 }).notNull().default("0"),
  amountReceived: numeric("amount_received", { precision: 10, scale: 2 }).notNull().default("0"),
  // balance = amountBilled - amountReceived (computed in app/API)
  status: text("status").notNull().default("pending"), // pending | paid | partial
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TechPayment = typeof techPaymentsTable.$inferSelect;
