import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { validateBody } from "../middleware/validate";

const router = Router();

const memberSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["PERSON", "JOINT"]).default("PERSON"),
  color: z.string().default("#2563eb"),
});

router.get("/", async (_req, res) => {
  const members = await prisma.member.findMany({ orderBy: { createdAt: "asc" } });
  res.json(members);
});

router.post("/", validateBody(memberSchema), async (req, res) => {
  const member = await prisma.member.create({ data: req.body });
  res.status(201).json(member);
});

router.put("/:id", validateBody(memberSchema.partial()), async (req, res) => {
  const member = await prisma.member.update({ where: { id: req.params.id }, data: req.body });
  res.json(member);
});

export default router;
