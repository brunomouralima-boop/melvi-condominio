import { Router } from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { Role, DocumentCategory } from "@prisma/client";
import { prisma } from "../prisma";
import { config } from "../config";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Upload (ficheiros em bruto: PDF, Office, imagem, texto)
// ---------------------------------------------------------------------------
const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
]);

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo de ficheiro não permitido"));
  },
});

async function saveDocument(file: Express.Multer.File) {
  const dir = path.join(config.uploads.dir, "documents");
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.originalname) || "";
  const filename = `${randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, filename), file.buffer);
  return {
    fileUrl: path.posix.join("/uploads", "documents", filename),
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
  };
}

function isCategory(v: any): v is DocumentCategory {
  return Object.values(DocumentCategory).includes(v);
}

// ---------------------------------------------------------------------------
// Listagem
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  const where: any = {};
  if (req.user!.role === Role.RESIDENT) where.visibleToResidents = true;
  if (req.query.category && isCategory(req.query.category)) where.category = req.query.category;

  const items = await prisma.document.findMany({
    where,
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

// ---------------------------------------------------------------------------
// Upload de documento (admin)
// ---------------------------------------------------------------------------
router.post("/", authorize(Role.ADMIN), docUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Ficheiro em falta" });
    const title = (req.body.title ?? "").toString().trim();
    if (!title) return res.status(400).json({ error: "Título obrigatório" });

    const category: DocumentCategory = isCategory(req.body.category) ? req.body.category : DocumentCategory.OTHER;
    const visibleToResidents = req.body.visibleToResidents !== "false"; // default true
    const description = req.body.description ? String(req.body.description) : null;

    const saved = await saveDocument(req.file);
    const condo = await prisma.condominium.findFirst({ select: { id: true } });

    const doc = await prisma.document.create({
      data: {
        title,
        description,
        category,
        visibleToResidents,
        fileUrl: saved.fileUrl,
        fileName: saved.fileName,
        fileSize: saved.fileSize,
        mimeType: saved.mimeType,
        condominiumId: condo?.id ?? null,
        uploadedById: req.user!.sub,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Atualizar metadados (admin)
// ---------------------------------------------------------------------------
router.put("/:id", authorize(Role.ADMIN), async (req, res) => {
  const existing = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Documento não encontrado" });

  const data: any = {};
  if (req.body.title !== undefined) data.title = String(req.body.title);
  if (req.body.description !== undefined) data.description = req.body.description || null;
  if (req.body.category !== undefined && isCategory(req.body.category)) data.category = req.body.category;
  if (req.body.visibleToResidents !== undefined) data.visibleToResidents = !!req.body.visibleToResidents;

  const doc = await prisma.document.update({
    where: { id: req.params.id },
    data,
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  res.json(doc);
});

// ---------------------------------------------------------------------------
// Apagar (admin) — remove registo e ficheiro
// ---------------------------------------------------------------------------
router.delete("/:id", authorize(Role.ADMIN), async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "Documento não encontrado" });

  await prisma.document.delete({ where: { id: req.params.id } });

  // best-effort: remover ficheiro do disco
  try {
    const rel = doc.fileUrl.replace(/^\/uploads\//, "");
    await fs.unlink(path.join(config.uploads.dir, rel));
  } catch {
    /* ignore */
  }

  res.json({ ok: true });
});

export default router;
