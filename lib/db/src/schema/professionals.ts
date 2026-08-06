import { pgTable, text, serial, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const professionTypes = [
  "ac_technician",
  "carpenter",
  "electrician",
  "plumber",
  "painter",
  "repair",
] as const;

export const professionalsTable = pgTable("professionals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  professionType: text("profession_type").notNull(),
  phone: text("phone"),
  avatarEmoji: text("avatar_emoji").default("👤"),
  visitingCharge: numeric("visiting_charge", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfessionalSchema = createInsertSchema(professionalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfessional = z.infer<typeof insertProfessionalSchema>;
export type Professional = typeof professionalsTable.$inferSelect;
