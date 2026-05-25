import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Megaphone, QrCode, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { PanicButton } from "@/components/PanicButton";
import { formatDate } from "@/lib/utils";
import type { Announcement, Occurrence, QRAccessCode } from "@/types";

export function ResidentDashboard() {
  const { user } = useAuth();
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<Announcement[]>("/announcements").then((r) => r.data),
  });
  const { data: occurrences = [] } = useQuery({
    queryKey: ["my-occurrences"],
    queryFn: () => api.get<Occurrence[]>("/occurrences").then((r) => r.data),
  });
  const { data: qrs = [] } = useQuery({
    queryKey: ["my-qrs"],
    queryFn: () => api.get<QRAccessCode[]>("/qr-codes").then((r) => r.data),
  });

  const activeQrs = qrs.filter((q) => q.isActive && new Date(q.validUntil) > new Date());
  const openOccurrences = occurrences.filter((o) => o.status === "OPEN" || o.status === "IN_PROGRESS");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Olá, {user?.name.split(" ")[0]} 👋</h1>
        <p className="text-slate-500">
          {user?.fraction?.tower?.name} · Fracção {user?.fraction?.identifier}
        </p>
      </div>

      <PanicButton />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Megaphone} label="Comunicados" value={announcements.length} to="/resident/info" />
        <StatCard icon={AlertTriangle} label="Ocorrências abertas" value={openOccurrences.length} to="/resident/occurrences" />
        <StatCard icon={QrCode} label="Acessos QR activos" value={activeQrs.length} to="/resident/access-codes" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-coral-500" />
              Comunicados recentes
            </CardTitle>
            <CardDescription>Avisos da administração</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.slice(0, 4).map((a) => (
              <div key={a.id} className="border-l-2 border-brand-200 pl-3 py-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-brand-900">{a.title}</div>
                  {a.type === "URGENT" && <Badge variant="destructive">Urgente</Badge>}
                  {a.type === "WARNING" && <Badge variant="warning">Aviso</Badge>}
                </div>
                <div className="text-xs text-slate-500">{formatDate(a.createdAt)}</div>
                <div className="text-sm text-slate-700 mt-1 line-clamp-2">{a.content}</div>
              </div>
            ))}
            {announcements.length === 0 && <div className="text-sm text-slate-500">Sem comunicados.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-700" />
              Acessos próximos
            </CardTitle>
            <CardDescription>Visitantes / prestadores autorizados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeQrs.slice(0, 5).map((q) => (
              <div key={q.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                <div>
                  <div className="font-medium text-brand-900">{q.guestName}</div>
                  <div className="text-xs text-slate-500">
                    {q.type === "VISITOR" ? "Visitante" : q.type === "SERVICE_PROVIDER" ? "Prestador" : "Funcionário"}
                    {q.guestCompany ? ` · ${q.guestCompany}` : ""}
                  </div>
                </div>
                <div className="text-xs text-right text-slate-500">
                  Até {formatDate(q.validUntil)}
                </div>
              </div>
            ))}
            {activeQrs.length === 0 && (
              <div className="text-sm text-slate-500">
                Sem acessos activos. <Link to="/resident/access-codes" className="text-brand-700 underline">Criar agora</Link>.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, to }: { icon: any; label: string; value: number; to: string }) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="rounded-lg bg-brand-50 p-3">
            <Icon className="h-6 w-6 text-brand-700" />
          </div>
          <div>
            <div className="text-2xl font-bold font-display text-brand-900">{value}</div>
            <div className="text-sm text-slate-500">{label}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
