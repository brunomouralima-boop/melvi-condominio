import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { validateBody } from "../middleware/validate";

const router = Router();

const categorySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
  color: z.string().default("#64748b"),
  parentId: z.string().nullable().optional(),
});

router.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] });
  res.json(categories);
});

router.post("/", validateBody(categorySchema), async (req, res) => {
  const category = await prisma.category.create({ data: req.body });
  res.status(201).json(category);
});

router.put("/:id", validateBody(categorySchema.partial()), async (req, res) => {
  const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
  res.json(category);
});

router.delete("/:id", async (req, res) => {
  const count = await prisma.transaction.count({ where: { categoryId: req.params.id } });
  if (count > 0) {
    return res.status(409).json({ error: "Categoria em uso por lançamentos." });
  }
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
