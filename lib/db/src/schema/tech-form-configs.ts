import { pgTable, text, serial, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

export const techFormConfigsTable = pgTable("tech_form_configs", {
  id: serial("id").primaryKey(),
  professionalId: serial("professional_id").notNull(),
  defaultVisitingCharge: numeric("default_visiting_charge", { precision: 10, scale: 2 }).default("0"),
  customMessage: text("custom_message"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TechFormConfig = typeof techFormConfigsTable.$inferSelect;
