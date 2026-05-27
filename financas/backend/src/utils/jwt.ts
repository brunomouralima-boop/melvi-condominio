import jwt from "jsonwebtoken";
import { config } from "../config";

export interface TokenPayload {
  userId: string;
  email: string;
}

export const signToken = (payload: TokenPayload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, config.jwt.secret) as TokenPayload;
