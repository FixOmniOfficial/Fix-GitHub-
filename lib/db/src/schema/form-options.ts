import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const formOptionsTable = pgTable("form_options", {
  id:          serial("id").primaryKey(),
  label:       text("label").notNull(),
  value:       text("value").notNull(),
  icon:        text("icon"),                                   // emoji or icon name
  optionType:  text("option_type").notNull().default("service_type"), // "service_type" | "profession_type"
  sortOrder:   integer("sort_order").notNull().default(0),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type FormOption = typeof formOptionsTable.$inferSelect;
