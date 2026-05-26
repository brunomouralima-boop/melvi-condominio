import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, LogOut, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSocketEvent } from "@/contexts/SocketContext";
import type { Visit } from "@/types";
import { elapsedSince } from "./VisitStatusBadge";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

/**
 * Lista em tempo real de visitantes actualmente DENTRO do condomínio.
 * Mostra-se no dashboard do porteiro e (versão read-only) no admin.
 * Recebe socket events para refresh automático.
 */
export function VisitorsInsidePanel({ readOnly = false }: { readOnly?: boolean }) {
  const qc = useQueryClient();
  const [confirmExit, setConfirmExit] = useState<Visit | null>(null);

  const { data: visits = [] } = useQuery({
    queryKey: ["visits", "INSIDE"],
    queryFn: () => api.get<Visit[]>("/visits", { params: { status: "INSIDE" } }).then((r) => r.data),
    // Refetch a cada 30s para refrescar o "tempo decorrido"
    refetchInterval: 30_000,
  });

  // Realtime: refresca quando alguém entra ou sai
  useSocketEvent("visit:entry", () => qc.invalidateQueries({ queryKey: ["visits"] }));
  useSocketEvent("visit:exit", () => qc.invalidateQueries({ queryKey: ["visits"] }));
  useSocketEvent("visit:updated", () => qc.invalidateQueries({ queryKey: ["visits"] }));

  // Tick local a cada 60s só para forçar re-render do "tempo decorrido"
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const registerExit = useMutation({
    mutationFn: (visitId: string) => api.post(`/visits/${visitId}/exit`),
    onSuccess: () => {
      toast.success("Saída registada");
      setConfirmExit(null);
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["access-logs"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao registar saída"),
  });

  return (
    <>
      <Card className={visits.length > 0 ? "border-emerald-200" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-6 w-6 text-emerald-700" />
              Visitantes no Condomínio
            </span>
            <Badge variant={visits.length > 0 ? "success" : "secondary"}>
              {visits.length} {visits.length === 1 ? "pessoa" : "pessoas"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-6">
              <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              Nenhum visitante no condomínio agora.
            </div>
          ) : (
            <div className="space-y-2">
              {visits.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3"
                >
                  <div className="h-10 w-10 rounded-full bg-emerald-100 grid place-items-center shrink-0">
                    <Users className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-brand-900 truncate">{v.guestName}</div>
                    <div className="text-xs text-slate-600 truncate">
                      {v.fraction && (
                        <>
                          {v.fraction.tower?.name} {v.fraction.identifier} ·{" "}
                        </>
                      )}
                      {v.qrCode?.type === "VISITOR" && "Visitante"}
                      {v.qrCode?.type === "SERVICE_PROVIDER" && "Prestador"}
                      {v.qrCode?.type === "EMPLOYEE" && "Funcionário"}
                    </div>
                    <div className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Entrou às {v.entryAt ? new Date(v.entryAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "?"}
                      <span className="text-slate-500">· há {v.entryAt ? elapsedSince(v.entryAt) : "—"}</span>
                    </div>
                  </div>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-coral-300 text-coral-700 hover:bg-coral-50"
                      onClick={() => setConfirmExit(v)}
                    >
                      <LogOut className="h-4 w-4" /> Saída
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmação de saída */}
      <Dialog open={!!confirmExit} onOpenChange={() => setConfirmExit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar saída</DialogTitle>
            <DialogDescription>
              Confirmar saída de <strong className="text-brand-900">{confirmExit?.guestName}</strong>?
            </DialogDescription>
          </DialogHeader>
          {confirmExit && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-0.5">
              <div>
                <strong>Fracção:</strong> {confirmExit.fraction?.tower?.name} {confirmExit.fraction?.identifier}
              </div>
              <div>
                <strong>Entrada:</strong>{" "}
                {confirmExit.entryAt ? formatDate(confirmExit.entryAt) : "—"}
              </div>
              <div>
                <strong>Tempo no condomínio:</strong>{" "}
                {confirmExit.entryAt ? elapsedSince(confirmExit.entryAt) : "—"}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmExit(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmExit && registerExit.mutate(confirmExit.id)}
              disabled={registerExit.isPending}
            >
              <LogOut className="h-4 w-4" />
              {registerExit.isPending ? "A registar…" : "Confirmar saída"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
