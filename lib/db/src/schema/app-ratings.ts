import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const appRatingsTable = pgTable("app_ratings", {
  id: serial("id").primaryKey(),
  raterType: text("rater_type").notNull(), // 'customer' | 'technician' | 'admin'
  raterName: text("rater_name"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppRating = typeof appRatingsTable.$inferSelect;
