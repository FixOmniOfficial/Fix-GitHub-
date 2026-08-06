import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const helplineMessagesTable = pgTable("helpline_messages", {
  id: serial("id").primaryKey(),
  senderType: text("sender_type").notNull(), // 'customer' | 'technician'
  senderName: text("sender_name").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  isResolved: boolean("is_resolved").notNull().default(false),
  adminReply: text("admin_reply"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HelplineMessage = typeof helplineMessagesTable.$inferSelect;
