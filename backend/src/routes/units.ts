// LEGACY: este ficheiro existia para gerir o antigo modelo "Unit".
// O modelo foi renomeado para "Fraction" e este endpoint mantém-se apenas
// como alias durante a transição. Reencaminha para o controller actualizado.
// Endpoints modernos: /api/fractions e /api/towers
import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

/**
 * @deprecated Use /api/fractions
 */
router.get("/", async (_req, res) => {
  const fractions = await prisma.fraction.findMany({
    include: {
      tower: true,
      residents: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: [{ towerId: "asc" }, { floor: "asc" }, { identifier: "asc" }],
  });

  // Map back to legacy shape (number/building) for old clients still using /api/units
  const legacy = fractions.map((f) => ({
    id: f.id,
    number: f.identifier,
    floor: f.floor,
    type: f.type,
    buildingId: f.towerId,
    building: f.tower
      ? { id: f.tower.id, name: f.tower.name, floors: f.tower.floors, condominiumId: f.tower.condominiumId }
      : null,
    residents: f.residents,
    createdAt: f.createdAt,
  }));
  res.json(legacy);
});

/**
 * @deprecated Use /api/fractions/:id
 */
router.get("/:id/residents", async (req, res) => {
  const residents = await prisma.user.findMany({
    where: { fractionId: req.params.id, role: Role.RESIDENT, isActive: true, deletedAt: null },
    select: { id: true, name: true, email: true, phone: true, avatar: true, isActive: true },
  });
  res.json(residents);
});

export default router;
