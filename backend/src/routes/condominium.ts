import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// Returns the (first) active condominium with towers
router.get("/", async (_req, res) => {
  const condo = await prisma.condominium.findFirst({
    where: { isActive: true },
    include: { towers: { include: { fractions: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(condo);
});

// Admin dashboard stats
router.get("/stats", authorize(Role.ADMIN), async (_req, res) => {
  const [fractions, residents, openOccurrences, activePanic, todayAccess] = await Promise.all([
    prisma.fraction.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: Role.RESIDENT, isActive: true, deletedAt: null } }),
    prisma.occurrence.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.panicAlert.count({ where: { status: "ACTIVE" } }),
    prisma.accessLog.count({
      where: { timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  const byCategory = await prisma.occurrence.groupBy({
    by: ["category"],
    _count: { _all: true },
  });

  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);
  const recentLogs = await prisma.accessLog.findMany({
    where: { timestamp: { gte: since } },
    select: { timestamp: true },
  });
  const byDay: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    byDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const l of recentLogs) {
    const key = l.timestamp.toISOString().slice(0, 10);
    if (key in byDay) byDay[key] += 1;
  }

  res.json({
    units: fractions, // legacy alias para compatibilidade com frontend antigo
    fractions,
    residents,
    openOccurrences,
    activePanic,
    todayAccess,
    byCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
    accessByDay: Object.entries(byDay).map(([date, count]) => ({ date, count })),
  });
});

export default router;
