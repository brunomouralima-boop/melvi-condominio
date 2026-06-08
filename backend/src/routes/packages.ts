import { Router } from "express";
import { z } from "zod";
import { Role, PackageStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { resolveCondominium, tenantWhere } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";
import { emitToUser } from "../sockets";

const router = Router();
router.use(authenticate);
router.use(resolveCondominium);

router.get("/", async (req, res) => {
  const where: any = { ...tenantWhere(req) };
  if (req.user!.role === Role.RESIDENT) where.fractionId = req.user!.fractionId;
  const items = await prisma.package.findMany({
    where,
    include: {
      fraction: { include: { tower: true, residents: { select: { id: true, name: true } } } },
      receivedBy: { select: { id: true, name: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: 200,
  });
  res.json(items);
});

const createSchema = z.object({
  description: z.string().min(2),
  sender: z.string().min(1),
  fractionId: z.string().uuid().optional(),
  // legacy alias
  unitId: z.string().uuid().optional(),
});

router.post("/", authorize(Role.DOORMAN, Role.ADMIN), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const fractionId = body.fractionId ?? body.unitId;
  if (!fractionId) return res.status(400).json({ error: "fractionId required" });
  const item = await prisma.package.create({
    data: { description: body.description, sender: body.sender, fractionId, condominiumId: req.condominiumId, receivedById: req.user!.sub },
    include: { fraction: { include: { residents: { select: { id: true } } } } },
  });
  for (const r of item.fraction.residents) {
    await prisma.notification.create({
      data: {
        userId: r.id,
        title: "Encomenda recebida",
        message: `Você tem uma encomenda de ${item.sender}.`,
        type: "INFO",
        relatedId: item.id,
      },
    });
    emitToUser(r.id, "package:new", item);
  }
  res.status(201).json(item);
});

router.put("/:id/deliver", authorize(Role.DOORMAN, Role.ADMIN), async (req, res) => {
  const existing = await prisma.package.findUnique({ where: { id: req.params.id }, select: { condominiumId: true } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Not found" });
  }
  const updated = await prisma.package.update({
    where: { id: req.params.id },
    data: { status: PackageStatus.DELIVERED, deliveredAt: new Date() },
  });
  res.json(updated);
});

export default router;
