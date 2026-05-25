import { useQuery } from "@tanstack/react-query";
import { Megaphone, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Announcement } from "@/types";

export function ResidentInfo() {
  const { data: items = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<Announcement[]>("/announcements").then((r) => r.data),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Informações</h1>
        <p className="text-slate-500">Comunicados, regulamentos e contactos úteis</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-coral-500" /> Contactos de emergência</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Bombeiros</div>
            <a href="tel:115" className="font-display text-2xl font-bold text-coral-600">115</a>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Polícia</div>
            <a href="tel:113" className="font-display text-2xl font-bold text-coral-600">113</a>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Portaria</div>
            <a href="tel:+244900000000" className="font-display text-2xl font-bold text-brand-700">+244 900 000 000</a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Comunicados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="border-l-2 border-brand-200 pl-3 py-1">
              <div className="flex items-center gap-2">
                <div className="font-medium text-brand-900">{a.title}</div>
                {a.type === "URGENT" && <Badge variant="destructive">Urgente</Badge>}
                {a.type === "WARNING" && <Badge variant="warning">Aviso</Badge>}
              </div>
              <div className="text-xs text-slate-500">{formatDate(a.createdAt)}</div>
              <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{a.content}</div>
            </div>
          ))}
          {items.length === 0 && <div className="text-sm text-slate-500">Sem comunicados.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
