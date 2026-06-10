import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { evaluatePassword } from "@/lib/passwordStrength";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type Phase = "validating" | "invalid" | "form" | "done";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("validating");
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => evaluatePassword(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && !mismatch && !submitting;

  // Valida o token assim que a página carrega.
  useEffect(() => {
    let cancelled = false;
    if (!token || token.length < 10) {
      setPhase("invalid");
      setError("Link inválido ou incompleto.");
      return;
    }
    api
      .post("/auth/reset-password/validate", { token })
      .then((r) => {
        if (cancelled) return;
        if (r.data?.valid) {
          setName(r.data.name ?? null);
          setPhase("form");
        } else {
          setError(r.data?.error || "Token inválido ou expirado.");
          setPhase("invalid");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.error || "Token inválido ou expirado.");
        setPhase("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setPhase("done");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Não foi possível redefinir a senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <BrandLogo variant="color" className="h-16" />
        </div>

        {phase === "validating" && (
          <div className="py-8 text-center text-slate-500">A validar o link…</div>
        )}

        {phase === "invalid" && (
          <div className="space-y-4 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <h1 className="font-display text-xl font-bold text-brand-900">Link inválido ou expirado</h1>
            <p className="text-sm text-slate-500">{error}</p>
            <p className="text-sm text-slate-500">
              Peça ao administrador do seu condomínio para gerar um novo link de recuperação.
            </p>
            <Button className="w-full" onClick={() => navigate("/login")}>Voltar ao início de sessão</Button>
          </div>
        )}

        {phase === "form" && (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-brand-700" />
              <h1 className="mt-2 font-display text-2xl font-bold text-brand-900">Definir nova senha</h1>
              <p className="mt-1 text-sm text-slate-500">
                {name ? <>Olá, <strong>{name}</strong>. </> : null}Escolha uma senha segura para a sua conta.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pw">Nova senha</Label>
              <Input
                id="pw"
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
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
              {mismatch && <p className="text-xs text-coral-600">As senhas não coincidem.</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
              {submitting ? "A guardar…" : "Redefinir senha"}
            </Button>
          </form>
        )}

        {phase === "done" && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="font-display text-xl font-bold text-brand-900">Senha redefinida</h1>
            <p className="text-sm text-slate-500">
              A sua senha foi alterada com sucesso. As sessões anteriores foram terminadas; inicie sessão com a
              nova senha.
            </p>
            <Button className="w-full" onClick={() => navigate("/login")}>Iniciar sessão</Button>
          </div>
        )}
      </div>
    </div>
  );
}
