import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Dados inválidos", details: err.flatten() });
  }
  const message = err instanceof Error ? err.message : "Erro interno";
  console.error("[error]", message);
  res.status(500).json({ error: message });
}
