import crypto from "crypto";
import QRCode from "qrcode";
import { config } from "../config";

export interface QRPayload {
  id: string;
  type: "VISITOR" | "SERVICE_PROVIDER" | "EMPLOYEE";
  fractionId: string;
  expiresAt: string; // ISO
}

export interface SignedQRPayload extends QRPayload {
  sig: string;
}

export function signQR(payload: QRPayload): string {
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", config.qr.hmacSecret).update(json).digest("hex");
  const signed: SignedQRPayload = { ...payload, sig };
  return Buffer.from(JSON.stringify(signed)).toString("base64url");
}

export function verifyQR(encoded: string): SignedQRPayload | null {
  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as SignedQRPayload;
    const { sig, ...payload } = decoded;
    const expected = crypto.createHmac("sha256", config.qr.hmacSecret).update(JSON.stringify(payload)).digest("hex");
    if (sig !== expected) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function generateQRImage(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { type: "png", width: 512, margin: 2, errorCorrectionLevel: "M" });
}

/**
 * Gera um código curto alfanumérico (6 caracteres) para digitação manual.
 * Exclui caracteres ambíguos (0, 1, O, I, L) para evitar erros de leitura.
 * Resultado tipo: "K3M9X2", "PQ7N4F".
 */
const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 31 chars, sem 0/1/I/L/O
export function generateShortCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SHORT_CODE_ALPHABET[bytes[i] % SHORT_CODE_ALPHABET.length];
  }
  return out;
}
