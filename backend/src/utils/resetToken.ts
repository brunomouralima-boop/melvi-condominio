// ────────────────────────────────────────────────────────────────────────────
// Recuperação de palavra-passe — geração e hashing de tokens.
//
// O token em claro é gerado com entropia alta e devolvido UMA vez (ao admin que
// gera o link). Na base de dados guardamos apenas o seu hash SHA-256, pelo que
// um vazamento da BD não permite reconstruir o token.
// ────────────────────────────────────────────────────────────────────────────
import { randomBytes, createHash } from "crypto";

/** Tempo de validade do token (minutos). Curto, por segurança. */
export const RESET_TOKEN_TTL_MINUTES = 60;

/** Hash determinístico (SHA-256, hex) usado para guardar/procurar o token. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Gera um token aleatório (claro) e o respectivo hash para persistir. */
export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url"); // ~43 chars, alta entropia
  return { token, tokenHash: hashResetToken(token) };
}

/** Data de expiração a partir de agora. */
export function resetTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}
