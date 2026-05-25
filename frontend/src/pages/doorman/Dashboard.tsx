import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, UserPlus, CheckCircle2, XCircle, ScanLine } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { QRScanner } from "@/components/QRScanner";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useSocketEvent } from "@/contexts/SocketContext";
import type { AccessLog, QRAccessCode, Fraction } from "@/types";
import toast from "react-hot-toast";

interface ValidateResult {
  valid: boolean;
  reason?: string;
  qr?: QRAccessCode;
  log?: AccessLog;
}

export function DoormanDashboard() {
  const qc = useQueryClient();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);

  const { data: logs = [] } = useQuery({
    queryKey: ["access-logs", "today"],
    queryFn: () =>
      api
        .get<AccessLog[]>("/access-logs", { params: { date: new Date().toISOString().slice(0, 10) } })
        .then((r) => r.data),
  });

  const { data: fractions = [] } = useQuery({
    queryKey: ["fractions"],
    queryFn: () => api.get<Fraction[]>("/fractions").then((r) => r.data),
  });

  useSocketEvent<AccessLog>("access:new", () => {
    qc.invalidateQueries({ queryKey: ["access-logs", "today"] });
  });

  async function handleScan(qrCodeData: string) {
    setScannerOpen(false);
    setValidating(true);
    try {
      const { data } = await api.post<ValidateResult>("/qr-codes/validate", { qrCodeData });
      setResult(data);
      if (data.valid) {
        qc.invalidateQueries({ queryKey: ["access-logs", "today"] });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Falha ao validar QR");
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Controlo de Acesso</h1>
          <p className="text-slate-600">Escaneie o QR Code do visitante ou registe manualmente</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-coral-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-coral-700">
              <ScanLine className="h-6 w-6" />
              Escanear QR Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              size="xl"
              variant="destructive"
              className="w-full text-xl font-bold py-8"
              onClick={() => {
                setResult(null);
                setScannerOpen(true);
              }}
            >
              <Camera className="h-7 w-7" /> ESCANEAR QR CODE
            </Button>
            <p className="mt-2 text-xs text-slate-500 text-center">
              Vai abrir a câmara — autorize quando solicitado pelo browser.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-brand-700" />
              Registo manual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ManualEntryForm fractions={fractions} onCreated={() => qc.invalidateQueries({ queryKey: ["access-logs", "today"] })} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acessos de hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 px-2">Hora</th>
                  <th className="py-2 px-2">Tipo</th>
                  <th className="py-2 px-2">Pessoa</th>
                  <th className="py-2 px-2">Fracção</th>
                  <th className="py-2 px-2">Método</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">Sem registos hoje.</td></tr>
                )}
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-2 px-2 font-mono text-slate-700">{new Date(l.timestamp).toLocaleTimeString("pt-PT")}</td>
                    <td className="py-2 px-2">
                      <Badge variant={l.type === "ENTRY" ? "success" : "secondary"}>
                        {l.type === "ENTRY" ? "ENTRADA" : "SAÍDA"}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 font-medium text-brand-900">{l.personName}</td>
                    <td className="py-2 px-2 text-slate-700">
                      {l.fraction ? `${l.fraction.tower?.name ?? ""} ${l.fraction.identifier}`.trim() : "—"}
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="outline">{l.method}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear QR Code</DialogTitle>
            <DialogDescription>Aponte para o QR Code do visitante</DialogDescription>
          </DialogHeader>
          <QRScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!result} onOpenChange={() => setResult(null)}>
        <DialogContent>
          {result?.valid ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-emerald-700">
                <CheckCircle2 className="h-10 w-10" />
                <DialogTitle className="text-2xl text-emerald-700">AUTORIZADO</DialogTitle>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-1 text-sm">
                <div><span className="font-semibold">Nome: </span>{result.qr?.guestName}</div>
                {result.qr?.guestDocument && <div><span className="font-semibold">Documento: </span>{result.qr.guestDocument}</div>}
                {result.qr?.guestCompany && <div><span className="font-semibold">Empresa: </span>{result.qr.guestCompany}</div>}
                <div><span className="font-semibold">Tipo: </span>{result.qr?.type}</div>
                <div><span className="font-semibold">Fracção: </span>{result.qr?.fraction?.tower?.name} {result.qr?.fraction?.identifier}</div>
                <div><span className="font-semibold">Válido até: </span>{result.qr && formatDate(result.qr.validUntil)}</div>
              </div>
              <DialogFooter>
                <Button onClick={() => setResult(null)}>Concluído</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-coral-700">
                <XCircle className="h-10 w-10" />
                <DialogTitle className="text-2xl text-coral-700">NEGADO</DialogTitle>
              </div>
              <div className="rounded-lg bg-coral-50 border border-coral-200 p-4 text-sm">
                {result?.reason || "QR Code inválido"}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResult(null)}>OK</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {validating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
          <Card><CardContent className="py-6">A validar…</CardContent></Card>
        </div>
      )}
    </div>
  );
}

function ManualEntryForm({ fractions, onCreated }: { fractions: Fraction[]; onCreated: () => void }) {
  const [personName, setPersonName] = useState("");
  const [personDocument, setPersonDocument] = useState("");
  const [fractionId, setFractionId] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!personName.trim()) return toast.error("Nome obrigatório");
    setLoading(true);
    try {
      await api.post("/access-logs", { personName, personDocument: personDocument || null, fractionId: fractionId || null, notes, type });
      toast.success("Registado");
      setPersonName(""); setPersonDocument(""); setFractionId(""); setNotes("");
      onCreated();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Falha ao registar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Tipo</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="ENTRY">Entrada</option>
          <option value="EXIT">Saída</option>
        </Select>
      </div>
      <div>
        <Label>Nome *</Label>
        <Input value={personName} onChange={(e) => setPersonName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Documento</Label>
          <Input value={personDocument} onChange={(e) => setPersonDocument(e.target.value)} />
        </div>
        <div>
          <Label>Fracção</Label>
          <Select value={fractionId} onChange={(e) => setFractionId(e.target.value)}>
            <option value="">— sem fracção —</option>
            {fractions.map((f) => (
              <option key={f.id} value={f.id}>{f.tower?.name} {f.identifier}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label>Notas</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo da visita…" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "A registar…" : "Registar acesso"}
      </Button>
    </form>
  );
}
