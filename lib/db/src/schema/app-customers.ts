import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const appCustomersTable = pgTable("app_customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  uniqueCode: text("unique_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
