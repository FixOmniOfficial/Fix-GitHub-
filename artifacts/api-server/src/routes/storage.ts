/**
 * Storage routes — presigned upload URLs + object serving
 * POST /api/storage/uploads/request-url  → get presigned PUT URL
 * GET  /api/storage/objects/*            → serve stored objects
 * POST /api/storage/uploads/multipart   → server-side upload (for mobile/Expo)
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService } from "../lib/objectStorage";
import multer from "multer";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { professionalsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ── Auth helper: allows Clerk OR X-Tech-Code ──────────────────────────────────
async function requireAnyAuth(req: Request, res: Response, next: () => void): Promise<void> {
  // Try tech-code first (mobile technicians)
  const techCode = req.headers["x-tech-code"] as string | undefined;
  if (techCode) {
    const [tech] = await db.select().from(professionalsTable).where(eq(professionalsTable.uniqueCode, techCode)).limit(1);
    if (!tech) { res.status(401).json({ error: "Invalid tech code" }); return; }
    (req as any).techCode = techCode;
    next(); return;
  }
  // Fallback to Clerk auth
  requireAuth(req, res, next);
}
const storage = new ObjectStorageService();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ── POST /api/storage/uploads/request-url ─────────────────────────────────────
// Browser clients request a presigned URL, then upload directly to GCS
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response): Promise<void> => {
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
// Accepts Clerk auth (admin panel) OR X-Tech-Code header (mobile technicians)
router.post(
  "/storage/uploads/multipart",
  requireAnyAuth,
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
// Accepts Clerk auth OR X-Tech-Code header.
router.post(
  "/storage/uploads/base64",
  requireAnyAuth,
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

// ── GET /api/public/avatar/:objectId ─────────────────────────────────────────
// Public (no-auth) serving for profile/avatar images.
// objectId is the UUID portion of the GCS object path.
router.get("/public/avatar/:objectId", async (req: Request, res: Response): Promise<void> => {
  // Sanitise: only allow hex/UUID chars + hyphens to prevent path traversal
  const id = req.params["objectId"];
  if (!id || !/^[\w\-]+$/.test(id)) { res.status(400).end(); return; }
  const objectPath = `/objects/${id}`;
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

// ── GET /api/storage/objects/** ───────────────────────────────────────────────
// Serve stored objects (KYC docs etc.) — auth required.
// Uses router.use() to avoid path-to-regexp v8 wildcard restrictions;
// req.path inside this sub-router gives the remainder after /storage/objects.
const objectsRouter: IRouter = Router();
objectsRouter.use(requireAuth, async (req: Request, res: Response): Promise<void> => {
  // req.path here is the portion after the mount point, e.g. "/uuid-abc123"
  const objectPath = `/objects${req.path}`;
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
