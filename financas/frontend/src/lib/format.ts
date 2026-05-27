// Formatação monetária. AOA usa "Kz" como sufixo; outras moedas usam o símbolo.
const SYMBOLS: Record<string, string> = { AOA: "Kz", USD: "$", EUR: "€", BRL: "R$" };

export function formatMoney(amount: number, code = "AOA"): string {
  const n = new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  const sym = SYMBOLS[code] ?? code;
  return code === "AOA" ? `${n} ${sym}` : `${sym} ${n}`;
}

// Versão compacta para cartões (1,2 M Kz).
export function formatCompact(amount: number, code = "AOA"): string {
  const sym = SYMBOLS[code] ?? code;
  const abs = Math.abs(amount);
  let v = amount;
  let suffix = "";
  if (abs >= 1_000_000_000) { v = amount / 1_000_000_000; suffix = " B"; }
  else if (abs >= 1_000_000) { v = amount / 1_000_000; suffix = " M"; }
  else if (abs >= 1_000) { v = amount / 1_000; suffix = " mil"; }
  const n = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: suffix ? 1 : 0 }).format(v);
  return code === "AOA" ? `${n}${suffix} ${sym}` : `${sym} ${n}${suffix}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}
