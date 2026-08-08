import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";

export const techRemindersTable = pgTable("tech_reminders", {
  id: serial("id").primaryKey(),
  techCode: text("tech_code").notNull(),
  title: text("title").notNull(),
  note: text("note"),
  reminderAt: text("reminder_at"),    // "YYYY-MM-DD HH:MM"
  ringtone: text("ringtone").default("default"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isDone: boolean("is_done").notNull().default(false),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TechReminder = typeof techRemindersTable.$inferSelect;
