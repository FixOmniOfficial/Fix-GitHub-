import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import customersRouter from "./customers";
import publicFormRouter from "./public-form";
import bookingRouter from "./booking";
import appliancesRouter from "./appliances";
import jobsRouter from "./jobs";
import highlightsRouter from "./highlights";
import remindersRouter from "./reminders";
import usersRouter from "./users";
import settingsRouter from "./settings";
import dashboardRouter from "./dashboard";
import kycRouter from "./kyc";
import storageRouter from "./storage";
import sandboxRouter from "./sandbox";
import superAdminRouter from "./super-admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(publicFormRouter); // public — no auth required
router.use(bookingRouter);   // public — booking system
router.use(customersRouter);
router.use(appliancesRouter);
router.use(jobsRouter);
router.use(highlightsRouter);
router.use(remindersRouter);
router.use(usersRouter);
router.use(settingsRouter);
router.use(dashboardRouter);
router.use(kycRouter);
router.use(storageRouter);
router.use(sandboxRouter);
router.use(superAdminRouter);

export default router;
