import { Router } from "express";
import auth from "./auth";
import users from "./users";
import units from "./units"; // LEGACY alias para /api/fractions
import condominium from "./condominium"; // singular — info do condo activo + stats
import condominiums from "./condominiums";
import towers from "./towers";
import fractions from "./fractions";
import meters from "./meters";
import dependents from "./dependents";
import domesticEmployees from "./domesticEmployees";
import vehicles from "./vehicles";
import pets from "./pets";
import qrCodes from "./qrCodes";
import accessLogs from "./accessLogs";
import visits from "./visits";
import occurrences from "./occurrences";
import panicAlerts from "./panicAlerts";
import announcements from "./announcements";
import commonAreas from "./commonAreas";
import reservations from "./reservations";
import financial from "./financial";
import maintenance from "./maintenance";
import assemblies from "./assemblies";
import packages from "./packages";
import notifications from "./notifications";
import documents from "./documents";
import uploads from "./uploads";
import system from "./system";

const router = Router();

router.use("/auth", auth);
router.use("/users", users);
router.use("/condominium", condominium);
router.use("/condominiums", condominiums);
router.use("/towers", towers);
router.use("/fractions", fractions);
router.use("/meters", meters);
router.use("/units", units); // legacy alias
router.use("/dependents", dependents);
router.use("/domestic-employees", domesticEmployees);
router.use("/vehicles", vehicles);
router.use("/pets", pets);
router.use("/qr-codes", qrCodes);
router.use("/access-logs", accessLogs);
router.use("/visits", visits);
router.use("/occurrences", occurrences);
router.use("/panic-alerts", panicAlerts);
router.use("/announcements", announcements);
router.use("/common-areas", commonAreas);
router.use("/reservations", reservations);
router.use("/financial", financial);
router.use("/maintenance", maintenance);
router.use("/assemblies", assemblies);
router.use("/packages", packages);
router.use("/notifications", notifications);
router.use("/documents", documents);
router.use("/uploads", uploads);
router.use("/system", system);

export default router;
