// ────────────────────────────────────────────────────────────────────────────
// Medidor simples de robustez de palavra-passe (apenas UX no front-end).
// A validação mínima real (>= 8) é garantida pelo back-end.
// ────────────────────────────────────────────────────────────────────────────
export interface PasswordStrength {
  /** 0–4 (quanto maior, mais forte). */
  score: number;
  label: string;
  /** Classe Tailwind para a barra/cor. */
  color: string;
}

export function evaluatePassword(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "—", color: "bg-slate-200" };

  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  // Normaliza para 0–4.
  score = Math.min(4, score);

  const map: { label: string; color: string }[] = [
    { label: "Muito fraca", color: "bg-coral-500" },
    { label: "Fraca", color: "bg-coral-400" },
    { label: "Razoável", color: "bg-amber-400" },
    { label: "Boa", color: "bg-emerald-400" },
    { label: "Forte", color: "bg-emerald-600" },
  ];
  return { score, ...map[score] };
}
