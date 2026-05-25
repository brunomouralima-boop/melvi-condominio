import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { saveAndCompressImage } from "../utils/image";

const router = Router();
router.use(authenticate);

// Single image upload (returns URL)
router.post("/image", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Missing file" });
    const url = await saveAndCompressImage(req.file.buffer, req.body?.subdir || "");
    res.status(201).json({ url });
  } catch (e) {
    next(e);
  }
});

// Multiple images (returns URLs[])
router.post("/images", upload.array("files", 5), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) return res.status(400).json({ error: "Missing files" });
    const urls = await Promise.all(files.map((f) => saveAndCompressImage(f.buffer)));
    res.status(201).json({ urls });
  } catch (e) {
    next(e);
  }
});

export default router;
