import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";
import { Role } from "@prisma/client";

export interface JWTPayload {
  sub: string;
  role: Role;
  fractionId?: string | null;
}

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  } as SignOptions);
}

export function signRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as JWTPayload;
}
