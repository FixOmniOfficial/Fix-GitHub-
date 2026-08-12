import { pgTable, text, serial, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  // ── Branding / Identity ────────────────────────────────────────────────────
  appName:    text("app_name").notNull().default("Fixomni App"),
  appLogoUrl: text("app_logo_url"),
  playStoreUrl: text("play_store_url"),
  webAppUrl:  text("web_app_url"),
  // ── Legacy fields ─────────────────────────────────────────────────────────
  shopName: text("shop_name").notNull().default("सर्विस सेंटर"),
  logoUrl:  text("logo_url"),
  globalWallpaper:   text("global_wallpaper"),
  personalWallpaper: text("personal_wallpaper"),
  captionSize: numeric("caption_size", { precision: 5, scale: 2 }).notNull().default("1"),
  zoomLevel:   numeric("zoom_level",   { precision: 5, scale: 2 }).notNull().default("1"),
  theme:    text("theme").notNull().default("light"),
  language: text("language").notNull().default("both"),
  homeLayout: text("home_layout"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  // ── Dynamic form icons (admin-configurable emoji / URL) ────────────────────
  iconTechnician:  text("icon_technician").notNull().default("👤"),
  iconServiceType: text("icon_service_type").notNull().default("🛠️"),
  iconFullName:    text("icon_full_name").notNull().default("👤"),
  iconMobileNo:    text("icon_mobile_no").notNull().default("📞"),
  iconHouseNo:     text("icon_house_no").notNull().default("🏠"),
  iconSelectFloor: text("icon_select_floor").notNull().default("🏢"),
  iconFullAddress: text("icon_full_address").notNull().default("🗺️"),
  iconGps:         text("icon_gps").notNull().default("🎯"),
  // ── Bootstrap (first super_admin claim) ───────────────────────────────────
  // Written atomically via UPDATE WHERE first_admin_claimed_by IS NULL.
  // Non-null means a super_admin has already been established.
  firstAdminClaimedBy: text("first_admin_claimed_by"),
  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;
