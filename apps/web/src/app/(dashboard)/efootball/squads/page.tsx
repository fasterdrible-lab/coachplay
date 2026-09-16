'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2, Shirt } from 'lucide-react';
import { api } from '../../../../lib/api';
import { getEfootballGameId } from '../../../../lib/efootball';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Formation {
  id: string;
  code: string;
  name: string;
}

interface SquadSummary {
  id: string;
  name: string;
  isDefault: boolean;
  formation: { code: string; name: string } | null;
  players: Array<{ isStarting: boolean }>;
}

interface UserPlayer {
  id: string;
  playerCard: { player: { name: string }; overallBase: number };
}

interface SquadSlotAssignment {
  slot: string;
  position: string;
  userPlayerId: string;
  score: number;
  exactPosition: boolean;
}

interface WeakPosition {
  slot: string;
  position: string;
  reason: 'EMPTY' | 'OUT_OF_POSITION';
}

interface BuildSquadResult {
  formationCode: string;
  startingXI: SquadSlotAssignment[];
  bench: string[];
  weakPositions: WeakPosition[];
}

export default function SquadsPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [squads, setSquads] = useState<SquadSummary[]>([]);
  const [playerNames, setPlayerNames] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formationCode, setFormationCode] = useState('');
  const [preview, setPreview] = useState<BuildSquadResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [squadName, setSquadName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const gid = await getEfootballGameId();
        setGameId(gid);
        const [formationsData, squadsData, playersData] = await Promise.all([
          api.get<Formation[]>(`/squad-builder/formations?gameId=${gid}`),
          api.get<SquadSummary[]>(`/squad-builder/squads?gameId=${gid}`),
          api.get<UserPlayer[]>('/user-players'),
        ]);
        setFormations(formationsData);
        setSquads(squadsData);
        setPlayerNames(new Map(playersData.map((p) => [p.id, `${p.playerCard.player.name} (${p.playerCard.overallBase})`])));
        if (formationsData[0]) setFormationCode(formationsData[0].code);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar o Squad Builder.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleGenerate = async () => {
    if (!gameId || !formationCode) return;
    setIsGenerating(true);
    setError(null);
    setPreview(null);
    try {
      const data = await api.post<BuildSquadResult>('/squad-builder/generate', { gameId, formationCode });
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o elenco.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!gameId || !formationCode || !squadName.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const saved = await api.post<SquadSummary>('/squad-builder/squads', { gameId, formationCode, name: squadName.trim() });
      setSquads((prev) => [saved, ...prev]);
      setPreview(null);
      setSquadName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o elenco.');
    } finally {
      setIsSaving(false);
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
      <h1 className="mb-1 text-2xl font-bold text-[#f8f8fc]">Squad Builder</h1>
      <p className="mb-6 text-sm text-[#f8f8fc]/45">Monte sua escalação titular automaticamente a partir do seu elenco</p>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/20 bg-[#e2718a]/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{error}</p>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#f8f8fc]/55">Gerar novo elenco</h2>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">Formação</label>
            <select
              value={formationCode}
              onChange={(e) => setFormationCode(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f8f8fc] focus:outline-none focus:ring-2 focus:ring-gold/50"
            >
              {formations.map((f) => (
                <option key={f.id} value={f.code} className="bg-ink2">
                  {f.code} — {f.name}
                </option>
              ))}
            </select>
          </div>
          <Button variant="secondary" isLoading={isGenerating} onClick={handleGenerate} disabled={!formationCode}>
            Gerar escalação
          </Button>
        </div>

        {preview && (
          <div className="mt-4 rounded-lg border border-white/[0.08] p-4">
            <p className="mb-3 text-sm font-medium text-[#f8f8fc]">Titulares — {preview.formationCode}</p>
            <div className="mb-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {preview.startingXI.map((s) => (
                <div key={s.slot} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
                  <span className="text-[#f8f8fc]/55">
                    {s.slot} ({s.position})
                  </span>
                  <span className={cn('font-medium', !s.exactPosition && 'text-[#e0954a]')}>
                    {playerNames.get(s.userPlayerId) ?? s.userPlayerId}
                  </span>
                </div>
              ))}
            </div>

            {preview.weakPositions.length > 0 && (
              <div className="mb-4 rounded-lg border border-[#e0954a]/20 bg-[#e0954a]/5 px-3 py-2">
                <p className="text-xs font-medium text-[#e0954a]">
                  Posições fracas: {preview.weakPositions.map((w) => `${w.slot} (${w.reason === 'EMPTY' ? 'vazia' : 'fora de posição'})`).join(', ')}
                </p>
              </div>
            )}

            <div className="flex items-end gap-2">
              <Input placeholder="Nome do elenco" value={squadName} onChange={(e) => setSquadName(e.target.value)} className="max-w-xs" />
              <Button isLoading={isSaving} onClick={handleSave} disabled={!squadName.trim()}>
                Salvar elenco
              </Button>
            </div>
          </div>
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-[#f8f8fc]/55">Elencos salvos</h2>
      {squads.length === 0 ? (
        <p className="text-sm text-[#f8f8fc]/45">Nenhum elenco salvo ainda — gere um acima.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {squads.map((squad) => (
            <Link
              key={squad.id}
              href={`/efootball/squads/${squad.id}`}
              className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-4 transition-colors hover:bg-white/[0.04]"
            >
              <div className="mb-1 flex items-center gap-2">
                <Shirt className="h-4 w-4 text-[#f8f8fc]/45" />
                <h3 className="text-sm font-semibold text-[#f8f8fc]">{squad.name}</h3>
              </div>
              <p className="text-xs text-[#f8f8fc]/45">
                {squad.formation?.code ?? '—'} · {squad.players.filter((p) => p.isStarting).length}/11 titulares
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
