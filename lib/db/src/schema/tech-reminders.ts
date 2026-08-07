import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";

export const techRemindersTable = pgTable("tech_reminders", {
  id: serial("id").primaryKey(),
  techCode: text("tech_code").notNull(),
  title: text("title").notNull(),
  note: text("note"),
  reminderAt: text("reminder_at"), // ISO string, optional date/time
  isDone: boolean("is_done").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TechReminder = typeof techRemindersTable.$inferSelect;
