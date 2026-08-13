import { pgTable, text, serial, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";
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

/** Human-readable labels for each profession type */
export const PROFESSION_LABELS: Record<string, string> = {
  ac_technician: "AC Technician",
  carpenter:     "Carpenter",
  electrician:   "Electrician",
  plumber:       "Plumber",
  painter:       "Painter",
  repair:        "Repair",
};

export const professionalsTable = pgTable("professionals", {
  id:                   serial("id").primaryKey(),
  name:                 text("name").notNull(),
  professionType:       text("profession_type").notNull(),
  phone:                text("phone"),
  email:                text("email").unique(),
  passwordHash:         text("password_hash"),
  avatarEmoji:          text("avatar_emoji").default("👤"),
  visitingCharge:       numeric("visiting_charge", { precision: 10, scale: 2 }),
  rating:               numeric("rating", { precision: 3, scale: 1 }).default("4.5"),
  shopName:             text("shop_name"),
  uniqueCode:           text("unique_code").unique(),
  isActive:             boolean("is_active").notNull().default(true),
  isTestData:           boolean("is_test_data").notNull().default(false),
  otpCode:              text("otp_code"),
  otpExpiresAt:         timestamp("otp_expires_at", { withTimezone: true }),
  otpAttempts:          integer("otp_attempts").default(0),
  tempPasscode:         text("temp_passcode"),
  tempPasscodeExpiresAt: timestamp("temp_passcode_expires_at", { withTimezone: true }),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfessionalSchema = createInsertSchema(professionalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfessional = z.infer<typeof insertProfessionalSchema>;
export type Professional = typeof professionalsTable.$inferSelect;
