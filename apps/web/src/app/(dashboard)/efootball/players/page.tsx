'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2, Plus, Scan, Search, Star, Users2, X } from 'lucide-react';
import { api } from '../../../../lib/api';
import { getToken } from '../../../../lib/auth';
import { getEfootballGameId } from '../../../../lib/efootball';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerCardSummary {
  id: string;
  cardType: string;
  overallBase: number;
  position: string;
}

interface PlayerWithCards {
  id: string;
  name: string;
  cards: PlayerCardSummary[];
}

interface UserPlayer {
  id: string;
  currentLevel: number;
  favoritePosition: string | null;
  isFavorite: boolean;
  playerCard: { id: string; position: string; overallBase: number; cardType: string; player: { name: string } };
}

interface ScanCandidate {
  playerCardId: string;
  playerId: string;
  playerName: string;
  cardType: string;
  overallBase: number;
  score: number;
}

interface ScanResult {
  status: 'AUTO_IDENTIFIED' | 'NEEDS_CONFIRMATION' | 'NEEDS_NEW_IMAGE' | 'INVALID_IMAGE';
  confidence: number;
  matchedPlayerCardId?: string;
  candidates: ScanCandidate[];
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function scanCardImage(gameId: string, file: File): Promise<ScanResult> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('gameId', gameId);

  const token = getToken();
  const res = await fetch(`${BASE_URL}/player-scanner/scan`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Erro ao escanear a imagem.' }));
    throw new Error(error.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [players, setPlayers] = useState<UserPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fetchPlayers = useCallback(async () => {
    try {
      const data = await api.get<UserPlayer[]>('/user-players');
      setPlayers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar seu elenco.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    getEfootballGameId()
      .then(setGameId)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar o jogo.'));
    fetchPlayers();
  }, [fetchPlayers]);

  const handleAdded = () => {
    setShowAdd(false);
    fetchPlayers();
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">Meus Jogadores</h1>
          <p className="text-sm text-[#f8f8fc]/45">Seu elenco de cartas do eFootball</p>
        </div>
        <Button onClick={() => setShowAdd((v) => !v)}>
          <Plus className="h-4 w-4" />
          Adicionar jogador
        </Button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/20 bg-[#e2718a]/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{error}</p>
        </div>
      )}

      {showAdd && gameId && (
        <AddPlayerPanel gameId={gameId} onAdded={handleAdded} onClose={() => setShowAdd(false)} />
      )}

      {players.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl py-16 text-center">
          <Users2 className="mb-3 h-8 w-8 text-[#f8f8fc]/25" />
          <p className="mb-4 text-sm text-[#f8f8fc]/55">Seu elenco ainda está vazio.</p>
          <Button onClick={() => setShowAdd(true)}>Adicionar primeiro jogador</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((up) => (
            <Link
              key={up.id}
              href={`/efootball/players/${up.id}`}
              className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-4 transition-colors hover:bg-white/[0.04]"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs font-medium text-[#f8f8fc]/70">
                  {up.playerCard.position}
                </span>
                {up.isFavorite && <Star className="h-4 w-4 fill-gold text-gold" />}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[#f8f8fc]">{up.playerCard.player.name}</h3>
              <p className="text-xs text-[#f8f8fc]/45">
                Overall {up.playerCard.overallBase} · Nível {up.currentLevel} · {up.playerCard.cardType}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add player panel ────────────────────────────────────────────────────────

function AddPlayerPanel({ gameId, onAdded, onClose }: { gameId: string; onAdded: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<'search' | 'scan'>('search');

  return (
    <div className="mb-6 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('search')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'search' ? 'bg-gold/15 text-gold-bright' : 'text-white/55 hover:bg-white/[0.06]',
            )}
          >
            <Search className="mr-1.5 inline h-3.5 w-3.5" />
            Buscar por nome
          </button>
          <button
            onClick={() => setMode('scan')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'scan' ? 'bg-gold/15 text-gold-bright' : 'text-white/55 hover:bg-white/[0.06]',
            )}
          >
            <Scan className="mr-1.5 inline h-3.5 w-3.5" />
            Escanear carta
          </button>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white/70">
          <X className="h-4 w-4" />
        </button>
      </div>

      {mode === 'search' ? <SearchAddForm gameId={gameId} onAdded={onAdded} /> : <ScanAddForm gameId={gameId} onAdded={onAdded} />}
    </div>
  );
}

function SearchAddForm({ gameId, onAdded }: { gameId: string; onAdded: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithCards | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setError(null);
    setSelectedPlayer(null);
    try {
      const data = await api.get<{ id: string; name: string }[]>(
        `/players?query=${encodeURIComponent(query)}&gameId=${gameId}`,
      );
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na busca.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlayer = async (id: string) => {
    try {
      const player = await api.get<PlayerWithCards>(`/players/${id}`);
      setSelectedPlayer(player);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cartas do jogador.');
    }
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <Input
          placeholder="Nome do jogador..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="secondary" isLoading={isSearching} onClick={handleSearch}>
          Buscar
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-[#e2718a]">{error}</p>}

      {!selectedPlayer && results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectPlayer(p.id)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#f8f8fc]/80 hover:bg-white/[0.06]"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {!selectedPlayer && results.length === 0 && query && !isSearching && (
        <p className="text-sm text-[#f8f8fc]/45">Nenhum jogador encontrado com esse nome.</p>
      )}

      {selectedPlayer && (
        <CardPicker
          playerName={selectedPlayer.name}
          cards={selectedPlayer.cards}
          onAdded={onAdded}
          onBack={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

function CardPicker({
  playerName,
  cards,
  onAdded,
  onBack,
}: {
  playerName: string;
  cards: PlayerCardSummary[];
  onAdded: () => void;
  onBack: () => void;
}) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? '');
  const [level, setLevel] = useState('1');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await api.post('/user-players', { playerCardId: cardId, currentLevel: Number(level) || 1 });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar esse jogador.');
    } finally {
      setIsSaving(false);
    }
  };

  if (cards.length === 0) {
    return <p className="text-sm text-[#f8f8fc]/45">{playerName} não tem nenhuma carta cadastrada.</p>;
  }

  return (
    <div className="rounded-lg border border-white/[0.08] p-3">
      <p className="mb-2 text-sm font-medium text-[#f8f8fc]">{playerName}</p>
      <div className="mb-3 space-y-1.5">
        {cards.map((c) => (
          <label
            key={c.id}
            className={cn(
              'flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm',
              cardId === c.id ? 'border-gold/50 bg-gold/5' : 'border-white/[0.08]',
            )}
          >
            <span className="flex items-center gap-2">
              <input type="radio" checked={cardId === c.id} onChange={() => setCardId(c.id)} className="accent-gold" />
              {c.cardType} · {c.position}
            </span>
            <span className="font-semibold text-[#f8f8fc]/80">{c.overallBase}</span>
          </label>
        ))}
      </div>
      <div className="mb-3 flex items-end gap-2">
        <Input label="Nível" type="number" min={1} value={level} onChange={(e) => setLevel(e.target.value)} className="w-24" />
      </div>
      {error && <p className="mb-2 text-sm text-[#e2718a]">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <Button isLoading={isSaving} onClick={handleAdd}>
          Adicionar ao elenco
        </Button>
      </div>
    </div>
  );
}

function ScanAddForm({ gameId, onAdded }: { gameId: string; onAdded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setIsScanning(true);
    setError(null);
    setResult(null);
    try {
      const data = await scanCardImage(gameId, file);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível escanear a imagem.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={isScanning}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 py-8 text-center hover:border-gold/40 disabled:opacity-50"
      >
        {isScanning ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#f8f8fc]/45" />
        ) : (
          <Scan className="h-6 w-6 text-[#f8f8fc]/45" />
        )}
        <span className="text-sm text-[#f8f8fc]/55">
          {isScanning ? 'Analisando imagem...' : 'Clique pra escolher um print da carta'}
        </span>
      </button>

      {error && <p className="mt-3 text-sm text-[#e2718a]">{error}</p>}

      {result && result.status === 'INVALID_IMAGE' && (
        <p className="mt-3 text-sm text-[#e2718a]">Imagem inválida — tente outro print.</p>
      )}

      {result && result.candidates.length === 0 && result.status !== 'INVALID_IMAGE' && (
        <p className="mt-3 text-sm text-[#f8f8fc]/45">Não encontramos nenhuma carta parecida com essa imagem.</p>
      )}

      {result && result.candidates.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-[#f8f8fc]/45">
            {result.status === 'AUTO_IDENTIFIED' ? 'Identificado automaticamente:' : 'Confirme qual carta é essa:'}
          </p>
          {result.candidates.map((c) => (
            <ScanCandidateRow key={c.playerCardId} candidate={c} onAdded={onAdded} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScanCandidateRow({ candidate, onAdded }: { candidate: ScanCandidate; onAdded: () => void }) {
  const [level, setLevel] = useState('1');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await api.post('/user-players', { playerCardId: candidate.playerCardId, currentLevel: Number(level) || 1 });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível adicionar esse jogador.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/[0.08] p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-[#f8f8fc]/85">
          {candidate.playerName} · {candidate.cardType}
        </span>
        <span className="font-semibold text-[#f8f8fc]/80">{candidate.overallBase}</span>
      </div>
      <div className="flex items-end gap-2">
        <Input label="Nível" type="number" min={1} value={level} onChange={(e) => setLevel(e.target.value)} className="w-24" />
        <Button isLoading={isSaving} onClick={handleAdd}>
          Adicionar
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-[#e2718a]">{error}</p>}
    </div>
  );
}
