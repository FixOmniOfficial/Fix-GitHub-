import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const marketRatesTable = pgTable("market_rates", {
  id: serial("id").primaryKey(),
  professionType: text("profession_type").notNull(),
  serviceName: text("service_name").notNull(),
  rate: numeric("rate", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("per visit"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type MarketRate = typeof marketRatesTable.$inferSelect;
