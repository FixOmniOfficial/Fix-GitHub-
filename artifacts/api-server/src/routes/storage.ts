/**
 * Storage routes — presigned upload URLs + object serving
 * POST /api/storage/uploads/request-url  → get presigned PUT URL
 * GET  /api/storage/objects/*            → serve stored objects
 * POST /api/storage/uploads/multipart   → server-side upload (for mobile/Expo)
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService } from "../lib/objectStorage";
import multer from "multer";
import { requireAuth, requireUploadActor } from "../middlewares/requireAuth";
import { db, kycDocumentsTable, professionalsTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";

const router: IRouter = Router();

const storage = new ObjectStorageService();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ── POST /api/storage/uploads/request-url ─────────────────────────────────────
// Browser clients request a presigned URL, then upload directly to GCS.
router.post("/storage/uploads/request-url", requireAuth, requireUploadActor, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, size, contentType } = req.body as { name?: string; size?: number; contentType?: string };
    if (!name || !contentType) {
      res.status(400).json({ error: "name and contentType are required" });
      return;
    }
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (err: any) {
    if (err?.message?.includes("suspended")) {
      res.status(503).json({ error: "App Storage service suspended — cloud budget exceeded" });
    } else {
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  }
});

// ── POST /api/storage/uploads/multipart ──────────────────────────────────────
// Mobile/server-side upload: receives multipart form, uploads to GCS, returns objectPath
router.post(
  "/storage/uploads/multipart",
  requireAuth,
  requireUploadActor,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      const uploadURL = await storage.getObjectEntityUploadURL();
      // Upload the buffer to GCS via the presigned URL
      const gcsRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": req.file.mimetype },
        body: req.file.buffer,
      });
      if (!gcsRes.ok) {
        res.status(500).json({ error: "GCS upload failed" });
        return;
      }
      const objectPath = storage.normalizeObjectEntityPath(uploadURL);
      res.json({ objectPath });
    } catch (err: any) {
      if (err?.message?.includes("suspended")) {
        res.status(503).json({ error: "App Storage service suspended" });
      } else {
        res.status(500).json({ error: "Upload failed" });
      }
    }
  }
);

// ── POST /api/storage/uploads/base64 ─────────────────────────────────────────
// Mobile-friendly upload: accepts JSON { data: base64String, contentType }.
// Avoids multipart/FormData parsing issues in React Native fetch.
router.post(
  "/storage/uploads/base64",
  requireAuth,
  requireUploadActor,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { data, contentType } = req.body as { data?: string; contentType?: string };
      if (!data || !contentType) {
        res.status(400).json({ error: "data and contentType are required" });
        return;
      }
      // Validate size: 8MB base64 ≈ 6MB binary — stay within limits
      if (data.length > 11_000_000) {
        res.status(413).json({ error: "Image too large (max ~8MB base64)" });
        return;
      }
      const buffer = Buffer.from(data, "base64");
      const uploadURL = await storage.getObjectEntityUploadURL();
      const gcsRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: buffer,
      });
      if (!gcsRes.ok) {
        const gcsBody = await gcsRes.text().catch(() => "");
        console.error("[storage/base64] GCS error:", gcsRes.status, gcsBody);
        res.status(500).json({ error: "GCS upload failed" });
        return;
      }
      const objectPath = storage.normalizeObjectEntityPath(uploadURL);
      res.json({ objectPath });
    } catch (err: any) {
      console.error("[storage/base64] error:", err);
      if (err?.message?.includes("suspended")) {
        res.status(503).json({ error: "App Storage service suspended" });
      } else {
        res.status(500).json({ error: "Upload failed", details: String(err?.message ?? "") });
      }
    }
  }
);

// ── GET /api/public/avatar/** ─────────────────────────────────────────────────
// Public (no-auth) serving for profile/avatar images.
// Uses router.use() (like objectsRouter) so req.path captures the full
// sub-path including any "uploads/UUID" segments — avoids the /:id limitation
// that only matches a single path segment.
// Security: blocks path traversal and serves only paths currently assigned as
// a technician avatar. KYC documents share the object store but are never
// eligible for this unauthenticated route.
const publicAvatarRouter: IRouter = Router();
publicAvatarRouter.use(async (req: Request, res: Response): Promise<void> => {
  // req.path = e.g. "/uploads/de25e075-..." after the mount point
  const subPath = req.path;
  // Block path-traversal attempts
  if (!subPath || subPath.includes("..")) { res.status(400).end(); return; }
  const publicAvatarPath = `/api/public/avatar${subPath}`;
  const avatarRecords = await db
    .select({ avatarUrl: professionalsTable.avatarUrl })
    .from(professionalsTable);
  const isKnownAvatar = avatarRecords.some(({ avatarUrl }) => {
    if (!avatarUrl) return false;
    try {
      return new URL(avatarUrl).pathname === publicAvatarPath;
    } catch {
      return avatarUrl === publicAvatarPath;
    }
  });
  if (!isKnownAvatar) { res.status(404).end(); return; }
  const objectPath = `/objects${subPath}`;
  try {
    const file = await storage.getObjectEntityFile(objectPath);
    const response = await storage.downloadObject(file, 86400);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buf = Buffer.from(await response.arrayBuffer());
    res.send(buf);
  } catch (err: any) {
    if (err?.constructor?.name === "ObjectNotFoundError" || err?.message?.includes("not found")) {
      res.status(404).end();
    } else {
      res.status(500).end();
    }
  }
});
router.use("/public/avatar", publicAvatarRouter);

// ── GET /api/storage/objects/** ───────────────────────────────────────────────
// Serve stored objects (KYC docs etc.) only to a KYC reviewer/admin or the
// technician whose KYC record references the requested object.
// Uses router.use() to avoid path-to-regexp v8 wildcard restrictions;
// req.path inside this sub-router gives the remainder after /storage/objects.
const objectsRouter: IRouter = Router();
objectsRouter.use(requireAuth, async (req: Request, res: Response): Promise<void> => {
  // req.path here is the portion after the mount point, e.g. "/uuid-abc123"
  if (!req.path || req.path.includes("..")) {
    res.status(400).json({ error: "Invalid object path" });
    return;
  }
  const objectPath = `/objects${req.path}`;
  const context = req.supabaseContext!;
  const canReviewKyc =
    context.supabaseRole === "admin" ||
    context.supabaseRole === "super_admin" ||
    context.supabasePermissions.includes("kyc_review");

  if (!canReviewKyc) {
    const professionalId = context.supabaseProfile.professionalId;
    if (!professionalId) {
      res.status(403).json({ error: "You do not have access to this document" });
      return;
    }
    const [ownedDocument] = await db
      .select({ id: kycDocumentsTable.id })
      .from(kycDocumentsTable)
      .where(and(
        eq(kycDocumentsTable.professionalId, professionalId),
        or(
          eq(kycDocumentsTable.panCardPath, objectPath),
          eq(kycDocumentsTable.addressProofPath, objectPath),
        ),
      ))
      .limit(1);
    if (!ownedDocument) {
      res.status(403).json({ error: "You do not have access to this document" });
      return;
    }
  }
  try {
    const file = await storage.getObjectEntityFile(objectPath);
    const response = await storage.downloadObject(file, 300);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    const buf = Buffer.from(await response.arrayBuffer());
    res.send(buf);
  } catch (err: any) {
    if (err?.constructor?.name === "ObjectNotFoundError" || err?.message?.includes("not found")) {
      res.status(404).json({ error: "Object not found" });
    } else {
      res.status(500).json({ error: "Failed to serve object" });
    }
  }
});
router.use("/storage/objects", objectsRouter);

export default router;
