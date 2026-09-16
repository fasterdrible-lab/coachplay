'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2, MessageSquareText, Trash2 } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { formatAiCost } from '../../../../../lib/efootball';
import { Button } from '../../../../../components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SquadPlayer {
  userPlayerId: string;
  slot: string | null;
  isStarting: boolean;
}

interface SquadDetail {
  id: string;
  name: string;
  formation: { code: string; name: string } | null;
  players: SquadPlayer[];
}

interface UserPlayer {
  id: string;
  playerCard: { position: string; overallBase: number; player: { name: string } };
}

interface SquadCoachExplanation {
  explanation: string;
  modelUsed: string;
  costEstimate: number;
}

export default function SquadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [squad, setSquad] = useState<SquadDetail | null>(null);
  const [players, setPlayers] = useState<Map<string, UserPlayer>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [explanation, setExplanation] = useState<SquadCoachExplanation | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [squadData, playersData] = await Promise.all([
          api.get<SquadDetail>(`/squad-builder/squads/${params.id}`),
          api.get<UserPlayer[]>('/user-players'),
        ]);
        setSquad(squadData);
        setPlayers(new Map(playersData.map((p) => [p.id, p])));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar esse elenco.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [params.id]);

  const handleExplain = async () => {
    setIsExplaining(true);
    setExplainError(null);
    try {
      const data = await api.get<SquadCoachExplanation | null>(`/squad-builder/squads/${params.id}/explain`);
      if (data) setExplanation(data);
      else setExplainError('O Coach de Elenco está indisponível agora — tente novamente em instantes.');
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Não foi possível gerar a explicação.');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleDelete = async () => {
    if (!squad || !confirm(`Excluir o elenco "${squad.name}"?`)) return;
    try {
      await api.delete(`/squad-builder/squads/${squad.id}`);
      router.push('/efootball/squads');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  if (error || !squad) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl py-16 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-[#e2718a]" />
          <p className="text-sm text-[#f8f8fc]/55">{error ?? 'Elenco não encontrado.'}</p>
        </div>
      </div>
    );
  }

  const starters = squad.players.filter((p) => p.isStarting);
  const bench = squad.players.filter((p) => !p.isStarting);

  const renderPlayer = (sp: SquadPlayer) => {
    const detail = players.get(sp.userPlayerId);
    return (
      <div key={sp.userPlayerId} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
        <span className="text-[#f8f8fc]/55">{sp.slot ?? detail?.playerCard.position ?? '—'}</span>
        <span className="font-medium text-[#f8f8fc]">
          {detail ? `${detail.playerCard.player.name} (${detail.playerCard.overallBase})` : sp.userPlayerId}
        </span>
      </div>
    );
  };

  return (
    <div className="p-6">
      <button
        onClick={() => router.push('/efootball/squads')}
        className="mb-4 flex items-center gap-1.5 text-sm text-[#f8f8fc]/55 hover:text-[#f8f8fc]"
      >
        <ArrowLeft className="h-4 w-4" />
        Squad Builder
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">{squad.name}</h1>
          <p className="mt-1 text-sm text-[#f8f8fc]/45">{squad.formation?.code} — {squad.formation?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" isLoading={isExplaining} onClick={handleExplain}>
            <MessageSquareText className="h-4 w-4" />
            Perguntar ao Coach de Elenco
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {explainError && <p className="mb-4 text-sm text-[#e2718a]">{explainError}</p>}
      {explanation && (
        <div className="mb-6 rounded-xl border border-gold/20 bg-gold/5 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gold-bright">
            Coach de Elenco ({explanation.modelUsed} · {formatAiCost(explanation.costEstimate)})
          </p>
          <p className="text-sm text-[#f8f8fc]/85">{explanation.explanation}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
          <h2 className="mb-3 text-sm font-semibold text-[#f8f8fc]/55">Titulares ({starters.length}/11)</h2>
          <div className="space-y-1.5">{starters.map(renderPlayer)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
          <h2 className="mb-3 text-sm font-semibold text-[#f8f8fc]/55">Banco ({bench.length})</h2>
          {bench.length === 0 ? (
            <p className="text-sm text-[#f8f8fc]/45">Sem jogadores no banco.</p>
          ) : (
            <div className="space-y-1.5">{bench.map(renderPlayer)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
