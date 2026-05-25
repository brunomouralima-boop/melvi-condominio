import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { hashPassword } from "../utils/password";

const router = Router();
router.use(authenticate);

router.get("/", authorize(Role.ADMIN), async (req, res) => {
  const { role, search, includeInactive } = req.query as { role?: Role; search?: string; includeInactive?: string };
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(includeInactive === "true" ? {} : { isActive: true }),
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      fraction: { include: { tower: true } },
      ownedFractions: { select: { id: true, identifier: true, towerId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(users.map(({ password, ...u }) => u));
});

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
  phone: z.string().optional(),
  fractionId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(), // legacy
});

router.post("/", authorize(Role.ADMIN), validateBody(createUserSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createUserSchema>;
  const fractionId = body.fractionId ?? body.unitId ?? null;
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      password: await hashPassword(body.password),
      role: body.role,
      phone: body.phone,
      fractionId,
    },
  });
  const { password, ...safe } = user;
  res.status(201).json(safe);
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  fractionId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(Role).optional(),
});

router.put("/:id", authorize(Role.ADMIN), validateBody(updateUserSchema), async (req, res) => {
  const body = req.body as z.infer<typeof updateUserSchema>;
  const { unitId, ...data } = body;
  if (unitId !== undefined && data.fractionId === undefined) (data as any).fractionId = unitId;
  const updated = await prisma.user.update({ where: { id: req.params.id }, data });
  const { password, ...safe } = updated;
  res.json(safe);
});

// Activate user
router.patch("/:id/activate", authorize(Role.ADMIN), async (req, res) => {
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: true },
  });
  const { password, ...safe } = updated;
  res.json(safe);
});

// Deactivate user — invalidates tokens and disables active QR codes
router.patch("/:id/deactivate", authorize(Role.ADMIN), async (req, res) => {
  if (req.params.id === req.user!.sub) {
    return res.status(400).json({ error: "Não pode desactivar o próprio utilizador." });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } }),
    prisma.refreshToken.deleteMany({ where: { userId: req.params.id } }),
    prisma.qRAccessCode.updateMany({
      where: { createdById: req.params.id, isActive: true },
      data: { isActive: false },
    }),
  ]);
  res.json({ ok: true });
});

// DELETE — anonymize + soft delete. Blocks if user owns active fraction.
router.delete("/:id", authorize(Role.ADMIN), async (req, res) => {
  if (req.params.id === req.user!.sub) {
    return res.status(400).json({ error: "Não pode eliminar o próprio utilizador." });
  }
  const ownedActive = await prisma.fraction.count({
    where: { ownerId: req.params.id, isActive: true },
  });
  if (ownedActive > 0) {
    return res.status(409).json({
      error: `Este utilizador é proprietário de ${ownedActive} fracção(ões) activa(s). Reatribua antes de eliminar.`,
    });
  }
  // Remover relação de inquilino (mantém a fracção)
  await prisma.fraction.updateMany({
    where: { tenantId: req.params.id },
    data: { tenantId: null },
  });
  await prisma.user.update({
    where: { id: req.params.id },
    data: {
      name: "Utilizador Removido",
      email: `${crypto.randomUUID()}@deleted.local`,
      phone: null,
      avatar: null,
      isActive: false,
      deletedAt: new Date(),
      fractionId: null,
    },
  });
  await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });
  res.json({ ok: true });
});

router.post("/:id/reset-password", authorize(Role.ADMIN), async (req, res) => {
  const newPassword = (req.body as { newPassword?: string }).newPassword;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 chars" });
  }
  await prisma.user.update({
    where: { id: req.params.id },
    data: { password: await hashPassword(newPassword) },
  });
  res.json({ ok: true });
});

// Update own profile
router.put("/me/profile", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional().nullable(),
    avatar: z.string().optional().nullable(),
  });
  const body = schema.parse(req.body);
  const updated = await prisma.user.update({
    where: { id: req.user!.sub },
    data: body,
  });
  const { password, ...safe } = updated;
  res.json(safe);
});

export default router;
