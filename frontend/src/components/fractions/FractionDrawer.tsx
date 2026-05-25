import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Ruler, Sofa, Users as UsersIcon, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerCloseButton,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { UserPicker } from "./UserPicker";
import type { AuthUser, Fraction, FractionStatus, FractionType, Tower } from "@/types";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  /** If provided, edit mode. Otherwise create. */
  fraction?: Fraction | null;
}

interface FormState {
  towerId: string;
  identifier: string;
  floor: number;
  type: FractionType;
  status: FractionStatus;
  permillage: string;
  areaM2: string;
  privateAreaM2: string;
  commonAreaM2: string;
  grossAreaM2: string;
  bedroomsCount: number;
  bathroomsCount: number;
  parkingSpots: number;
  hasBalcony: boolean;
  hasSuite: boolean;
  hasStorageRoom: boolean;
  orientation: string;
  description: string;
  observations: string;
  owner: AuthUser | null;
  tenant: AuthUser | null;
}

const EMPTY: FormState = {
  towerId: "",
  identifier: "",
  floor: 0,
  type: "APARTMENT",
  status: "VACANT",
  permillage: "",
  areaM2: "",
  privateAreaM2: "",
  commonAreaM2: "",
  grossAreaM2: "",
  bedroomsCount: 0,
  bathroomsCount: 0,
  parkingSpots: 0,
  hasBalcony: false,
  hasSuite: false,
  hasStorageRoom: false,
  orientation: "",
  description: "",
  observations: "",
  owner: null,
  tenant: null,
};

export function FractionDrawer({ open, onClose, fraction }: Props) {
  const qc = useQueryClient();
  const isEdit = !!fraction;

  const { data: towers = [] } = useQuery({
    queryKey: ["towers"],
    queryFn: () => api.get<Tower[]>("/towers").then((r) => r.data),
    enabled: open,
  });

  const [f, setF] = useState<FormState>(EMPTY);

  // Reset when opening / editing different fraction
  useEffect(() => {
    if (!open) return;
    if (fraction) {
      setF({
        towerId: fraction.towerId,
        identifier: fraction.identifier,
        floor: fraction.floor,
        type: fraction.type,
        status: fraction.status,
        permillage: String(fraction.permillage),
        areaM2: String(fraction.areaM2),
        privateAreaM2: fraction.privateAreaM2 != null ? String(fraction.privateAreaM2) : "",
        commonAreaM2: fraction.commonAreaM2 != null ? String(fraction.commonAreaM2) : "",
        grossAreaM2: fraction.grossAreaM2 != null ? String(fraction.grossAreaM2) : "",
        bedroomsCount: fraction.bedroomsCount ?? 0,
        bathroomsCount: fraction.bathroomsCount ?? 0,
        parkingSpots: fraction.parkingSpots ?? 0,
        hasBalcony: fraction.hasBalcony ?? false,
        hasSuite: fraction.hasSuite ?? false,
        hasStorageRoom: fraction.hasStorageRoom ?? false,
        orientation: fraction.orientation ?? "",
        description: fraction.description ?? "",
        observations: fraction.observations ?? "",
        owner: (fraction.owner as AuthUser | undefined) ?? null,
        tenant: (fraction.tenant as AuthUser | undefined) ?? null,
      });
    } else {
      setF(EMPTY);
    }
  }, [open, fraction]);

  // Auto-compute grossArea = private + common (when user hasn't manually set it)
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "privateAreaM2" || key === "commonAreaM2") {
        const priv = Number(key === "privateAreaM2" ? value : prev.privateAreaM2);
        const comm = Number(key === "commonAreaM2" ? value : prev.commonAreaM2);
        if (!isNaN(priv) && !isNaN(comm) && (priv > 0 || comm > 0)) {
          next.grossAreaM2 = (priv + comm).toFixed(2);
        }
      }
      return next;
    });
  }

  // Validations
  const sameOwnerTenant = f.owner && f.tenant && f.owner.id === f.tenant.id;
  const tenantWithoutOwner = !!f.tenant && !f.owner;

  const submit = useMutation({
    mutationFn: () => {
      const body: any = {
        identifier: f.identifier,
        floor: f.floor,
        type: f.type,
        status: f.status,
        permillage: Number(f.permillage),
        areaM2: Number(f.areaM2),
        privateAreaM2: f.privateAreaM2 ? Number(f.privateAreaM2) : null,
        commonAreaM2: f.commonAreaM2 ? Number(f.commonAreaM2) : null,
        grossAreaM2: f.grossAreaM2 ? Number(f.grossAreaM2) : null,
        bedroomsCount: f.bedroomsCount,
        bathroomsCount: f.bathroomsCount,
        parkingSpots: f.parkingSpots,
        hasBalcony: f.hasBalcony,
        hasSuite: f.hasSuite,
        hasStorageRoom: f.hasStorageRoom,
        orientation: f.orientation || null,
        description: f.description || null,
        observations: f.observations || null,
        ownerId: f.owner?.id ?? null,
        tenantId: f.tenant?.id ?? null,
      };
      if (!isEdit) body.towerId = f.towerId;
      return isEdit
        ? api.put(`/fractions/${fraction!.id}`, body)
        : api.post("/fractions", body);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Fracção actualizada" : "Fracção criada");
      qc.invalidateQueries({ queryKey: ["fractions"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !f.towerId) return toast.error("Selecione a torre");
    if (!f.identifier) return toast.error("Identificador obrigatório");
    if (!f.permillage || Number(f.permillage) <= 0) return toast.error("Permilagem deve ser > 0");
    if (!f.areaM2 || Number(f.areaM2) <= 0) return toast.error("Área deve ser > 0");
    if (sameOwnerTenant) return toast.error("Proprietário e inquilino não podem ser a mesma pessoa");
    if (tenantWithoutOwner) return toast.error("Não pode haver inquilino sem proprietário");
    submit.mutate();
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="lg">
        <DrawerHeader>
          <div>
            <DrawerTitle>{isEdit ? "Editar fracção" : "Nova fracção"}</DrawerTitle>
            <DrawerDescription>
              {isEdit ? `${fraction!.identifier} · ${fraction!.tower?.name}` : "Preencha as 4 secções e guarde no final"}
            </DrawerDescription>
          </div>
          <DrawerCloseButton />
        </DrawerHeader>

        <form className="flex-1 flex flex-col min-h-0" onSubmit={handleSubmit}>
          <DrawerBody>
            <div className="space-y-6">
              {/* SECÇÃO 1 — IDENTIFICAÇÃO */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-900 uppercase tracking-wider mb-3">
                  <Home className="h-4 w-4 text-brand-500" />
                  1. Identificação
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Torre {!isEdit && "*"}</Label>
                    <Select
                      value={f.towerId}
                      onChange={(e) => update("towerId", e.target.value)}
                      disabled={isEdit}
                      required={!isEdit}
                    >
                      <option value="">— selecionar torre —</option>
                      {towers.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </Select>
                    {isEdit && <p className="text-xs text-slate-500 mt-1">Torre não pode ser alterada após criação.</p>}
                  </div>
                  <div>
                    <Label>Identificador *</Label>
                    <Input value={f.identifier} onChange={(e) => update("identifier", e.target.value)} placeholder="1A, Loja 2…" required />
                  </div>
                  <div>
                    <Label>Piso *</Label>
                    <Input type="number" min={0} value={f.floor} onChange={(e) => update("floor", Number(e.target.value))} required />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={f.type} onChange={(e) => update("type", e.target.value as FractionType)}>
                      <option value="APARTMENT">Apartamento</option>
                      <option value="COMMERCIAL">Comercial</option>
                      <option value="GARAGE">Garagem</option>
                      <option value="STORAGE">Arrecadação</option>
                      <option value="OTHER">Outro</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Select value={f.status} onChange={(e) => update("status", e.target.value as FractionStatus)}>
                      <option value="OCCUPIED">Ocupada</option>
                      <option value="VACANT">Vaga</option>
                      <option value="UNDER_RENOVATION">Em obras</option>
                      <option value="BLOCKED">Bloqueada</option>
                    </Select>
                  </div>
                </div>
              </section>

              {/* SECÇÃO 2 — MÉTRICAS */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-900 uppercase tracking-wider mb-3">
                  <Ruler className="h-4 w-4 text-brand-500" />
                  2. Métricas
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Permilagem *</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.0001"
                        min={0}
                        value={f.permillage}
                        onChange={(e) => update("permillage", e.target.value)}
                        required
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">‰</span>
                    </div>
                  </div>
                  <div>
                    <Label>Área total *</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={f.areaM2}
                        onChange={(e) => update("areaM2", e.target.value)}
                        required
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">m²</span>
                    </div>
                  </div>
                  <div>
                    <Label>Área privativa</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={f.privateAreaM2}
                        onChange={(e) => update("privateAreaM2", e.target.value)}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">m²</span>
                    </div>
                  </div>
                  <div>
                    <Label>Área bruta comum</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={f.commonAreaM2}
                        onChange={(e) => update("commonAreaM2", e.target.value)}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">m²</span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Área bruta total</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={f.grossAreaM2}
                        onChange={(e) => update("grossAreaM2", e.target.value)}
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">m²</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Auto-calculada: privativa + comum (editável).</p>
                  </div>
                </div>
              </section>

              {/* SECÇÃO 3 — CARACTERÍSTICAS */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-900 uppercase tracking-wider mb-3">
                  <Sofa className="h-4 w-4 text-brand-500" />
                  3. Características
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Quartos</Label>
                    <Input type="number" min={0} max={10} value={f.bedroomsCount} onChange={(e) => update("bedroomsCount", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>WCs</Label>
                    <Input type="number" min={0} max={10} value={f.bathroomsCount} onChange={(e) => update("bathroomsCount", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Lugares de estacionamento</Label>
                    <Input type="number" min={0} max={10} value={f.parkingSpots} onChange={(e) => update("parkingSpots", Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Orientação</Label>
                    <Select value={f.orientation} onChange={(e) => update("orientation", e.target.value)}>
                      <option value="">—</option>
                      <option value="Norte">Norte</option>
                      <option value="Sul">Sul</option>
                      <option value="Nascente">Nascente</option>
                      <option value="Poente">Poente</option>
                      <option value="Múltiplas">Múltiplas</option>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={f.hasBalcony} onChange={(e) => update("hasBalcony", e.target.checked)} />
                    Varanda
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={f.hasSuite} onChange={(e) => update("hasSuite", e.target.checked)} />
                    Suite
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={f.hasStorageRoom} onChange={(e) => update("hasStorageRoom", e.target.checked)} />
                    Arrecadação
                  </label>
                </div>
                <div className="mt-3">
                  <Label>Descrição</Label>
                  <Textarea rows={2} value={f.description} onChange={(e) => update("description", e.target.value)} placeholder="Características adicionais…" />
                </div>
                <div className="mt-3">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={f.observations} onChange={(e) => update("observations", e.target.value)} />
                </div>
              </section>

              {/* SECÇÃO 4 — TITULARES */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-900 uppercase tracking-wider mb-3">
                  <UsersIcon className="h-4 w-4 text-brand-500" />
                  4. Titulares
                </h3>
                <div className="space-y-3">
                  <UserPicker
                    label="Proprietário"
                    variant="owner"
                    value={f.owner}
                    onChange={(u) => update("owner", u)}
                    excludeUserIds={f.tenant ? [f.tenant.id] : []}
                  />
                  <UserPicker
                    label="Inquilino (opcional)"
                    variant="tenant"
                    value={f.tenant}
                    onChange={(u) => update("tenant", u)}
                    excludeUserIds={f.owner ? [f.owner.id] : []}
                  />
                  {sameOwnerTenant && (
                    <div className="rounded-lg bg-coral-50 border border-coral-200 px-3 py-2 text-sm text-coral-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      Proprietário e inquilino não podem ser a mesma pessoa.
                    </div>
                  )}
                  {tenantWithoutOwner && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      É necessário definir um proprietário antes de associar inquilino.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "A guardar…" : isEdit ? "Guardar alterações" : "Criar fracção"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
