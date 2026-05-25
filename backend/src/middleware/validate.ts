import { NextFunction, Request, Response } from "express";
import { ZodSchema, ZodError } from "zod";

export const validateBody = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (e) {
    if (e instanceof ZodError) {
      return res.status(400).json({ error: "Validation failed", issues: e.errors });
    }
    next(e);
  }
};

export const validateQuery = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = schema.parse(req.query);
    // overwrite while keeping express type
    (req as any).query = parsed;
    next();
  } catch (e) {
    if (e instanceof ZodError) {
      return res.status(400).json({ error: "Validation failed", issues: e.errors });
    }
    next(e);
  }
};
