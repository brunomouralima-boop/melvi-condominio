import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { config } from "./config";
import { errorHandler } from "./middleware/error";
import routes from "./routes";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Documentos são sensíveis: NÃO servir directamente o subdir.
  // Acesso apenas via GET /api/documents/:id/download (autenticado + scoped).
  app.use("/uploads/documents", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Static uploads (imagens públicas: avatares, fotos de pets/veículos/ocorrências, etc.)
  app.use("/uploads", express.static(config.uploads.dir));

  // Healthcheck — exposto em ambas as rotas para compatibilidade
  //   /health     — usado pelo HEALTHCHECK do Docker (interno)
  //   /api/health — usado por uptime monitors públicos (passa pelo reverse proxy)
  const healthHandler = (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "melvi-condominio-api",
      version: process.env.npm_package_version ?? "1.0.0",
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  };
  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  // API routes
  app.use("/api", routes);

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}
