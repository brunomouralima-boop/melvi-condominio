import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { validateBody } from "../middleware/validate";

const router = Router();

const assetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["PROPERTY", "VEHICLE", "INVESTMENT", "OTHER"]).default("OTHER"),
  memberId: z.string().min(1),
  currencyCode: z.string().min(2),
  value: z.number().default(0),
  acquisitionValue: z.number().nullable().optional(),
  acquisitionDate: z.coerce.date().nullable().optional(),
  notes: z.string().default(""),
});

router.get("/", async (_req, res) => {
  const assets = await prisma.asset.findMany({
    include: { currency: true, member: true, liabilities: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(assets);
});

router.post("/", validateBody(assetSchema), async (req, res) => {
  const asset = await prisma.asset.create({ data: req.body });
  res.status(201).json(asset);
});

router.put("/:id", validateBody(assetSchema.partial()), async (req, res) => {
  const asset = await prisma.asset.update({ where: { id: req.params.id }, data: req.body });
  res.json(asset);
});

router.delete("/:id", async (req, res) => {
  await prisma.liability.updateMany({ where: { linkedAssetId: req.params.id }, data: { linkedAssetId: null } });
  await prisma.asset.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
