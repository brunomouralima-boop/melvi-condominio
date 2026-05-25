import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, QrCode, Eye, Power } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { QRAccessCode } from "@/types";
import toast from "react-hot-toast";

const TYPE_LABEL: Record<string, string> = {
  VISITOR: "Visitante",
  SERVICE_PROVIDER: "Prestador",
  EMPLOYEE: "Funcionário",
};

export function ResidentAccessCodes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<QRAccessCode | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["my-qrs"],
    queryFn: () => api.get<QRAccessCode[]>("/qr-codes").then((r) => r.data),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.put(`/qr-codes/${id}/deactivate`),
    onSuccess: () => {
      toast.success("Acesso desativado");
      qc.invalidateQueries({ queryKey: ["my-qrs"] });
    },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Acessos QR</h1>
          <p className="text-slate-500">Crie acessos temporários por QR Code</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo acesso</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((q) => {
          const expired = new Date(q.validUntil) < new Date();
          const used = q.usedCount >= q.maxUses;
          const inactive = !q.isActive || expired || used;
          return (
            <Card key={q.id} className={inactive ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{q.guestName}</CardTitle>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {TYPE_LABEL[q.type]}{q.guestCompany ? ` · ${q.guestCompany}` : ""}
                    </div>
                  </div>
                  {inactive ? (
                    <Badge variant="secondary">{expired ? "Expirado" : used ? "Usado" : "Inativo"}</Badge>
                  ) : (
                    <Badge variant="success">Activo</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                {q.guestDocument && <div>Doc: {q.guestDocument}</div>}
                {q.serviceType && <div>Serviço: {q.serviceType}</div>}
                <div>Válido até: {formatDate(q.validUntil)}</div>
                <div>Usos: {q.usedCount} / {q.maxUses}</div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setViewing(q)}>
                    <Eye className="h-4 w-4" /> Ver QR
                  </Button>
                  {q.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(q.id)}>
                      <Power className="h-4 w-4" /> Desativar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center text-slate-500">
              <QrCode className="h-12 w-12 mx-auto mb-2 text-slate-300" />
              Ainda não criou nenhum acesso. Clique em "Novo acesso".
            </CardContent>
          </Card>
        )}
      </div>

      <NewAccessDialog open={open} onClose={() => setOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["my-qrs"] })} />

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>QR Code para {viewing?.guestName}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="text-center space-y-3">
              <img
                src={`/api/qr-codes/${viewing.id}/image`}
                alt="QR Code"
                className="mx-auto w-72 h-72 border border-slate-200 rounded-lg"
              />
              <div className="text-sm">
                <div className="font-semibold">{viewing.guestName}</div>
                <div className="text-slate-500">Válido até {formatDate(viewing.validUntil)}</div>
                <div className="text-slate-500">Usos: {viewing.usedCount}/{viewing.maxUses}</div>
              </div>
              <p className="text-xs text-slate-500">Mostre este código ao porteiro à entrada.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewAccessDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<"VISITOR" | "SERVICE_PROVIDER" | "EMPLOYEE">("VISITOR");
  const [guestName, setGuestName] = useState("");
  const [guestDocument, setGuestDocument] = useState("");
  const [guestCompany, setGuestCompany] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [validHours, setValidHours] = useState(24);
  const [maxUses, setMaxUses] = useState(1);

  const create = useMutation({
    mutationFn: () => {
      const now = new Date();
      const until = new Date(now.getTime() + validHours * 3600 * 1000);
      return api.post("/qr-codes", {
        type,
        guestName,
        guestDocument: guestDocument || null,
        guestCompany: type === "SERVICE_PROVIDER" ? guestCompany || null : null,
        serviceType: type === "SERVICE_PROVIDER" ? serviceType || null : null,
        validFrom: now.toISOString(),
        validUntil: until.toISOString(),
        maxUses,
      });
    },
    onSuccess: () => {
      toast.success("Acesso criado");
      setGuestName(""); setGuestDocument(""); setGuestCompany(""); setServiceType("");
      onCreated(); onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao criar"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo acesso QR</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="VISITOR">Visitante</option>
              <option value="SERVICE_PROVIDER">Prestador de serviço</option>
              <option value="EMPLOYEE">Funcionário doméstico</option>
            </Select>
          </div>
          <div>
            <Label>Nome *</Label>
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} required minLength={2} />
          </div>
          <div>
            <Label>Documento</Label>
            <Input value={guestDocument} onChange={(e) => setGuestDocument(e.target.value)} />
          </div>
          {type === "SERVICE_PROVIDER" && (
            <>
              <div>
                <Label>Empresa</Label>
                <Input value={guestCompany} onChange={(e) => setGuestCompany(e.target.value)} />
              </div>
              <div>
                <Label>Serviço</Label>
                <Input value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Validade (horas)</Label>
              <Input type="number" min={1} max={720} value={validHours} onChange={(e) => setValidHours(Number(e.target.value))} />
            </div>
            <div>
              <Label>Usos máximos</Label>
              <Input type="number" min={1} max={20} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "A criar…" : "Criar QR"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
