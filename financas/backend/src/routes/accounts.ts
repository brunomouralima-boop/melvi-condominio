import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { validateBody } from "../middleware/validate";
import { computeBalances } from "../utils/balances";

const router = Router();

const accountSchema = z.object({
  name: z.string().min(1),
  institution: z.string().default(""),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "INVESTMENT", "WALLET"]).default("CHECKING"),
  currencyCode: z.string().min(2),
  memberId: z.string().min(1),
  openingBalance: z.number().default(0),
  archived: z.boolean().default(false),
});

router.get("/", async (_req, res) => {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({
      include: { currency: true, member: true },
      orderBy: { createdAt: "asc" },
    }),
    computeBalances(),
  ]);
  res.json(accounts.map((a) => ({ ...a, balance: balances[a.id] ?? a.openingBalance })));
});

router.post("/", validateBody(accountSchema), async (req, res) => {
  const account = await prisma.account.create({ data: req.body });
  res.status(201).json(account);
});

router.put("/:id", validateBody(accountSchema.partial()), async (req, res) => {
  const account = await prisma.account.update({ where: { id: req.params.id }, data: req.body });
  res.json(account);
});

router.delete("/:id", async (req, res) => {
  const count = await prisma.transaction.count({
    where: { OR: [{ accountId: req.params.id }, { toAccountId: req.params.id }] },
  });
  if (count > 0) {
    return res.status(409).json({
      error: "Conta tem lançamentos associados. Arquive-a em vez de eliminar.",
    });
  }
  await prisma.account.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
