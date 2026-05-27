import { prisma } from "../prisma";

export type RateMap = Record<string, number>;

// Mapa código -> rateToBase (1 unidade da moeda = N unidades de AOA).
export async function getRateMap(): Promise<RateMap> {
  const currencies = await prisma.currency.findMany();
  const map: RateMap = {};
  for (const c of currencies) map[c.code] = c.rateToBase;
  return map;
}

// Converte um valor de `code` para a moeda base (AOA).
export function toBase(amount: number, code: string, rates: RateMap): number {
  const rate = rates[code] ?? 1;
  return amount * rate;
}
