import { useState } from "react";
import { Siren, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useSocketEvent } from "@/contexts/SocketContext";
import toast from "react-hot-toast";

type AckPayload = { id: string; acknowledgedBy?: { name: string; role: string }; acknowledgedAt?: string };

export function PanicButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"compose" | "confirm" | "waiting" | "acknowledged">("compose");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [ackInfo, setAckInfo] = useState<AckPayload | null>(null);

  useSocketEvent<AckPayload>("panic:acknowledged", (payload) => {
    if (alertId && payload.id === alertId) {
      setAckInfo(payload);
      setStep("acknowledged");
    }
  });

  function reset() {
    setStep("compose");
    setDescription("");
    setAlertId(null);
    setAckInfo(null);
    setSubmitting(false);
  }

  async function send() {
    if (description.trim().length < 10) {
      toast.error("A descrição deve ter pelo menos 10 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/panic-alerts", { description });
      setAlertId(data.id);
      setStep("waiting");
      toast.success("Alerta enviado. A aguardar confirmação.");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Falha ao enviar alerta");
      setStep("compose");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="panic-card group w-full p-6 text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-white/15 p-3 group-hover:bg-white/25">
            <Siren className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="font-display text-xl font-bold">BOTÃO DE PÂNICO</div>
            <div className="text-sm opacity-90">
              Em caso de emergência, prima aqui para alertar o porteiro e a administração.
            </div>
          </div>
        </div>
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <DialogContent className="max-w-md">
          {step === "compose" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-coral-700">
                  <AlertTriangle className="h-5 w-5" />
                  Acionar alerta de pânico
                </DialogTitle>
                <DialogDescription>
                  Descreva brevemente a emergência (mínimo 10 caracteres).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 mt-4">
                <Label htmlFor="panic-desc">Descrição da emergência *</Label>
                <Textarea
                  id="panic-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Pessoa estranha no corredor / Incêndio / Necessito assistência médica…"
                />
                <div className="text-xs text-slate-500">{description.length} / 10 caracteres mínimos</div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={() => setStep("confirm")}
                  disabled={description.trim().length < 10}
                >
                  Continuar
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-coral-700">Confirmar envio?</DialogTitle>
                <DialogDescription>
                  Ao confirmar, o porteiro e a administração receberão imediatamente um alerta sonoro e visual.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg bg-coral-50 border border-coral-200 p-4 text-sm text-coral-900 mt-2">
                <div className="font-semibold mb-1">Descrição:</div>
                <div>{description}</div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setStep("compose")}>Voltar</Button>
                <Button variant="destructive" onClick={send} disabled={submitting}>
                  {submitting ? "A enviar…" : "CONFIRMAR E ENVIAR"}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "waiting" && (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-coral-100 grid place-items-center animate-pulse">
                <Siren className="h-8 w-8 text-coral-600" />
              </div>
              <DialogTitle className="text-coral-700">Alerta enviado</DialogTitle>
              <DialogDescription>A aguardar confirmação do porteiro / administração…</DialogDescription>
              <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
            </div>
          )}

          {step === "acknowledged" && (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 grid place-items-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <DialogTitle className="text-emerald-700">Alerta confirmado</DialogTitle>
              <DialogDescription>
                {ackInfo?.acknowledgedBy?.name && (
                  <>
                    {ackInfo.acknowledgedBy.name} ({ackInfo.acknowledgedBy.role}) recebeu o alerta
                    {ackInfo.acknowledgedAt && ` às ${new Date(ackInfo.acknowledgedAt).toLocaleTimeString("pt-PT")}`}.
                  </>
                )}
              </DialogDescription>
              <Button onClick={() => setOpen(false)}>OK</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
