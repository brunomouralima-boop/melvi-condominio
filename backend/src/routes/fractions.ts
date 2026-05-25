import { Router } from "express";
import { z } from "zod";
import { Role, FractionType, FractionStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);

const ownerTenantSelect = { id: true, name: true, email: true, avatar: true, phone: true } as const;

router.get("/", async (req, res) => {
  const { towerId, condominiumId, status, type, search } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (towerId) where.towerId = towerId;
  if (condominiumId) where.tower = { condominiumId };
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) where.identifier = { contains: search, mode: "insensitive" };

  const items = await prisma.fraction.findMany({
    where,
    include: {
      tower: { include: { condominium: { select: { id: true, name: true } } } },
      owner: { select: ownerTenantSelect },
      tenant: { select: ownerTenantSelect },
      residents: { select: { id: true, name: true } },
    },
    orderBy: [{ towerId: "asc" }, { floor: "asc" }, { identifier: "asc" }],
  });
  res.json(items);
});

const createSchema = z.object({
  towerId: z.string().uuid(),
  identifier: z.string().min(1),
  floor: z.number().int().nonnegative(),
  type: z.nativeEnum(FractionType).optional(),
  status: z.nativeEnum(FractionStatus).optional(),
  permillage: z.number().positive(),
  areaM2: z.number().positive(),
  privateAreaM2: z.number().optional().nullable(),
  commonAreaM2: z.number().optional().nullable(),
  grossAreaM2: z.number().optional().nullable(),
  bedroomsCount: z.number().int().min(0).optional(),
  bathroomsCount: z.number().int().min(0).optional(),
  parkingSpots: z.number().int().min(0).optional(),
  hasBalcony: z.boolean().optional(),
  hasSuite: z.boolean().optional(),
  hasStorageRoom: z.boolean().optional(),
  orientation: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  tenantId: z.string().uuid().optional().nullable(),
});

router.post("/", authorize(Role.ADMIN), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  if (body.ownerId && body.tenantId && body.ownerId === body.tenantId) {
    return res.status(400).json({ error: "Proprietário e inquilino não podem ser o mesmo utilizador." });
  }
  if (body.tenantId && !body.ownerId) {
    return res.status(400).json({ error: "Uma fracção só pode ter inquilino se tiver proprietário definido." });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const fr = await tx.fraction.create({
        data: {
          ...body,
          permillage: body.permillage as any,
          areaM2: body.areaM2 as any,
          privateAreaM2: body.privateAreaM2 as any,
          commonAreaM2: body.commonAreaM2 as any,
          grossAreaM2: body.grossAreaM2 as any,
        } as any,
      });
      // sync User.fractionId for owner (if no tenant) and tenant
      const residentId = body.tenantId ?? body.ownerId;
      if (residentId) {
        await tx.user.update({ where: { id: residentId }, data: { fractionId: fr.id } });
      }
      return fr;
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "Identificador duplicado nesta torre." });
    throw e;
  }
});

router.get("/:id", async (req, res) => {
  const item = await prisma.fraction.findUnique({
    where: { id: req.params.id },
    include: {
      tower: { include: { condominium: true } },
      owner: { select: ownerTenantSelect },
      tenant: { select: ownerTenantSelect },
      residents: { select: { id: true, name: true, email: true } },
    },
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

const updateSchema = createSchema.partial().omit({ towerId: true });

router.put("/:id", authorize(Role.ADMIN), validateBody(updateSchema), async (req, res) => {
  const body = req.body as z.infer<typeof updateSchema>;
  if (body.ownerId && body.tenantId && body.ownerId === body.tenantId) {
    return res.status(400).json({ error: "Proprietário e inquilino não podem ser o mesmo utilizador." });
  }

  const before = await prisma.fraction.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });

  if (body.tenantId && !body.ownerId && !before.ownerId) {
    return res.status(400).json({ error: "Uma fracção só pode ter inquilino se tiver proprietário definido." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const fr = await tx.fraction.update({
      where: { id: req.params.id },
      data: {
        ...body,
        permillage: body.permillage as any,
        areaM2: body.areaM2 as any,
        privateAreaM2: body.privateAreaM2 as any,
        commonAreaM2: body.commonAreaM2 as any,
        grossAreaM2: body.grossAreaM2 as any,
      } as any,
    });
    // resync residence
    if (body.ownerId !== undefined || body.tenantId !== undefined) {
      // remove fractionId from anyone whose was previously linked to this fraction
      await tx.user.updateMany({ where: { fractionId: fr.id }, data: { fractionId: null } });
      const residentId = (body.tenantId !== undefined ? body.tenantId : fr.tenantId) ?? (body.ownerId !== undefined ? body.ownerId : fr.ownerId);
      if (residentId) {
        await tx.user.update({ where: { id: residentId }, data: { fractionId: fr.id } });
      }
    }
    return fr;
  });

  res.json(updated);
});

router.patch("/:id/status", authorize(Role.ADMIN), async (req, res) => {
  const schema = z.object({ isActive: z.boolean() });
  const { isActive } = schema.parse(req.body);
  const updated = await prisma.fraction.update({ where: { id: req.params.id }, data: { isActive } });
  res.json(updated);
});

router.delete("/:id", authorize(Role.ADMIN), async (req, res) => {
  const fr = await prisma.fraction.findUnique({ where: { id: req.params.id } });
  if (!fr) return res.status(404).json({ error: "Not found" });
  if (fr.isActive) {
    return res.status(409).json({ error: "Desactive a fracção antes de a eliminar." });
  }
  const [finCount, openOcc] = await Promise.all([
    prisma.financialRecord.count({ where: { fractionId: req.params.id } }),
    prisma.occurrence.count({ where: { fractionId: req.params.id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  const blockers: string[] = [];
  if (finCount > 0) blockers.push(`${finCount} registo(s) financeiro(s)`);
  if (openOcc > 0) blockers.push(`${openOcc} ocorrência(s) abertas`);
  if (blockers.length) {
    return res.status(409).json({ error: `Não pode eliminar: ${blockers.join(", ")}.` });
  }
  await prisma.fraction.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

const ownerSchema = z.object({ ownerId: z.string().uuid().nullable() });

router.patch("/:id/owner", authorize(Role.ADMIN), validateBody(ownerSchema), async (req, res) => {
  const { ownerId } = req.body as z.infer<typeof ownerSchema>;
  const before = await prisma.fraction.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });
  if (ownerId && before.tenantId === ownerId) {
    return res.status(400).json({ error: "Proprietário e inquilino não podem ser o mesmo utilizador." });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const fr = await tx.fraction.update({ where: { id: req.params.id }, data: { ownerId } });
    await tx.auditLog.create({
      data: {
        userId: req.user!.sub,
        action: "FRACTION_OWNER_CHANGED",
        entity: "Fraction",
        entityId: fr.id,
        metadata: { previousOwnerId: before.ownerId, newOwnerId: ownerId },
      },
    });
    // resync residence
    if (!fr.tenantId && ownerId) {
      await tx.user.update({ where: { id: ownerId }, data: { fractionId: fr.id } });
    }
    if (!ownerId && before.ownerId) {
      await tx.user.updateMany({ where: { id: before.ownerId, fractionId: fr.id }, data: { fractionId: null } });
    }
    return fr;
  });
  res.json(updated);
});

const tenantSchema = z.object({ tenantId: z.string().uuid().nullable() });

router.patch("/:id/tenant", authorize(Role.ADMIN), validateBody(tenantSchema), async (req, res) => {
  const { tenantId } = req.body as z.infer<typeof tenantSchema>;
  const before = await prisma.fraction.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });
  if (tenantId && before.ownerId === tenantId) {
    return res.status(400).json({ error: "Proprietário e inquilino não podem ser o mesmo utilizador." });
  }
  if (tenantId && !before.ownerId) {
    return res.status(400).json({ error: "Uma fracção só pode ter inquilino se tiver proprietário definido." });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const fr = await tx.fraction.update({ where: { id: req.params.id }, data: { tenantId } });
    await tx.auditLog.create({
      data: {
        userId: req.user!.sub,
        action: "FRACTION_TENANT_CHANGED",
        entity: "Fraction",
        entityId: fr.id,
        metadata: { previousTenantId: before.tenantId, newTenantId: tenantId },
      },
    });
    if (tenantId) {
      await tx.user.update({ where: { id: tenantId }, data: { fractionId: fr.id } });
    } else if (before.tenantId) {
      await tx.user.updateMany({ where: { id: before.tenantId, fractionId: fr.id }, data: { fractionId: null } });
    }
    return fr;
  });
  res.json(updated);
});

export default router;
