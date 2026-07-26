import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appUsersTable = pgTable("app_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("technician"),
  permissions: text("permissions").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppUserSchema = createInsertSchema(appUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type AppUser = typeof appUsersTable.$inferSelect;
