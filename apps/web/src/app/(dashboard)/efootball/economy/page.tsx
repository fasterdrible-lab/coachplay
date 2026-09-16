'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Coins, Loader2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { getEfootballGameId } from '../../../../lib/efootball';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pack {
  id: string;
  name: string;
  cost: number;
  currency: string;
  oddsVerifiedAt: string | null;
}

interface Squad {
  id: string;
  name: string;
}

type Recommendation = 'RECOMMENDED' | 'NEUTRAL' | 'NOT_RECOMMENDED' | 'INSUFFICIENT_DATA';

interface EvaluationResult {
  recommendation: Recommendation;
  teamNeedScore: number;
  duplicateRisk: number;
  expectedValue: number | null;
  coinRisk: number;
  recommendationScore: number | null;
  reasons: string[];
}

const RECOMMENDATION_STYLES: Record<Recommendation, { label: string; className: string }> = {
  RECOMMENDED: { label: 'Recomendado', className: 'bg-[#6fcf97]/15 text-[#6fcf97]' },
  NEUTRAL: { label: 'Neutro', className: 'bg-white/[0.08] text-[#f8f8fc]/70' },
  NOT_RECOMMENDED: { label: 'Não recomendado', className: 'bg-[#e2718a]/15 text-[#e2718a]' },
  INSUFFICIENT_DATA: { label: 'Dados insuficientes', className: 'bg-[#e0954a]/15 text-[#e0954a]' },
};

export default function EconomyAdvisorPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [packId, setPackId] = useState('');
  const [userCoins, setUserCoins] = useState('1000');
  const [userSquadId, setUserSquadId] = useState('');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const gameId = await getEfootballGameId();
        const [packsData, squadsData] = await Promise.all([
          api.get<Pack[]>(`/economy-advisor/packs?gameId=${gameId}`),
          api.get<Squad[]>(`/squad-builder/squads?gameId=${gameId}`),
        ]);
        setPacks(packsData);
        setSquads(squadsData);
        if (packsData[0]) setPackId(packsData[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar os packs.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleEvaluate = async () => {
    if (!packId) return;
    setIsEvaluating(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.post<EvaluationResult>('/economy-advisor/evaluate', {
        packId,
        userCoins: Number(userCoins) || 0,
        ...(userSquadId && { userSquadId }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível avaliar esse pack.');
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-[#f8f8fc]">Economy Advisor</h1>
      <p className="mb-6 text-sm text-[#f8f8fc]/45">Vale a pena gastar suas moedas nesse pack?</p>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/20 bg-[#e2718a]/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{error}</p>
        </div>
      )}

      {packs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl py-16 text-center">
          <Coins className="mb-3 h-8 w-8 text-[#f8f8fc]/25" />
          <p className="text-sm text-[#f8f8fc]/55">Nenhum pack disponível pra avaliação ainda.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Pack</label>
              <select
                value={packId}
                onChange={(e) => setPackId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f8f8fc] focus:outline-none focus:ring-2 focus:ring-gold/50"
              >
                {packs.map((p) => (
                  <option key={p.id} value={p.id} className="bg-ink2">
                    {p.name} ({p.cost} {p.currency})
                  </option>
                ))}
              </select>
            </div>
            <Input label="Suas moedas" type="number" min={0} value={userCoins} onChange={(e) => setUserCoins(e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Elenco (opcional)</label>
              <select
                value={userSquadId}
                onChange={(e) => setUserSquadId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f8f8fc] focus:outline-none focus:ring-2 focus:ring-gold/50"
              >
                <option value="" className="bg-ink2">Nenhum</option>
                {squads.map((s) => (
                  <option key={s.id} value={s.id} className="bg-ink2">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button isLoading={isEvaluating} onClick={handleEvaluate}>
            Avaliar pack
          </Button>

          {result && (
            <div className="mt-5 rounded-lg border border-white/[0.08] p-4">
              <span className={cn('mb-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium', RECOMMENDATION_STYLES[result.recommendation].className)}>
                {RECOMMENDATION_STYLES[result.recommendation].label}
              </span>

              <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label="Necessidade do time" value={`${Math.round(result.teamNeedScore * 100)}%`} />
                <Stat label="Risco de duplicar" value={`${Math.round(result.duplicateRisk * 100)}%`} />
                <Stat label="Risco financeiro" value={`${Math.round(result.coinRisk * 100)}%`} />
                <Stat label="Nota" value={result.recommendationScore !== null ? `${Math.round(result.recommendationScore * 100)}%` : '—'} />
              </div>

              {result.reasons.length > 0 && (
                <ul className="space-y-1 text-sm text-[#f8f8fc]/70">
                  {result.reasons.map((reason, i) => (
                    <li key={i}>• {reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#f8f8fc]/45">{label}</p>
      <p className="font-semibold text-[#f8f8fc]">{value}</p>
    </div>
  );
}
