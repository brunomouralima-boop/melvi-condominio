import { Router } from "express";
import { z } from "zod";
import { Role, AnnouncementType } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, authorize } from "../middleware/auth";
import { resolveCondominium, tenantWhere } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";
import { emitToRole } from "../sockets";

const router = Router();
router.use(authenticate);
router.use(resolveCondominium);

router.get("/", async (req, res) => {
  const items = await prisma.announcement.findMany({
    where: tenantWhere(req),
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });
  res.json(items);
});

const createSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(2),
  type: z.nativeEnum(AnnouncementType).optional(),
  isPinned: z.boolean().optional(),
  attachments: z.array(z.string()).optional(),
});

router.post("/", authorize(Role.ADMIN), validateBody(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>;
  const item = await prisma.announcement.create({
    data: {
      title: body.title,
      content: body.content,
      type: body.type ?? AnnouncementType.INFO,
      isPinned: body.isPinned ?? false,
      attachments: body.attachments ?? [],
      condominiumId: req.condominiumId,
      createdById: req.user!.sub,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  // Push notification aos residentes do condomínio
  const residents = await prisma.user.findMany({
    where: { isActive: true, memberships: { some: { condominiumId: req.condominiumId, role: Role.RESIDENT } } },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: residents.map((r) => ({
      userId: r.id,
      title: "Novo comunicado",
      message: item.title,
      type: "ANNOUNCEMENT" as const,
      relatedId: item.id,
    })),
  });
  emitToRole(Role.RESIDENT, "announcement:new", item);
  res.status(201).json(item);
});

async function assertSameCondo(req: any, res: any): Promise<boolean> {
  const existing = await prisma.announcement.findUnique({ where: { id: req.params.id }, select: { condominiumId: true } });
  if (!existing) { res.status(404).json({ error: "Not found" }); return false; }
  if (existing.condominiumId && existing.condominiumId !== req.condominiumId) { res.status(404).json({ error: "Not found" }); return false; }
  return true;
}

router.put("/:id", authorize(Role.ADMIN), async (req, res) => {
  if (!(await assertSameCondo(req, res))) return;
  const item = await prisma.announcement.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(item);
});

router.delete("/:id", authorize(Role.ADMIN), async (req, res) => {
  if (!(await assertSameCondo(req, res))) return;
  await prisma.announcement.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
