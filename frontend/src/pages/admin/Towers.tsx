import { useQuery } from "@tanstack/react-query";
import { Layers, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tower } from "@/types";

/**
 * Listagem básica de Torres (Fase 1).
 * Fase 2 adiciona: modal de criação/edição, desactivação, link para fracções.
 */
export function AdminTowers() {
  const { data: towers = [] } = useQuery({
    queryKey: ["towers"],
    queryFn: () => api.get<Tower[]>("/towers").then((r) => r.data),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-brand-700" />
            Torres
          </h1>
          <p className="text-slate-500">{towers.length} torre(s) registada(s)</p>
        </div>
        <Button disabled title="Disponível na Fase 2"><Plus className="h-4 w-4" /> Nova torre</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {towers.map((t) => (
          <Card key={t.id} className={!t.isActive ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{t.name}</CardTitle>
                {t.isActive ? <Badge variant="success">Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
              </div>
              <div className="text-xs text-slate-500">{t.floors} {t.floors === 1 ? "piso" : "pisos"}</div>
            </CardHeader>
            <CardContent className="space-y-2">
              {t.description && <p className="text-sm text-slate-600">{t.description}</p>}
              {t.stats && (
                <div className="flex gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div><strong className="text-brand-900">{t.stats.total}</strong> fracções</div>
                  <div className="text-emerald-700"><strong>{t.stats.occupied}</strong> ocupadas</div>
                  <div className="text-slate-500"><strong>{t.stats.vacant}</strong> vagas</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {towers.length === 0 && (
          <Card className="md:col-span-3"><CardContent className="py-10 text-center text-slate-400">Sem torres registadas.</CardContent></Card>
        )}
      </div>

      <Card>
        <CardContent className="py-4 text-xs text-slate-500 italic">
          Edição completa de torres (criar, editar, desactivar, ver fracções por torre) será adicionada na Fase 2.
        </CardContent>
      </Card>
    </div>
  );
}
