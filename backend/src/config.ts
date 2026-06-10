import dotenv from "dotenv";
import path from "path";

dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  app: {
    // URL pública do frontend (para construir o link de recuperação de senha).
    // Usa APP_PUBLIC_URL se definido; senão, a primeira origem de CORS; senão,
    // o dev server do Vite.
    publicUrl: (
      process.env.APP_PUBLIC_URL ??
      (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",")[0]
    ).trim().replace(/\/+$/, ""),
  },
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev_access_secret"),
    refreshSecret: required("JWT_REFRESH_SECRET", "dev_refresh_secret"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  },
  qr: {
    hmacSecret: required("QR_HMAC_SECRET", "dev_qr_secret"),
  },
  cors: {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim()),
  },
  uploads: {
    dir: path.resolve(process.env.UPLOAD_DIR ?? "./uploads"),
    maxMb: parseInt(process.env.MAX_UPLOAD_MB ?? "8", 10),
  },
  tenancy: {
    // Isolamento estrito por condomínio (esconde linhas com condominiumId null).
    // Só deve ser ligado DEPOIS de correr `db:backfill` em produção — caso
    // contrário esconde dados existentes ainda por etiquetar. Default OFF
    // mantém o comportamento tolerante a nulos da Fase 1.
    strict: process.env.STRICT_TENANCY === "1" || process.env.STRICT_TENANCY === "true",
  },
};
