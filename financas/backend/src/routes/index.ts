import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import auth from "./auth";
import members from "./members";
import currencies from "./currencies";
import accounts from "./accounts";
import categories from "./categories";
import transactions from "./transactions";
import assets from "./assets";
import liabilities from "./liabilities";
import reports from "./reports";

const router = Router();

router.use("/auth", auth);

// Tudo abaixo exige autenticação.
router.use(requireAuth);
router.use("/members", members);
router.use("/currencies", currencies);
router.use("/accounts", accounts);
router.use("/categories", categories);
router.use("/transactions", transactions);
router.use("/assets", assets);
router.use("/liabilities", liabilities);
router.use("/reports", reports);

export default router;
