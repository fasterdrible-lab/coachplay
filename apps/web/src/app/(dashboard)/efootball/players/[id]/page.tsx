'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2, Star, Trash2, Wand2 } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { BUILD_STRATEGIES, BUILD_STRATEGY_LABELS } from '../../../../../lib/efootball';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { cn } from '../../../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserPlayerBuild {
  id: string;
  strategy: string;
  position: string;
  level: number;
  allocation: Record<string, number>;
  computedAttributes: Record<string, number>;
  roleScore: number;
  totalPointsUsed: number;
  totalPointsAvailable: number;
  createdAt: string;
}

interface UserPlayerDetail {
  id: string;
  currentLevel: number;
  favoritePosition: string | null;
  userNotes: string | null;
  isFavorite: boolean;
  currentBuildId: string | null;
  playerCard: { id: string; position: string; overallBase: number; maxLevel: number; cardType: string; player: { name: string } };
  builds: UserPlayerBuild[];
}

interface BuildPreview {
  roleScore: number;
  totalPointsUsed: number;
  totalPointsAvailable: number;
  recommendedAllocation: Record<string, number>;
  expectedAttributes: Record<string, number>;
  explanationData: { prioritizedStats: string[] };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [player, setPlayer] = useState<UserPlayerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayer = useCallback(async () => {
    try {
      const data = await api.get<UserPlayerDetail>(`/user-players/${params.id}`);
      setPlayer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar esse jogador.');
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPlayer();
  }, [fetchPlayer]);

  const toggleFavorite = async () => {
    if (!player) return;
    try {
      await api.patch(`/user-players/${player.id}`, { isFavorite: !player.isFavorite });
      fetchPlayer();
    } catch {
      // best-effort
    }
  };

  const handleRemove = async () => {
    if (!player || !confirm('Remover este jogador do seu elenco?')) return;
    try {
      await api.delete(`/user-players/${player.id}`);
      router.push('/efootball/players');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover.');
    }
  };

  const handleActivate = async (buildId: string) => {
    if (!player) return;
    try {
      await api.patch(`/user-players/${player.id}/builds/${buildId}/activate`);
      fetchPlayer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ativar essa build.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl py-16 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-[#e2718a]" />
          <p className="text-sm text-[#f8f8fc]/55">{error ?? 'Jogador não encontrado.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={() => router.push('/efootball/players')}
        className="mb-4 flex items-center gap-1.5 text-sm text-[#f8f8fc]/55 hover:text-[#f8f8fc]"
      >
        <ArrowLeft className="h-4 w-4" />
        Meus Jogadores
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-6">
        <div>
          <span className="mb-2 inline-block rounded-full bg-white/[0.08] px-2.5 py-0.5 text-xs font-medium text-[#f8f8fc]/70">
            {player.playerCard.cardType}
          </span>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">{player.playerCard.player.name}</h1>
          <p className="mt-1 text-sm text-[#f8f8fc]/45">
            Overall {player.playerCard.overallBase} · {player.playerCard.position} · Nível {player.currentLevel}/{player.playerCard.maxLevel}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={toggleFavorite}>
            <Star className={cn('h-4 w-4', player.isFavorite && 'fill-gold text-gold')} />
            {player.isFavorite ? 'Favorito' : 'Favoritar'}
          </Button>
          <Button variant="danger" onClick={handleRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <BuildGenerator
        playerCardId={player.playerCard.id}
        defaultPosition={player.playerCard.position}
        defaultLevel={player.currentLevel}
        userPlayerId={player.id}
        onSaved={fetchPlayer}
      />

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[#f8f8fc]/55">Builds salvas</h2>
        {player.builds.length === 0 ? (
          <p className="text-sm text-[#f8f8fc]/45">Nenhuma build salva ainda.</p>
        ) : (
          <div className="space-y-3">
            {player.builds.map((build) => (
              <div
                key={build.id}
                className={cn(
                  'rounded-xl border p-4',
                  player.currentBuildId === build.id ? 'border-gold/40 bg-gold/5' : 'border-white/[0.08] bg-ink2/60 backdrop-blur-xl',
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-[#f8f8fc]">
                    {BUILD_STRATEGY_LABELS[build.strategy] ?? build.strategy} · {build.position}
                  </p>
                  {player.currentBuildId === build.id ? (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold-bright">Ativa</span>
                  ) : (
                    <Button variant="ghost" onClick={() => handleActivate(build.id)}>
                      Ativar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-[#f8f8fc]/45">
                  Nível {build.level} · roleScore {build.roleScore.toFixed(0)} · {build.totalPointsUsed}/{build.totalPointsAvailable} pontos usados
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Build generator ──────────────────────────────────────────────────────────

function BuildGenerator({
  playerCardId,
  defaultPosition,
  defaultLevel,
  userPlayerId,
  onSaved,
}: {
  playerCardId: string;
  defaultPosition: string;
  defaultLevel: number;
  userPlayerId: string;
  onSaved: () => void;
}) {
  const [strategy, setStrategy] = useState<string>('BALANCED');
  const [position, setPosition] = useState(defaultPosition);
  const [level, setLevel] = useState(String(defaultLevel));
  const [points, setPoints] = useState('10');
  const [preview, setPreview] = useState<BuildPreview | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setPreview(null);
    try {
      const data = await api.post<BuildPreview>('/player-builds/generate', {
        playerCardId,
        level: Number(level) || 1,
        position,
        strategy,
        availableProgressionPoints: Number(points) || 0,
      });
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar a build.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.post(`/user-players/${userPlayerId}/builds`, {
        strategy,
        position,
        level: Number(level) || 1,
        allocation: preview.recommendedAllocation,
        computedAttributes: preview.expectedAttributes,
        roleScore: preview.roleScore,
        totalPointsUsed: preview.totalPointsUsed,
        totalPointsAvailable: preview.totalPointsAvailable,
      });
      setPreview(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a build.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#f8f8fc]/55">
        <Wand2 className="h-4 w-4" />
        Player Build Engine
      </h2>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/80">Estratégia</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f8f8fc] focus:outline-none focus:ring-2 focus:ring-gold/50"
          >
            {BUILD_STRATEGIES.map((s) => (
              <option key={s} value={s} className="bg-ink2">
                {BUILD_STRATEGY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <Input label="Posição" value={position} onChange={(e) => setPosition(e.target.value)} />
        <Input label="Nível" type="number" min={1} value={level} onChange={(e) => setLevel(e.target.value)} />
        <Input label="Pontos disponíveis" type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
      </div>

      <Button variant="secondary" isLoading={isGenerating} onClick={handleGenerate}>
        Gerar build
      </Button>

      {error && <p className="mt-3 text-sm text-[#e2718a]">{error}</p>}

      {preview && (
        <div className="mt-4 rounded-lg border border-white/[0.08] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-[#f8f8fc]/70">
              roleScore <strong className="text-[#f8f8fc]">{preview.roleScore.toFixed(0)}</strong>
            </span>
            <span className="text-[#f8f8fc]/70">
              Pontos <strong className="text-[#f8f8fc]">{preview.totalPointsUsed}/{preview.totalPointsAvailable}</strong>
            </span>
          </div>
          {preview.explanationData.prioritizedStats.length > 0 && (
            <p className="mb-3 text-xs text-[#f8f8fc]/45">
              Atributos priorizados: {preview.explanationData.prioritizedStats.join(', ')}
            </p>
          )}
          <Button isLoading={isSaving} onClick={handleSave}>
            Salvar essa build
          </Button>
        </div>
      )}
    </div>
  );
}
