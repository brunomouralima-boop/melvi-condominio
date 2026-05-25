import multer from "multer";
import { config } from "../config";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image uploads are allowed"));
  },
});
