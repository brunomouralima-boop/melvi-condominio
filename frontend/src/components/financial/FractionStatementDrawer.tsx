import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
  DrawerCloseButton,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

interface StatementRecord {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  amount: string | number;
  dueDate: string;
  paidDate?: string | null;
  competence?: string | null;
}

interface Props {
  fractionId: string | null;
  fractionLabel?: string;
  open: boolean;
  onClose: () => void;
  /** Permite marcar/reverter pagamento (apenas admin). */
  canManage?: boolean;
}

export function FractionStatementDrawer({ fractionId, fractionLabel, open, onClose, canManage }: Props) {
  const qc = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["fraction-statement", fractionId],
    queryFn: () => api.get<StatementRecord[]>(`/financial/fraction/${fractionId}/statement`).then((r) => r.data),
    enabled: open && !!fractionId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fraction-statement", fractionId] });
    qc.invalidateQueries({ queryKey: ["financial-records"] });
    qc.invalidateQueries({ queryKey: ["financial-summary"] });
    qc.invalidateQueries({ queryKey: ["delinquency"] });
  };

  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/financial/records/${id}/pay`, {}),
    onSuccess: () => { toast.success("Marcado como pago"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });
  const unpay = useMutation({
    mutationFn: (id: string) => api.post(`/financial/records/${id}/unpay`, {}),
    onSuccess: () => { toast.success("Pagamento revertido"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  const owed = records
    .filter((r) => r.type === "INCOME" && !r.paidDate)
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="lg">
        <DrawerHeader>
          <div>
            <DrawerTitle>Extrato — {fractionLabel ?? "Fracção"}</DrawerTitle>
            <DrawerDescription>Lançamentos e estado de pagamento</DrawerDescription>
          </div>
          <DrawerCloseButton />
        </DrawerHeader>
        <DrawerBody>
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Total em dívida</div>
            <div className={`text-2xl font-bold font-display ${owed > 0 ? "text-coral-600" : "text-emerald-600"}`}>
              {formatCurrency(owed)}
            </div>
          </div>

          {isLoading && <div className="text-sm text-slate-400">A carregar…</div>}
          {!isLoading && records.length === 0 && (
            <div className="text-sm text-slate-400">Sem lançamentos para esta fracção.</div>
          )}

          <div className="space-y-2">
            {records.map((r) => {
              const overdue = !r.paidDate && new Date(r.dueDate) < new Date();
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-brand-900 truncate">{r.description}</div>
                    <div className="text-xs text-slate-500">
                      {r.category} · venc. {formatDate(r.dueDate, { hour: undefined, minute: undefined })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">{formatCurrency(r.amount)}</div>
                    {r.paidDate ? (
                      <Badge variant="success">Pago</Badge>
                    ) : overdue ? (
                      <Badge variant="destructive">Atraso</Badge>
                    ) : (
                      <Badge variant="warning">Pendente</Badge>
                    )}
                  </div>
                  {canManage && r.type === "INCOME" && (
                    r.paidDate ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Reverter pagamento"
                        disabled={unpay.isPending}
                        onClick={() => unpay.mutate(r.id)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pay.isPending}
                        onClick={() => pay.mutate(r.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Pagar
                      </Button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
