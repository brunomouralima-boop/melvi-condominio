import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { config } from "../config";

export async function saveAndCompressImage(buffer: Buffer, subdir = ""): Promise<string> {
  const dir = path.join(config.uploads.dir, subdir);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${uuid()}.jpg`;
  const fullPath = path.join(dir, filename);
  await sharp(buffer)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(fullPath);
  // Relative URL served by /uploads static
  return path.posix.join("/uploads", subdir, filename);
}
