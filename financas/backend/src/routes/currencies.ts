import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { validateBody } from "../middleware/validate";

const router = Router();

const currencySchema = z.object({
  code: z.string().min(2).max(5).transform((s) => s.toUpperCase()),
  name: z.string().min(1),
  symbol: z.string().min(1),
  rateToBase: z.number().positive(),
});

router.get("/", async (_req, res) => {
  const currencies = await prisma.currency.findMany({ orderBy: [{ isBase: "desc" }, { code: "asc" }] });
  res.json(currencies);
});

// Cria ou atualiza (upsert) — útil para acertar taxas de câmbio.
router.post("/", validateBody(currencySchema), async (req, res) => {
  const { code, ...rest } = req.body as z.infer<typeof currencySchema>;
  const currency = await prisma.currency.upsert({
    where: { code },
    create: { code, ...rest },
    update: rest,
  });
  res.json(currency);
});

const rateSchema = z.object({ rateToBase: z.number().positive() });

router.put("/:code/rate", validateBody(rateSchema), async (req, res) => {
  const currency = await prisma.currency.update({
    where: { code: req.params.code.toUpperCase() },
    data: { rateToBase: req.body.rateToBase },
  });
  res.json(currency);
});

export default router;
