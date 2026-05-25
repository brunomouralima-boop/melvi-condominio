import { useQuery } from "@tanstack/react-query";
import { Building as BuildingIcon, MapPin, Hash } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

interface Condo {
  id: string;
  name: string;
  address: string;
  taxId?: string | null;
  logo?: string | null;
  settings?: any;
  towers: { id: string; name: string; floors: number; fractions: any[] }[];
}

export function AdminSettings() {
  const { user } = useAuth();
  const { data: condo } = useQuery({
    queryKey: ["condominium"],
    queryFn: () => api.get<Condo>("/condominium").then((r) => r.data),
  });

  if (!condo) {
    return <div className="p-6 text-slate-500">A carregar…</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Configurações</h1>
        <p className="text-slate-500">Dados do condomínio e estrutura</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Condomínio</CardTitle>
          <CardDescription>Informação geral</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nome</div>
              <div className="flex items-center gap-2 text-brand-900">
                <BuildingIcon className="h-4 w-4 text-brand-500" />
                <span className="font-display text-xl font-bold">{condo.name}</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Morada</div>
              <div className="flex items-center gap-2 text-slate-700">
                <MapPin className="h-4 w-4 text-brand-500" />
                {condo.address}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">NIF / Contribuinte</div>
              <div className="flex items-center gap-2 text-slate-700 font-mono">
                <Hash className="h-4 w-4 text-brand-500" />
                {condo.taxId ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Moeda</div>
              <div className="text-slate-700">{condo.settings?.currency ?? "AOA"}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400 italic pt-2 border-t border-slate-100">
            Edição completa de dados, logo e contactos disponível em <strong>/admin/condominium</strong>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Torres e estrutura</CardTitle>
          <CardDescription>{condo.towers.length} torre(s) · {condo.towers.reduce((acc, t) => acc + t.fractions.length, 0)} fracção(ões)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {condo.towers.map((t) => (
              <div key={t.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display font-semibold text-brand-900 flex items-center gap-2">
                    <BuildingIcon className="h-4 w-4" />
                    {t.name}
                  </div>
                  <Badge variant="secondary">{t.fractions.length} fracções</Badge>
                </div>
                <div className="text-sm text-slate-600">
                  {t.floors} {t.floors === 1 ? "andar" : "andares"}
                  {t.fractions.length > 0 && ` · média ${Math.round(t.fractions.length / t.floors)} por andar`}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessão actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><strong>Utilizador:</strong> {user?.name}</div>
          <div><strong>Email:</strong> {user?.email}</div>
          <div><strong>Perfil:</strong> {user?.role}</div>
        </CardContent>
      </Card>
    </div>
  );
}
