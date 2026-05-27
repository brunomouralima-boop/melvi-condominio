import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { member: true },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }
  const token = signToken({ userId: user.id, email: user.email });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, member: user.member },
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { member: true },
  });
  if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });
  res.json({ id: user.id, name: user.name, email: user.email, member: user.member });
});

export default router;
