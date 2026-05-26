import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, UserPlus, CheckCircle2, XCircle, ScanLine, KeyRound, ShieldAlert } from "lucide-react";
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

/**
 * Detecta se a câmara funciona neste contexto.
 * getUserMedia exige HTTPS (excepto em localhost).
 * Se estamos em http://IP, a câmara não vai funcionar.
 */
function isCameraSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  // window.isSecureContext é true em HTTPS ou em localhost/127.0.0.1
  return window.isSecureContext === true;
}

export function DoormanDashboard() {
  const qc = useQueryClient();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const cameraAvailable = isCameraSecureContext();

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

  async function validate(payload: { qrCodeData?: string; shortCode?: string }) {
    setValidating(true);
    try {
      const { data } = await api.post<ValidateResult>("/qr-codes/validate", payload);
      setResult(data);
      if (data.valid) {
        qc.invalidateQueries({ queryKey: ["access-logs", "today"] });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Falha ao validar");
    } finally {
      setValidating(false);
    }
  }

  function handleScan(qrCodeData: string) {
    setScannerOpen(false);
    validate({ qrCodeData });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Controlo de Acesso</h1>
        <p className="text-slate-600">Valide acessos por QR Code, código manual ou registo directo</p>
      </div>

      {/* Aviso: câmara só funciona em HTTPS */}
      {!cameraAvailable && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 py-4">
            <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <div className="font-semibold mb-0.5">Câmara não disponível neste contexto</div>
              <div className="text-xs">
                O scanner de QR Code requer HTTPS (cadeado verde). Está a aceder via HTTP simples, por isso o browser bloqueia o acesso à câmara.
                Use a <strong>validação por código</strong> ou peça à administração para configurar HTTPS no servidor.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* CARD 1 — Scanner QR */}
        <Card className={cameraAvailable ? "border-coral-200" : "opacity-60"}>
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
              disabled={!cameraAvailable}
            >
              <Camera className="h-7 w-7" /> ESCANEAR QR CODE
            </Button>
            <p className="mt-2 text-xs text-slate-500 text-center">
              {cameraAvailable
                ? "Vai abrir a câmara — autorize quando solicitado."
                : "Indisponível em HTTP. Use código manual abaixo."}
            </p>
          </CardContent>
        </Card>

        {/* CARD 2 — Validar por código curto */}
        <Card className="border-brand-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-brand-700">
              <KeyRound className="h-6 w-6" />
              Validar por código
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ShortCodeForm onSubmit={(code) => validate({ shortCode: code })} />
          </CardContent>
        </Card>
      </div>

      {/* Registo manual de pessoa (não baseado em QR) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-brand-700" />
            Registo manual de entrada / saída
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ManualEntryForm
            fractions={fractions}
            onCreated={() => qc.invalidateQueries({ queryKey: ["access-logs", "today"] })}
          />
        </CardContent>
      </Card>

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

      {/* Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear QR Code</DialogTitle>
            <DialogDescription>Aponte a câmara para o QR Code do visitante</DialogDescription>
          </DialogHeader>
          <QRScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
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
                {result?.reason || "Acesso inválido"}
              </div>
              {/* Se houver dados do QR (ex: expirado) mostra o que sabemos */}
              {result?.qr && (
                <div className="text-xs text-slate-500 border-t border-slate-200 pt-2">
                  <div>{result.qr.guestName} · {result.qr.type}</div>
                  <div>Válido de {formatDate(result.qr.validFrom)} até {formatDate(result.qr.validUntil)}</div>
                  <div>Usos: {result.qr.usedCount}/{result.qr.maxUses}</div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setResult(null)}>OK</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {validating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
          <Card>
            <CardContent className="py-6">A validar…</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * Input específico para shortCode (4 dígitos numéricos).
 * - Aceita só 0-9
 * - Teclado numérico em telemóveis (inputMode="numeric")
 * - Auto-submete quando atinge 4 dígitos (UX optimizada para porteiro rápido)
 */
function ShortCodeForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");

  function normalize(input: string) {
    return input.replace(/\D/g, "").slice(0, 4);
  }

  function handleChange(input: string) {
    const normalized = normalize(input);
    setCode(normalized);
    // Auto-submit quando atinge 4 dígitos
    if (normalized.length === 4) {
      // Defer um pouco para o utilizador ver o último dígito a aparecer
      setTimeout(() => {
        onSubmit(normalized);
        setCode("");
      }, 150);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 4) {
      toast.error("Código deve ter 4 dígitos");
      return;
    }
    onSubmit(code);
    setCode("");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Código de 4 dígitos fornecido pelo visitante</Label>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="0000"
          className="text-5xl font-mono tracking-[0.5em] pl-[0.5em] text-center font-bold h-20"
          maxLength={4}
        />
        <p className="text-xs text-slate-500 mt-1 text-center">Valida automaticamente ao escrever os 4 dígitos.</p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={code.length !== 4}>
        <KeyRound className="h-5 w-5" /> Validar código
      </Button>
    </form>
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
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Tipo</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="ENTRY">Entrada</option>
            <option value="EXIT">Saída</option>
          </Select>
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
        <Label>Nome *</Label>
        <Input value={personName} onChange={(e) => setPersonName(e.target.value)} required />
      </div>
      <div>
        <Label>Documento</Label>
        <Input value={personDocument} onChange={(e) => setPersonDocument(e.target.value)} />
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
