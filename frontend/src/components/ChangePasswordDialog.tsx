import { useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { api, tokenStore } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { evaluatePassword } from "@/lib/passwordStrength";
import { cn } from "@/lib/utils";

/**
 * Dialog para o próprio utilizador alterar a sua senha (qualquer perfil).
 * Pede a senha actual + nova; o servidor termina as outras sessões e devolve
 * tokens novos para esta, pelo que o utilizador continua autenticado.
 */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => evaluatePassword(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = current.length > 0 && password.length >= 8 && !mismatch && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/change-password", {
        currentPassword: current,
        newPassword: password,
      });
      // O servidor revoga as sessões antigas e emite tokens novos para esta.
      if (data?.accessToken && data?.refreshToken) {
        tokenStore.setTokens(data.accessToken, data.refreshToken);
      }
      toast.success("Senha alterada com sucesso");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Não foi possível alterar a senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-700" /> Alterar senha
          </DialogTitle>
          <DialogDescription>
            Por segurança, as sessões noutros dispositivos serão terminadas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-pw">Senha actual</Label>
            <Input
              id="current-pw"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-pw">Nova senha</Label>
            <Input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {/* Medidor de robustez */}
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn("h-full transition-all", strength.color)}
                  style={{ width: `${(strength.score / 4) * 100}%` }}
                />
              </div>
              <span className="w-20 text-right text-xs text-slate-500">{strength.label}</span>
            </div>
            <p className="text-xs text-slate-400">Mínimo de 8 caracteres.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirmar nova senha</Label>
            <Input
              id="confirm-pw"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
            {mismatch && <p className="text-xs text-coral-600">As senhas não coincidem.</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "A guardar…" : "Alterar senha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
