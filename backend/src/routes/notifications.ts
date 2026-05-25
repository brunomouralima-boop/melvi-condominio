import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(items);
});

router.put("/:id/read", async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.sub },
    data: { isRead: true },
  });
  res.json({ ok: true });
});

router.put("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, isRead: false },
    data: { isRead: true },
  });
  res.json({ ok: true });
});

export default router;
