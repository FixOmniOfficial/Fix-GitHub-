import { pgTable, text, serial, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { techPaymentsTable } from "./tech-payments";

export const techPaymentEntriesTable = pgTable("tech_payment_entries", {
  id:            serial("id").primaryKey(),
  paymentId:     integer("payment_id").notNull().references(() => techPaymentsTable.id, { onDelete: "cascade" }),
  amount:        numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"), // 'cash' | 'online'
  paidAt:        text("paid_at").notNull(),   // "YYYY-MM-DDTHH:MM" (datetime local string)
  note:          text("note"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TechPaymentEntry = typeof techPaymentEntriesTable.$inferSelect;
