import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPicker } from "./UserPicker";
import type { AuthUser, Fraction } from "@/types";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  fraction: Fraction | null;
  role: "owner" | "tenant";
}

export function AssignDialog({ open, onClose, fraction, role }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<AuthUser | null>(null);

  // Initialize with current value
  useEffect(() => {
    if (open && fraction) {
      const current = role === "owner" ? fraction.owner : fraction.tenant;
      setSelected((current as AuthUser | undefined) ?? null);
    }
  }, [open, fraction, role]);

  const mutate = useMutation({
    mutationFn: () => {
      if (!fraction) throw new Error("No fraction");
      const path = role === "owner" ? "owner" : "tenant";
      return api.patch(`/fractions/${fraction.id}/${path}`, {
        [role === "owner" ? "ownerId" : "tenantId"]: selected?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success(role === "owner" ? "Proprietário actualizado" : "Inquilino actualizado");
      qc.invalidateQueries({ queryKey: ["fractions"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha"),
  });

  if (!fraction) return null;

  const otherUserId = role === "owner" ? fraction.tenant?.id : fraction.owner?.id;
  const title = role === "owner" ? "Atribuir proprietário" : "Atribuir inquilino";

  // Tenant business rule: must have owner first
  const blockNoOwner = role === "tenant" && !fraction.owner && !!selected;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Fracção {fraction.identifier} · {fraction.tower?.name} · Piso {fraction.floor}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <UserPicker
            value={selected}
            onChange={setSelected}
            variant={role}
            excludeUserIds={otherUserId ? [otherUserId] : []}
            label={role === "owner" ? "Selecionar proprietário" : "Selecionar inquilino"}
          />

          {blockNoOwner && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              É necessário definir um proprietário antes de associar inquilino.
            </div>
          )}

          {role === "owner" && fraction.owner && !selected && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              Ao remover o proprietário, o inquilino (se existir) também ficará órfão. Considere primeiro remover o inquilino.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutate.mutate()} disabled={mutate.isPending || blockNoOwner}>
            {mutate.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
