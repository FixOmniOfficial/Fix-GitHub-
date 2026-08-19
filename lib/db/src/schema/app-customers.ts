import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const appCustomersTable = pgTable("app_customers", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  phone:        text("phone"),
  email:        text("email").unique(),
  passwordHash: text("password_hash"),
  uniqueCode:   text("unique_code").notNull().unique(),
  otpCode:      text("otp_code"),
  otpExpiresAt: timestamp("otp_expires_at", { withTimezone: true }),
  otpAttempts:  integer("otp_attempts").default(0),
  isTestData:   boolean("is_test_data").notNull().default(false),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
