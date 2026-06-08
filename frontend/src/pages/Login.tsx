import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      const isAdmin = user.role === "ADMIN" || user.role === "ADMIN_ORG";
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
        <div className="flex items-center gap-3">
          <Building2 className="h-9 w-9 text-coral-400" />
          <div className="font-display text-2xl font-bold leading-none">
            Melvi <span className="text-coral-300 text-xs font-semibold uppercase tracking-wider ml-1 align-middle">Condomínio</span>
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Gestão completa do seu condomínio numa só plataforma.
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            Acesso por QR Code, ocorrências, comunicados, alertas de pânico em tempo real, financeiro e muito mais.
          </p>
        </div>
        <div className="text-xs text-slate-400">© Melvi Condomínio · Demonstração</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <Building2 className="h-7 w-7 text-coral-500" />
            <span className="font-display text-xl font-bold">
              Melvi <span className="text-coral-500 text-[10px] font-semibold uppercase tracking-wider ml-0.5">Condomínio</span>
            </span>
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

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <div className="font-semibold mb-1 text-slate-700">Credenciais de demonstração:</div>
            <div>👤 admin@morabeza.ao / Admin@123</div>
            <div>🏠 residente1@morabeza.ao / Residente@123</div>
            <div>🛡️ porteiro@morabeza.ao / Porteiro@123</div>
          </div>
        </form>
      </div>
    </div>
  );
}
