import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Keep a lightweight, dependency-free endpoint available for deployment health checks.
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
