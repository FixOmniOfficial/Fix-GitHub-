import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import customersRouter from "./customers";
import publicFormRouter from "./public-form";
import appliancesRouter from "./appliances";
import jobsRouter from "./jobs";
import highlightsRouter from "./highlights";
import remindersRouter from "./reminders";
import usersRouter from "./users";
import settingsRouter from "./settings";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(publicFormRouter); // public — no auth required
router.use(customersRouter);
router.use(appliancesRouter);
router.use(jobsRouter);
router.use(highlightsRouter);
router.use(remindersRouter);
router.use(usersRouter);
router.use(settingsRouter);
router.use(dashboardRouter);

export default router;
