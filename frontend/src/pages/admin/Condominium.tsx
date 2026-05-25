import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { Condominium } from "@/types";
import toast from "react-hot-toast";

export function AdminCondominium() {
  const qc = useQueryClient();
  const { data: condo } = useQuery({
    queryKey: ["condominium"],
    queryFn: () => api.get<Condominium>("/condominium").then((r) => r.data),
  });

  const [form, setForm] = useState<Partial<Condominium>>({});
  const current = { ...(condo ?? {}), ...form };

  const update = useMutation({
    mutationFn: () => api.put(`/condominiums/${condo!.id}`, form),
    onSuccess: () => {
      toast.success("Dados actualizados");
      qc.invalidateQueries({ queryKey: ["condominium"] });
      setForm({});
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  if (!condo) return <div className="p-6 text-slate-500">A carregar…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900 flex items-center gap-2">
          <Building2 className="h-7 w-7 text-brand-700" />
          Configuração do Condomínio
        </h1>
        <p className="text-slate-500">Dados gerais — actualize e guarde alterações</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
          <CardDescription>Nome, morada e dados fiscais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={(current.name as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>NIF / Contribuinte</Label>
              <Input
                value={(current.taxId as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Morada</Label>
            <Textarea
              rows={2}
              value={(current.address as string) ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Telefone</Label>
              <Input value={(current.phone as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={(current.email as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={(current.website as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => update.mutate()} disabled={update.isPending || Object.keys(form).length === 0}>
              <Save className="h-4 w-4" /> {update.isPending ? "A guardar…" : "Guardar alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Upload de logo em fase 2</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">
          A funcionalidade de upload de logo será adicionada na próxima fase de implementação.
        </CardContent>
      </Card>
    </div>
  );
}
