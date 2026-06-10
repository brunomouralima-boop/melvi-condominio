import { Router } from "express";
import { z } from "zod";
import {
  Role,
  AssemblyType,
  AssemblyStatus,
  AgendaItemStatus,
  VoteChoice,
} from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize, isAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { resolveCondominium, tenantWhere } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";

const router = Router();
router.use(authenticate);
router.use(resolveCondominium);

function round4(n: number) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

interface Tally {
  forWeight: number; againstWeight: number; abstainWeight: number;
  forCount: number; againstCount: number; abstainCount: number;
  totalWeight: number; totalCount: number;
}
function tallyOf(votes: { choice: VoteChoice; weight: any }[]): Tally {
  const t: Tally = { forWeight: 0, againstWeight: 0, abstainWeight: 0, forCount: 0, againstCount: 0, abstainCount: 0, totalWeight: 0, totalCount: 0 };
  for (const v of votes) {
    const w = Number(v.weight);
    if (v.choice === VoteChoice.FOR) { t.forWeight += w; t.forCount++; }
    else if (v.choice === VoteChoice.AGAINST) { t.againstWeight += w; t.againstCount++; }
    else { t.abstainWeight += w; t.abstainCount++; }
  }
  t.forWeight = round4(t.forWeight);
  t.againstWeight = round4(t.againstWeight);
  t.abstainWeight = round4(t.abstainWeight);
  t.totalWeight = round4(t.forWeight + t.againstWeight + t.abstainWeight);
  t.totalCount = t.forCount + t.againstCount + t.abstainCount;
  return t;
}

// ===========================================================================
// Listagem
// ===========================================================================
router.get("/", async (req, res) => {
  const where: any = { ...tenantWhere(req) };
  if (!isAdmin(req.user!.role)) where.status = { not: AssemblyStatus.DRAFT };

  const items = await prisma.assembly.findMany({
    where,
    include: { _count: { select: { agendaItems: true } } },
    orderBy: { scheduledAt: "desc" },
  });
  res.json(items);
});

// ===========================================================================
// Detalhe (com apuramento + votos do utilizador + frações próprias)
// ===========================================================================
router.get("/:id", async (req, res) => {
  const assembly = await prisma.assembly.findUnique({
    where: { id: req.params.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      agendaItems: { orderBy: { order: "asc" }, include: { votes: true } },
    },
  });
  if (!assembly) return res.status(404).json({ error: "Assembleia não encontrada" });
  if (assembly.condominiumId && assembly.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Assembleia não encontrada" });
  }
  if (!isAdmin(req.user!.role) && assembly.status === AssemblyStatus.DRAFT) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const [myFractions, allFr] = await Promise.all([
    prisma.fraction.findMany({
      where: { ...tenantWhere(req), ownerId: req.user!.sub, isActive: true },
      select: { id: true, identifier: true, permillage: true, tower: { select: { name: true } } },
      orderBy: { identifier: "asc" },
    }),
    prisma.fraction.aggregate({ _sum: { permillage: true }, where: { ...tenantWhere(req), isActive: true } }),
  ]);
  const myFractionIds = new Set(myFractions.map((f) => f.id));

  const agendaItems = assembly.agendaItems.map((item) => {
    const tally = tallyOf(item.votes);
    const myVotes = item.votes
      .filter((v) => myFractionIds.has(v.fractionId))
      .map((v) => ({ fractionId: v.fractionId, choice: v.choice }));
    return {
      id: item.id,
      order: item.order,
      title: item.title,
      description: item.description,
      status: item.status,
      requiresVote: item.requiresVote,
      tally,
      myVotes,
    };
  });

  res.json({
    id: assembly.id,
    title: assembly.title,
    type: assembly.type,
    status: assembly.status,
    scheduledAt: assembly.scheduledAt,
    location: assembly.location,
    description: assembly.description,
    quorumPermillage: assembly.quorumPermillage != null ? Number(assembly.quorumPermillage) : null,
    createdBy: assembly.createdBy,
    agendaItems,
    myFractions: myFractions.map((f) => ({
      id: f.id,
      identifier: f.identifier,
      tower: f.tower?.name ?? null,
      permillage: Number(f.permillage),
    })),
    totalPermillage: round4(Number(allFr._sum.permillage ?? 0)),
  });
});

// ===========================================================================
// CRUD assembleia (admin)
// ===========================================================================
const assemblySchema = z.object({
  title: z.string().min(1),
  type: z.nativeEnum(AssemblyType).optional(),
  status: z.nativeEnum(AssemblyStatus).optional(),
  scheduledAt: z.string().datetime(),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  quorumPermillage: z.number().nonnegative().optional().nullable(),
});

router.post("/", authorize(Role.ADMIN), requirePermission("assemblies:write"), validateBody(assemblySchema), async (req, res) => {
  const b = req.body as z.infer<typeof assemblySchema>;
  const a = await prisma.assembly.create({
    data: {
      title: b.title,
      type: b.type ?? AssemblyType.ORDINARY,
      status: b.status ?? AssemblyStatus.DRAFT,
      scheduledAt: new Date(b.scheduledAt),
      location: b.location ?? null,
      description: b.description ?? null,
      quorumPermillage: b.quorumPermillage ?? null,
      condominiumId: req.condominiumId ?? null,
      createdById: req.user!.sub,
    },
  });
  res.status(201).json(a);
});

router.put("/:id", authorize(Role.ADMIN), requirePermission("assemblies:write"), validateBody(assemblySchema.partial()), async (req, res) => {
  const existing = await prisma.assembly.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Assembleia não encontrada" });
  if (existing.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Assembleia não encontrada" });
  }
  const b = req.body as Partial<z.infer<typeof assemblySchema>>;
  const data: any = {};
  if (b.title !== undefined) data.title = b.title;
  if (b.type !== undefined) data.type = b.type;
  if (b.status !== undefined) data.status = b.status;
  if (b.scheduledAt !== undefined) data.scheduledAt = new Date(b.scheduledAt);
  if (b.location !== undefined) data.location = b.location || null;
  if (b.description !== undefined) data.description = b.description || null;
  if (b.quorumPermillage !== undefined) data.quorumPermillage = b.quorumPermillage ?? null;
  const a = await prisma.assembly.update({ where: { id: req.params.id }, data });
  res.json(a);
});

router.delete("/:id", authorize(Role.ADMIN), requirePermission("assemblies:write"), async (req, res) => {
  const existing = await prisma.assembly.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Assembleia não encontrada" });
  if (existing.condominiumId && existing.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Assembleia não encontrada" });
  }
  await prisma.assembly.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ===========================================================================
// Pontos da ordem de trabalhos (admin)
// ===========================================================================
const agendaSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  order: z.number().int().optional(),
  requiresVote: z.boolean().optional(),
});

router.post("/:id/agenda", authorize(Role.ADMIN), requirePermission("assemblies:write"), validateBody(agendaSchema), async (req, res) => {
  const assembly = await prisma.assembly.findUnique({ where: { id: req.params.id } });
  if (!assembly) return res.status(404).json({ error: "Assembleia não encontrada" });
  if (assembly.condominiumId && assembly.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Assembleia não encontrada" });
  }
  const b = req.body as z.infer<typeof agendaSchema>;
  const count = await prisma.agendaItem.count({ where: { assemblyId: req.params.id } });
  const item = await prisma.agendaItem.create({
    data: {
      assemblyId: req.params.id,
      title: b.title,
      description: b.description ?? null,
      order: b.order ?? count,
      requiresVote: b.requiresVote ?? true,
    },
  });
  res.status(201).json(item);
});

router.put("/:id/agenda/:itemId", authorize(Role.ADMIN), requirePermission("assemblies:write"), validateBody(agendaSchema.partial()), async (req, res) => {
  const item = await prisma.agendaItem.findUnique({
    where: { id: req.params.itemId },
    include: { assembly: { select: { condominiumId: true } } },
  });
  if (!item || item.assemblyId !== req.params.id) return res.status(404).json({ error: "Ponto não encontrado" });
  if (item.assembly.condominiumId && item.assembly.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Ponto não encontrado" });
  }
  const b = req.body as Partial<z.infer<typeof agendaSchema>>;
  const data: any = {};
  if (b.title !== undefined) data.title = b.title;
  if (b.description !== undefined) data.description = b.description || null;
  if (b.order !== undefined) data.order = b.order;
  if (b.requiresVote !== undefined) data.requiresVote = b.requiresVote;
  const updated = await prisma.agendaItem.update({ where: { id: req.params.itemId }, data });
  res.json(updated);
});

router.delete("/:id/agenda/:itemId", authorize(Role.ADMIN), requirePermission("assemblies:write"), async (req, res) => {
  const item = await prisma.agendaItem.findUnique({
    where: { id: req.params.itemId },
    include: { assembly: { select: { condominiumId: true } } },
  });
  if (!item || item.assemblyId !== req.params.id) return res.status(404).json({ error: "Ponto não encontrado" });
  if (item.assembly.condominiumId && item.assembly.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Ponto não encontrado" });
  }
  await prisma.agendaItem.delete({ where: { id: req.params.itemId } });
  res.json({ ok: true });
});

// Abrir votação (admin)
router.post("/:id/agenda/:itemId/open", authorize(Role.ADMIN), requirePermission("assemblies:write"), async (req, res) => {
  const item = await prisma.agendaItem.findUnique({
    where: { id: req.params.itemId },
    include: { assembly: { select: { condominiumId: true } } },
  });
  if (!item || item.assemblyId !== req.params.id) return res.status(404).json({ error: "Ponto não encontrado" });
  if (item.assembly.condominiumId && item.assembly.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Ponto não encontrado" });
  }
  const updated = await prisma.agendaItem.update({
    where: { id: req.params.itemId },
    data: { status: AgendaItemStatus.VOTING_OPEN },
  });
  res.json(updated);
});

// Fechar votação + apurar (admin)
router.post("/:id/agenda/:itemId/close", authorize(Role.ADMIN), requirePermission("assemblies:write"), async (req, res) => {
  const item = await prisma.agendaItem.findUnique({
    where: { id: req.params.itemId },
    include: { votes: true, assembly: { select: { condominiumId: true } } },
  });
  if (!item || item.assemblyId !== req.params.id) return res.status(404).json({ error: "Ponto não encontrado" });
  if (item.assembly.condominiumId && item.assembly.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Ponto não encontrado" });
  }

  const t = tallyOf(item.votes);
  const approved = t.forWeight > t.againstWeight;
  const updated = await prisma.agendaItem.update({
    where: { id: req.params.itemId },
    data: { status: approved ? AgendaItemStatus.APPROVED : AgendaItemStatus.REJECTED },
  });
  res.json({ ...updated, tally: t, approved });
});

// ===========================================================================
// Votar (proprietário da fração)
// ===========================================================================
const voteSchema = z.object({
  fractionId: z.string().uuid(),
  choice: z.nativeEnum(VoteChoice),
});

router.post("/:id/agenda/:itemId/vote", validateBody(voteSchema), async (req, res) => {
  const b = req.body as z.infer<typeof voteSchema>;
  const item = await prisma.agendaItem.findUnique({
    where: { id: req.params.itemId },
    include: { assembly: { select: { condominiumId: true } } },
  });
  if (!item || item.assemblyId !== req.params.id) return res.status(404).json({ error: "Ponto não encontrado" });
  if (item.assembly.condominiumId && item.assembly.condominiumId !== req.condominiumId) {
    return res.status(404).json({ error: "Ponto não encontrado" });
  }
  if (item.status !== AgendaItemStatus.VOTING_OPEN) {
    return res.status(400).json({ error: "A votação deste ponto não está aberta." });
  }

  // A fração tem de pertencer ao utilizador (proprietário) e ao condomínio activo
  const fraction = await prisma.fraction.findUnique({ where: { id: b.fractionId } });
  if (!fraction || fraction.ownerId !== req.user!.sub) {
    return res.status(403).json({ error: "Só o proprietário da fração pode votar por ela." });
  }
  if (fraction.condominiumId && fraction.condominiumId !== req.condominiumId) {
    return res.status(403).json({ error: "Fração não pertence a este condomínio." });
  }

  const vote = await prisma.vote.upsert({
    where: { agendaItemId_fractionId: { agendaItemId: req.params.itemId, fractionId: b.fractionId } },
    create: {
      agendaItemId: req.params.itemId,
      fractionId: b.fractionId,
      userId: req.user!.sub,
      choice: b.choice,
      weight: fraction.permillage,
    },
    update: { choice: b.choice, userId: req.user!.sub, weight: fraction.permillage },
  });
  res.status(201).json(vote);
});

export default router;
