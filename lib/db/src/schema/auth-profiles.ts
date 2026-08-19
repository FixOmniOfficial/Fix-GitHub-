import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Application authorization data for a Supabase Auth identity.
 *
 * Authentication credentials always remain in auth.users. This table contains
 * only Fix Omni-specific roles and links to the existing domain records.
 */
export const authProfilesTable = pgTable("auth_profiles", {
  id: uuid("id").primaryKey(),
  role: text("role").notNull().default("user"),
  permissions: text("permissions").array().notNull().default([]),
  userType: text("user_type").notNull().default("admin"),
  appUserId: integer("app_user_id"),
  professionalId: integer("professional_id"),
  appCustomerId: integer("app_customer_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAuthProfileSchema = createInsertSchema(authProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthProfile = z.infer<typeof insertAuthProfileSchema>;
export type AuthProfile = typeof authProfilesTable.$inferSelect;