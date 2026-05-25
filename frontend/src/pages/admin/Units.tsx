// LEGACY: esta página foi substituída por /admin/fractions.
// Mantida apenas como redirect — App.tsx aponta /admin/units para AdminFractions.
import { useQuery } from "@tanstack/react-query";
import { Building as BuildingIcon, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Fraction } from "@/types";

export function AdminUnits() {
  const { data: fractions = [] } = useQuery({
    queryKey: ["fractions"],
    queryFn: () => api.get<Fraction[]>("/fractions").then((r) => r.data),
  });

  // Group: tower → floor → fractions
  const grouped = fractions.reduce<Record<string, Record<number, Fraction[]>>>((acc, f) => {
    const tname = f.tower?.name ?? "—";
    acc[tname] = acc[tname] ?? {};
    acc[tname][f.floor] = acc[tname][f.floor] ?? [];
    acc[tname][f.floor].push(f);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Fracções (vista por torre)</h1>
        <p className="text-slate-500">Listagem agrupada por torre e andar — {fractions.length} fracções</p>
      </div>

      {Object.entries(grouped).sort().map(([towerName, floors]) => {
        const totalResidents = Object.values(floors).flat().reduce((acc, u) => acc + (u.residents?.length ?? 0), 0);
        const totalFractions = Object.values(floors).flat().length;
        return (
          <Card key={towerName}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BuildingIcon className="h-5 w-5 text-brand-700" />
                {towerName}
                <Badge variant="secondary" className="ml-2">{totalFractions} fracções</Badge>
                <Badge variant="outline">{totalResidents} residentes</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(floors)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([floor, items]) => (
                  <div key={floor}>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Piso {floor}</div>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items
                        .sort((a, b) => a.identifier.localeCompare(b.identifier))
                        .map((f) => (
                          <div key={f.id} className="rounded-lg border border-slate-200 p-3 hover:border-brand-400 transition-colors">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-display font-bold text-brand-900">{f.identifier}</div>
                                <div className="text-xs text-slate-500">{f.type} · {Number(f.areaM2)} m²</div>
                              </div>
                              {(f.residents?.length ?? 0) > 0 ? (
                                <Badge variant="success">
                                  <Users className="h-3 w-3 mr-1" /> {f.residents!.length}
                                </Badge>
                              ) : (
                                <Badge variant="outline">vazia</Badge>
                              )}
                            </div>
                            {f.residents && f.residents.length > 0 && (
                              <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                                {f.residents.map((r) => (
                                  <div key={r.id} className="truncate">• {r.name}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
