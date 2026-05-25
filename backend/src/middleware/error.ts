import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error("[error]", err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Conflict: unique constraint violated", meta: err.meta });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Resource not found" });
    }
  }

  const status = typeof err?.status === "number" ? err.status : 500;
  res.status(status).json({
    error: err?.message || "Internal server error",
  });
}
