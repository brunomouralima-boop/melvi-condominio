import type { AgendaTally } from "@/types";

/**
 * Barra de resultados de votação ponderada por permilagem.
 * Mostra A Favor / Contra / Abstenção em proporção do total votado,
 * mais a participação relativa ao total de permilagem do condomínio.
 */
export function ResultBar({ tally, totalPermillage }: { tally: AgendaTally; totalPermillage: number }) {
  const total = tally.totalWeight || 0;
  const pct = (w: number) => (total > 0 ? (w / total) * 100 : 0);
  const participation = totalPermillage > 0 ? (total / totalPermillage) * 100 : 0;
  const approved = tally.forWeight > tally.againstWeight;

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="bg-emerald-500" style={{ width: `${pct(tally.forWeight)}%` }} />
        <div className="bg-coral-500" style={{ width: `${pct(tally.againstWeight)}%` }} />
        <div className="bg-slate-400" style={{ width: `${pct(tally.abstainWeight)}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Legend color="bg-emerald-500" label="A Favor" weight={tally.forWeight} count={tally.forCount} />
        <Legend color="bg-coral-500" label="Contra" weight={tally.againstWeight} count={tally.againstCount} />
        <Legend color="bg-slate-400" label="Abstenção" weight={tally.abstainWeight} count={tally.abstainCount} />
        <span className="ml-auto text-slate-400">
          Participação: {participation.toFixed(1)}‰ votado
        </span>
      </div>
      {total > 0 && (
        <div className={`text-xs font-semibold ${approved ? "text-emerald-700" : "text-coral-700"}`}>
          {approved ? "Maioria a favor" : "Maioria contra / empate"} ({tally.forWeight.toFixed(2)}‰ vs {tally.againstWeight.toFixed(2)}‰)
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, weight, count }: { color: string; label: string; weight: number; count: number }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-600">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}: <span className="font-mono text-slate-900">{weight.toFixed(2)}‰</span>
      <span className="text-slate-400">({count})</span>
    </span>
  );
}
