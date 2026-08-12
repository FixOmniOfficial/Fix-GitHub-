import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const KYC_STATUS = ["pending", "verified", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUS)[number];

/**
 * Stores KYC document submissions for each technician.
 * One row per professional (upsert on re-submission).
 */
export const kycDocumentsTable = pgTable("kyc_documents", {
  id:               serial("id").primaryKey(),
  professionalId:   integer("professional_id").notNull().unique(), // FK → professionalsTable.id
  // ── Personal details ────────────────────────────────────────────────────────
  fullName:         text("full_name").notNull(),
  email:            text("email"),
  // ── Document paths (objectPath from GCS, e.g. "/objects/uploads/xxx") ───────
  panCardPath:      text("pan_card_path"),
  addressProofPath: text("address_proof_path"),
  // ── Review ──────────────────────────────────────────────────────────────────
  status:           text("status", { enum: KYC_STATUS }).notNull().default("pending"),
  reviewedBy:       text("reviewed_by"),   // Clerk userId of reviewer
  reviewerName:     text("reviewer_name"),
  reviewNotes:      text("review_notes"),
  reviewedAt:       timestamp("reviewed_at", { withTimezone: true }),
  // ── Timestamps ──────────────────────────────────────────────────────────────
  submittedAt:      timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKycDocumentSchema = createInsertSchema(kycDocumentsTable).omit({
  id: true, submittedAt: true, updatedAt: true,
});
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type KycDocument = typeof kycDocumentsTable.$inferSelect;
