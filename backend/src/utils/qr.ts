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
 * Gera um código numérico de 4 dígitos (0–9) para digitação manual.
 * Usa crypto.randomBytes para entropia real (não Math.random).
 * Resultado tipo: "3847", "0291", "9100".
 *
 * NOTA DE SEGURANÇA: 4 dígitos = 10 000 combinações apenas.
 * Mitigado por:
 *  - Rate limiting na rota /qr-codes/validate
 *  - Validade temporal curta (validFrom/validUntil)
 *  - maxUses (tipicamente 1 — uma vez usado, fica inválido)
 *  - Cada código está associado a uma fracção específica
 */
export function generateShortCode(length = 4): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String(bytes[i] % 10); // dígito 0–9
  }
  return out;
}
