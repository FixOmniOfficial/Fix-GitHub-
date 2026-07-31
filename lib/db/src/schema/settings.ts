import { pgTable, text, serial, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  shopName: text("shop_name").notNull().default("सर्विस सेंटर"),
  logoUrl: text("logo_url"),
  globalWallpaper: text("global_wallpaper"),
  personalWallpaper: text("personal_wallpaper"),
  captionSize: numeric("caption_size", { precision: 5, scale: 2 }).notNull().default("1"),
  zoomLevel: numeric("zoom_level", { precision: 5, scale: 2 }).notNull().default("1"),
  theme: text("theme").notNull().default("light"),
  language: text("language").notNull().default("both"),
  homeLayout: text("home_layout"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;
