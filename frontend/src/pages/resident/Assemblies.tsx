import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Vote, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AssemblyListItem } from "@/types";
import { ASSEMBLY_TYPE_LABEL, ASSEMBLY_STATUS_LABEL, ASSEMBLY_STATUS_VARIANT } from "@/components/assemblies/labels";

export function ResidentAssemblies() {
  const navigate = useNavigate();
  const { data: assemblies = [], isLoading } = useQuery({
    queryKey: ["assemblies"],
    queryFn: () => api.get<AssemblyListItem[]>("/assemblies").then((r) => r.data),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Assembleias</h1>
        <p className="text-slate-500">Convocatórias, ordem de trabalhos e votação</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Assembleias ({assemblies.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {assemblies.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/resident/assemblies/${a.id}`)}
                className="w-full flex items-center gap-4 rounded-lg border border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
              >
                <Vote className="h-5 w-5 text-brand-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-brand-900 truncate">{a.title}</div>
                  <div className="text-xs text-slate-500">
                    {ASSEMBLY_TYPE_LABEL[a.type]} · {formatDate(a.scheduledAt)} · {a._count?.agendaItems ?? 0} pontos
                  </div>
                </div>
                <Badge variant={ASSEMBLY_STATUS_VARIANT[a.status]}>{ASSEMBLY_STATUS_LABEL[a.status]}</Badge>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
            {!isLoading && assemblies.length === 0 && (
              <div className="py-8 text-center text-slate-400">Ainda não há assembleias convocadas.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
