import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useCategories } from "../lib/queries";
import { Badge, Button, Card, Field, Input, Modal, Select } from "../components/ui";
import type { Category, CategoryKind } from "../lib/types";

interface FormState { id?: string; name: string; kind: CategoryKind; color: string }
const empty = (): FormState => ({ name: "", kind: "EXPENSE", color: "#dc2626" });

export default function Categories() {
  const qc = useQueryClient();
  const categories = useCategories();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty());

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = { name: f.name, kind: f.kind, color: f.color };
      if (f.id) await api.put(`/categories/${f.id}`, payload);
      else await api.post("/categories", payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setOpen(false); toast.success("Categoria guardada"); },
    onError: () => toast.error("Erro ao guardar"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Categoria eliminada"); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error ?? "Erro"),
  });

  const openNew = (kind: CategoryKind) => { setForm({ ...empty(), kind, color: kind === "INCOME" ? "#16a34a" : "#dc2626" }); setOpen(true); };
  const openEdit = (c: Category) => { setForm({ id: c.id, name: c.name, kind: c.kind, color: c.color }); setOpen(true); };

  const submit = (e: FormEvent) => { e.preventDefault(); if (!form.name) return toast.error("Indique o nome"); save.mutate(form); };

  const render = (kind: CategoryKind) => (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{kind === "INCOME" ? "Receitas" : "Despesas"}</h2>
        <Button variant="secondary" onClick={() => openNew(kind)}><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.data?.filter((c) => c.kind === kind).map((c) => (
          <span key={c.id} className="group inline-flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-3 pr-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            <span className="text-sm">{c.name}</span>
            <button onClick={() => openEdit(c)} className="rounded-full p-1 text-slate-400 hover:text-slate-700"><Pencil className="h-3 w-3" /></button>
            <button onClick={() => del.mutate(c.id)} className="rounded-full p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
          </span>
        ))}
        {categories.data?.filter((c) => c.kind === kind).length === 0 && <span className="text-sm text-slate-400">Nenhuma.</span>}
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Categorias</h1>
      {render("INCOME")}
      {render("EXPENSE")}

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Editar categoria" : "Nova categoria"}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CategoryKind })}>
                <option value="EXPENSE">Despesa</option>
                <option value="INCOME">Receita</option>
              </Select>
            </Field>
            <Field label="Cor"><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 p-1" /></Field>
          </div>
          <div className="flex items-center gap-2"><span className="text-sm text-slate-500">Pré-visualização:</span><Badge color={form.color}>{form.name || "Categoria"}</Badge></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
