import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { validateBody } from "../middleware/validate";

const router = Router();

const liabilitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["MORTGAGE", "LOAN", "CREDIT", "OTHER"]).default("LOAN"),
  memberId: z.string().min(1),
  currencyCode: z.string().min(2),
  outstandingBalance: z.number().default(0),
  originalAmount: z.number().nullable().optional(),
  linkedAssetId: z.string().nullable().optional(),
  notes: z.string().default(""),
});

router.get("/", async (_req, res) => {
  const liabilities = await prisma.liability.findMany({
    include: { currency: true, member: true, linkedAsset: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(liabilities);
});

router.post("/", validateBody(liabilitySchema), async (req, res) => {
  const liability = await prisma.liability.create({ data: req.body });
  res.status(201).json(liability);
});

router.put("/:id", validateBody(liabilitySchema.partial()), async (req, res) => {
  const liability = await prisma.liability.update({ where: { id: req.params.id }, data: req.body });
  res.json(liability);
});

router.delete("/:id", async (req, res) => {
  await prisma.liability.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
