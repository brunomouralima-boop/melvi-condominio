import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import toast from "react-hot-toast";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "ADMIN_ORG";
      const redirect =
        (location.state as any)?.from?.pathname ||
        (isAdmin ? "/admin" : user.role === "DOORMAN" ? "/doorman" : "/resident");
      navigate(redirect, { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-12 text-white">
        <BrandLogo variant="white" className="h-32" />
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Gestão completa do seu condomínio numa só plataforma.
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            Acesso por QR Code, ocorrências, comunicados, alertas de pânico em tempo real, financeiro e muito mais.
          </p>
        </div>
        <div className="text-xs text-slate-400">© Melvi Condomínio</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden flex items-center justify-center mb-6">
            <BrandLogo variant="color" className="h-28" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-brand-900">Bem-vindo de volta</h2>
            <p className="mt-1 text-sm text-slate-500">Inicie sessão na sua conta</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="o.seu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "A entrar…" : "Entrar"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowRecovery((v) => !v)}
              className="text-sm font-medium text-brand-700 hover:text-brand-900 hover:underline"
            >
              Esqueci a senha?
            </button>
          </div>

          {showRecovery && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              A recuperação de senha é feita pelo administrador do seu condomínio. Contacte-o para receber um
              link de redefinição. Se já tiver um link, abra-o para escolher uma nova senha.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
