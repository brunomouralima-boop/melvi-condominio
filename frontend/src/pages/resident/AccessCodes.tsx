import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, QrCode, Eye, Power, Copy, Check, KeyRound } from "lucide-react";
import { api, tokenStore } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { QRAccessCode } from "@/types";
import { AccessShare } from "@/components/AccessShare";
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
          <p className="text-slate-500">Crie acessos temporários por QR Code ou código curto</p>
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
                {q.shortCode && (
                  <div className="rounded-lg bg-brand-50 border border-brand-200 p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">Código</div>
                    <div className="font-mono text-2xl font-bold text-brand-900 tracking-[0.3em] pl-[0.3em]">{q.shortCode}</div>
                  </div>
                )}
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

      <QRViewerDialog viewing={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

/**
 * Dialog que mostra QR + shortCode em destaque.
 * Faz fetch da imagem PNG do backend com auth (token via query string).
 */
function QRViewerDialog({ viewing, onClose }: { viewing: QRAccessCode | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Fetch QR image as blob (the <img> tag can't send Authorization header,
  // so we authenticate via ?token=... in the URL)
  useEffect(() => {
    if (!viewing) {
      setImageUrl(null);
      setImageError(null);
      return;
    }
    const token = tokenStore.getAccess();
    if (!token) {
      setImageError("Sem sessão activa");
      return;
    }
    const url = `/api/qr-codes/${viewing.id}/image?token=${encodeURIComponent(token)}`;
    setImageUrl(url);
    setImageError(null);
  }, [viewing]);

  function copyCode() {
    if (!viewing?.shortCode) return;
    navigator.clipboard
      .writeText(viewing.shortCode)
      .then(() => {
        setCopied(true);
        toast.success("Código copiado");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Falha ao copiar"));
  }

  return (
    <Dialog open={!!viewing} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acesso para {viewing?.guestName}</DialogTitle>
        </DialogHeader>
        {viewing && (
          <div className="space-y-4">
            {/* QR Code */}
            <div className="text-center">
              {imageUrl && !imageError ? (
                <img
                  src={imageUrl}
                  alt="QR Code"
                  className="mx-auto w-64 h-64 border border-slate-200 rounded-lg bg-white"
                  onError={() => setImageError("Falha ao carregar QR Code")}
                />
              ) : (
                <div className="mx-auto w-64 h-64 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center text-xs text-slate-500 text-center p-4">
                  {imageError ?? "A carregar QR Code…"}
                </div>
              )}
            </div>

            {/* Short code — destaque grande (4 dígitos) */}
            {viewing.shortCode && (
              <div className="rounded-xl bg-gradient-to-br from-brand-900 to-brand-800 text-white p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-coral-300 font-semibold mb-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  Código de 4 dígitos
                </div>
                <div className="font-mono text-5xl font-bold tracking-[0.5em] pl-[0.5em] py-2">{viewing.shortCode}</div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 text-coral-300 hover:bg-white/10 hover:text-white"
                  onClick={copyCode}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar código"}
                </Button>
              </div>
            )}

            {/* Detalhes */}
            <div className="text-sm space-y-0.5 text-center text-slate-600">
              <div>
                <span className="font-semibold text-brand-900">{viewing.guestName}</span>
                {viewing.guestDocument && <span> · {viewing.guestDocument}</span>}
              </div>
              <div>Válido até {formatDate(viewing.validUntil)}</div>
              <div>Usos: {viewing.usedCount} / {viewing.maxUses}</div>
            </div>

            {/* Partilhar via WhatsApp / SMS / nativo */}
            {viewing.shortCode && (
              <div className="border-t border-slate-100 pt-3">
                <AccessShare qr={viewing} />
              </div>
            )}

            <p className="text-xs text-slate-500 text-center">
              Partilhe o QR Code <strong>ou</strong> o código de 4 dígitos com o seu visitante. O porteiro pode validar de qualquer forma.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewAccessDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<"VISITOR" | "SERVICE_PROVIDER" | "EMPLOYEE">("VISITOR");
  const [guestName, setGuestName] = useState("");
  const [guestDocument, setGuestDocument] = useState("");
  const [guestCompany, setGuestCompany] = useState("");
  const [serviceType, setServiceType] = useState("");
  // Data + hora prevista de chegada do visitante (informativa)
  // O acesso fica válido desde a criação até às 00:00 do dia SEGUINTE
  // (i.e. o acesso expira ao virar da meia-noite do dia escolhido).
  const defaultDateTime = (() => {
    const d = new Date();
    // Default: hoje, próxima hora redonda
    d.setHours(d.getHours() + 1, 0, 0, 0);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const time = `${String(d.getHours()).padStart(2, "0")}:00`;
    return { date, time };
  })();
  const [arrivalDate, setArrivalDate] = useState(defaultDateTime.date);
  const [arrivalTime, setArrivalTime] = useState(defaultDateTime.time);
  const [maxUses, setMaxUses] = useState(1);

  // ISO mínimo (hoje) — para input type="date" como atributo `min`
  const todayISO = new Date().toISOString().slice(0, 10);

  // Calcula validUntil = 00:00 do dia SEGUINTE à data escolhida (em hora local)
  const computeValidUntil = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split("-").map(Number);
    // new Date(y, m-1, d+1, 0, 0, 0, 0) → 00:00 do dia seguinte
    return new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  };

  // Formata para mostrar ao residente
  const expiresAt = computeValidUntil(arrivalDate);
  const expiresPreview = `${String(expiresAt.getDate()).padStart(2, "0")}/${String(
    expiresAt.getMonth() + 1
  ).padStart(2, "0")}/${expiresAt.getFullYear()} às 00:00`;

  const create = useMutation({
    mutationFn: () => {
      const until = computeValidUntil(arrivalDate);
      const now = new Date();
      if (isNaN(until.getTime())) {
        throw new Error("Data inválida");
      }
      if (until.getTime() <= now.getTime()) {
        throw new Error("A data escolhida já passou");
      }
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
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.message || "Falha ao criar"),
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
          <div>
            <Label>Chegada prevista do visitante</Label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <Input
                  type="date"
                  value={arrivalDate}
                  min={todayISO}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Data</p>
              </div>
              <div>
                <Input
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Hora</p>
              </div>
            </div>
            <div className="mt-2 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-brand-800 flex items-start gap-2">
              <span className="text-brand-500 mt-0.5">⏰</span>
              <span>
                O acesso será válido a partir de agora e expira automaticamente em{" "}
                <strong>{expiresPreview}</strong> (meia-noite do dia escolhido).
              </span>
            </div>
          </div>
          <div>
            <Label>Usos máximos</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
            />
            <p className="text-xs text-slate-500 mt-1">
              Quantas vezes o código pode ser usado pelo porteiro (tipicamente 1).
            </p>
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
