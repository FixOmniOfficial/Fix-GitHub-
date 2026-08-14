import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const serviceCategoriesTable = pgTable("service_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("settings"),
  imageUrl: text("image_url"),
  accent: text("accent").notNull().default("#6b7280"),
  professionType: text("profession_type").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
