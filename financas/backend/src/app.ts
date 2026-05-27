import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler } from "./middleware/error";
import routes from "./routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.cors.origin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "financas-familia-api", time: new Date().toISOString() });
  });

  app.use("/api", routes);

  app.use((_req: Request, res: Response) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  return app;
}
