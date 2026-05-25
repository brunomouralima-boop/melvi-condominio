import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function Stub({ title, description }: { title: string; description?: string }) {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-brand-900 mb-1">{title}</h1>
      <p className="text-slate-500 mb-6">{description ?? "Página em construção."}</p>
      <Card>
        <CardContent className="py-16 text-center text-slate-400">
          <Construction className="h-12 w-12 mx-auto mb-3" />
          <div className="font-medium text-slate-600">Funcionalidade planeada</div>
          <p className="text-sm mt-1 max-w-md mx-auto">
            Os endpoints REST já existem no backend. A interface deste módulo será adicionada numa próxima sessão.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
