import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { professionalsTable } from "./professionals";

export const bookingsTable = pgTable("bookings", {
  id:            serial("id").primaryKey(),
  bookingUid:    text("booking_uid").notNull().unique(),
  customerName:  text("customer_name").notNull(),
  phone:         text("phone").notNull(),
  whatsappPhone: text("whatsapp_phone"),
  houseNumber:   text("house_number"),
  floorNumber:   text("floor_number"),
  address:       text("address"),
  location:      text("location"),
  bookingTime:   timestamp("booking_time", { withTimezone: true }),
  visitingCharge: numeric("visiting_charge", { precision: 10, scale: 2 }),
  professionalId: integer("professional_id").references(() => professionalsTable.id),
  professionType: text("profession_type").notNull(),
  serviceType:    text("service_type"),                        // Service | Repair | Installation
  status:         text("status").notNull().default("pending"), // pending | confirmed | completed | cancelled
  rating:         text("rating"),                              // 'good' | 'bad' | null
  notes:          text("notes"),
  viewedAt:       timestamp("viewed_at",  { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
