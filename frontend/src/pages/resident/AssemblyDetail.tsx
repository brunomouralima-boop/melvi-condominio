import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AssemblyDetail, AgendaItemFull, MyFraction, VoteChoice } from "@/types";
import { ResultBar } from "@/components/assemblies/ResultBar";
import {
  ASSEMBLY_TYPE_LABEL, ASSEMBLY_STATUS_LABEL, ASSEMBLY_STATUS_VARIANT,
  AGENDA_STATUS_LABEL, AGENDA_STATUS_VARIANT, CHOICE_LABEL,
} from "@/components/assemblies/labels";
import toast from "react-hot-toast";

const CHOICES: VoteChoice[] = ["FOR", "AGAINST", "ABSTAIN"];
const CHOICE_STYLE: Record<VoteChoice, string> = {
  FOR: "border-emerald-300 bg-emerald-50 text-emerald-700",
  AGAINST: "border-coral-300 bg-coral-50 text-coral-700",
  ABSTAIN: "border-slate-300 bg-slate-50 text-slate-700",
};

export function ResidentAssemblyDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: a, isLoading } = useQuery({
    queryKey: ["assembly", id],
    queryFn: () => api.get<AssemblyDetail>(`/assemblies/${id}`).then((r) => r.data),
  });

  const vote = useMutation({
    mutationFn: ({ itemId, fractionId, choice }: { itemId: string; fractionId: string; choice: VoteChoice }) =>
      api.post(`/assemblies/${id}/agenda/${itemId}/vote`, { fractionId, choice }),
    onSuccess: () => { toast.success("Voto registado"); qc.invalidateQueries({ queryKey: ["assembly", id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Falha ao votar"),
  });

  if (isLoading || !a) return <div className="p-6 text-slate-400">A carregar…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate("/resident/assemblies")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-900">
        <ArrowLeft className="h-4 w-4" /> Assembleias
      </button>

      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-brand-900">{a.title}</h1>
            <Badge variant={ASSEMBLY_STATUS_VARIANT[a.status]}>{ASSEMBLY_STATUS_LABEL[a.status]}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>{ASSEMBLY_TYPE_LABEL[a.type]}</span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDate(a.scheduledAt)}</span>
            {a.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {a.location}</span>}
          </div>
          {a.description && <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{a.description}</p>}
          {a.myFractions.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Apenas proprietários podem votar. A sua conta não está associada a nenhuma fração como proprietário.
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="font-display text-lg font-semibold text-brand-900">Ordem de trabalhos ({a.agendaItems.length})</h2>

      <div className="space-y-3">
        {a.agendaItems.map((item, idx) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <div>
                <CardTitle className="text-base">{idx + 1}. {item.title}</CardTitle>
                {item.description && <p className="mt-1 text-sm text-slate-500 whitespace-pre-line">{item.description}</p>}
              </div>
              <Badge variant={AGENDA_STATUS_VARIANT[item.status]}>{AGENDA_STATUS_LABEL[item.status]}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Votação aberta → botões por fração própria */}
              {item.status === "VOTING_OPEN" && a.myFractions.length > 0 && (
                <div className="space-y-2">
                  {a.myFractions.map((f) => (
                    <VoteRow
                      key={f.id}
                      fraction={f}
                      item={item}
                      pending={vote.isPending}
                      onVote={(choice) => vote.mutate({ itemId: item.id, fractionId: f.id, choice })}
                    />
                  ))}
                </div>
              )}

              {/* Resultados (quando há votos ou já apurado) */}
              {(item.tally.totalCount > 0 || item.status === "APPROVED" || item.status === "REJECTED") && (
                <ResultBar tally={item.tally} totalPermillage={a.totalPermillage} />
              )}

              {item.status === "PENDING" && (
                <div className="text-sm text-slate-400">Votação ainda não aberta.</div>
              )}
            </CardContent>
          </Card>
        ))}
        {a.agendaItems.length === 0 && (
          <Card><CardContent className="py-6 text-center text-slate-400">Sem pontos na ordem de trabalhos.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function VoteRow({ fraction, item, pending, onVote }: { fraction: MyFraction; item: AgendaItemFull; pending: boolean; onVote: (choice: VoteChoice) => void }) {
  const myChoice = item.myVotes.find((v) => v.fractionId === fraction.id)?.choice;
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-brand-900">{fraction.tower ?? ""} {fraction.identifier}</span>
        <span className="text-xs text-slate-400">{fraction.permillage.toFixed(2)}‰</span>
      </div>
      <div className="flex gap-2">
        {CHOICES.map((c) => {
          const active = myChoice === c;
          return (
            <button
              key={c}
              disabled={pending}
              onClick={() => onVote(c)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition ${active ? CHOICE_STYLE[c] : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <span className="inline-flex items-center gap-1">
                {active && <Check className="h-3.5 w-3.5" />}
                {CHOICE_LABEL[c]}
              </span>
            </button>
          );
        })}
      </div>
      {myChoice && <div className="mt-1.5 text-xs text-slate-400">O seu voto: <span className="font-medium">{CHOICE_LABEL[myChoice]}</span> — pode alterar enquanto a votação estiver aberta.</div>}
    </div>
  );
}
