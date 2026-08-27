'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Gamepad2,
  CalendarDays,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchStatus = 'pending' | 'processing' | 'analyzed' | 'failed';

interface Match {
  id: string;
  title: string | null;
  gameMode: string | null;
  platform: string;
  matchDate: string | null;
  scoreUser: number | null;
  scoreOpponent: number | null;
  status: MatchStatus;
  createdAt: string;
  video: { processingStatus: string } | null;
  report: { overallScore: number | null } | null;
}

interface MatchesResponse {
  data: Match[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MatchStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: { label: 'Aguardando', icon: Clock, className: 'bg-white/[0.08] text-[#f8f8fc]/80' },
  processing: { label: 'Processando', icon: Zap, className: 'bg-[#e0954a]/15 text-[#e0954a]' },
  analyzed: { label: 'Analisado', icon: CheckCircle2, className: 'bg-[#6fcf97]/15 text-[#6fcf97]' },
  failed: { label: 'Falha', icon: XCircle, className: 'bg-[#e2718a]/15 text-[#e2718a]' },
};

function formatDate(iso: string | null, fallback: string): string {
  return new Date(iso ?? fallback).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MatchStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        cfg.className,
      )}
    >
      <cfg.icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function MatchCard({
  match,
  isDeleting,
  onDelete,
}: {
  match: Match;
  isDeleting: boolean;
  onDelete: (match: Match) => void;
}) {
  const hasScore = match.scoreUser !== null && match.scoreOpponent !== null;
  const overallScore = match.report?.overallScore ?? null;

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5 transition-colors hover:border-white/10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#f8f8fc]">
            {match.title ?? 'Partida sem título'}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#f8f8fc]/45">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {formatDate(match.matchDate, match.createdAt)}
          </p>
        </div>
        <StatusBadge status={match.status} />
      </div>

      {/* Score */}
      <div className="flex flex-1 items-end justify-between">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-[#f8f8fc]">
          {hasScore ? `${match.scoreUser} × ${match.scoreOpponent}` : '— × —'}
        </span>

        {overallScore !== null ? (
          <div className="text-right">
            <p className="text-xs text-[#f8f8fc]/45">Nota</p>
            <p
              className={cn(
                'text-xl font-bold',
                overallScore >= 7
                  ? 'text-[#6fcf97]'
                  : overallScore >= 5
                    ? 'text-[#e0954a]'
                    : 'text-[#e2718a]',
              )}
            >
              {overallScore.toFixed(1)}
            </p>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3">
        {match.gameMode ? (
          <span className="flex items-center gap-1.5 text-xs text-[#f8f8fc]/45">
            <Gamepad2 className="h-3 w-3" />
            {match.gameMode}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onDelete(match)}
            disabled={isDeleting}
            aria-label="Excluir partida"
            className="text-[#f8f8fc]/35 transition-colors hover:text-[#e2718a] disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
          <Link
            href={`/matches/${match.id}`}
            aria-disabled={match.status !== 'analyzed'}
            className={cn(
              'text-xs font-medium transition-colors',
              match.status === 'analyzed'
                ? 'text-gold-bright hover:text-gold'
                : 'pointer-events-none text-[#f8f8fc]/35',
            )}
          >
            Ver análise →
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06]">
        <Gamepad2 className="h-8 w-8 text-[#f8f8fc]/35" />
      </div>
      {hasFilters ? (
        <>
          <p className="mb-1 text-base font-medium text-[#f8f8fc]">Nenhuma partida encontrada</p>
          <p className="text-sm text-[#f8f8fc]/45">Tente outros termos ou limpe os filtros</p>
        </>
      ) : (
        <>
          <p className="mb-1 text-base font-medium text-[#f8f8fc]">Nenhuma partida ainda</p>
          <p className="mb-6 text-sm text-[#f8f8fc]/45">
            Grave sua primeira partida e envie para análise
          </p>
          <Link href="/matches/new">
            <Button>
              <Plus className="h-4 w-4" />
              Nova partida
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const fetchMatches = useCallback(
    (opts: { showSpinner: boolean }) => {
      if (opts.showSpinner) setIsLoading(true);
      setError('');

      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);

      return api
        .get<MatchesResponse>(`/matches?${params.toString()}`)
        .then((res) => setData(res))
        .catch(() => setError('Não foi possível carregar as partidas.'))
        .finally(() => { if (opts.showSpinner) setIsLoading(false); });
    },
    [page, debouncedSearch, statusFilter],
  );

  // Fetch matches
  useEffect(() => {
    let cancelled = false;
    fetchMatches({ showSpinner: true }).then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [fetchMatches, retryKey]);

  // A análise roda em background — sem isso, uma partida "Aguardando"/"Processando" fica
  // com o status desatualizado até a pessoa dar F5.
  useEffect(() => {
    const hasPending = data?.data.some((m) => m.status === 'pending' || m.status === 'processing');
    if (!hasPending) return;
    const interval = setInterval(() => fetchMatches({ showSpinner: false }), 8_000);
    return () => clearInterval(interval);
  }, [data, fetchMatches]);

  const hasFilters = !!debouncedSearch || !!statusFilter;

  async function deleteMatch(match: Match) {
    if (!window.confirm(`Excluir "${match.title ?? 'Partida sem título'}"? Essa ação não pode ser desfeita.`)) {
      return;
    }

    setDeletingId(match.id);
    setActionError('');
    try {
      await api.delete(`/matches/${match.id}`);
      setData((prev) =>
        prev
          ? { ...prev, data: prev.data.filter((m) => m.id !== match.id), total: prev.total - 1 }
          : prev,
      );
    } catch {
      setActionError('Não foi possível excluir esta partida.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">Minhas Partidas</h1>
          {data && !isLoading && (
            <p className="mt-0.5 text-sm text-[#f8f8fc]/45">
              {data.total} {data.total === 1 ? 'partida' : 'partidas'}
            </p>
          )}
        </div>
        <Link href="/matches/new">
          <Button>
            <Plus className="h-4 w-4" />
            Nova partida
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f8f8fc]/45" />
          <input
            type="text"
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] py-2.5 pl-9 pr-4 text-sm text-[#f8f8fc] placeholder-white/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.06] py-2.5 pl-3 pr-9 text-sm text-[#f8f8fc] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 sm:w-auto"
          >
            <option value="">Todos os status</option>
            <option value="pending">Aguardando</option>
            <option value="processing">Processando</option>
            <option value="analyzed">Analisado</option>
            <option value="failed">Falha</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f8f8fc]/55" />
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{actionError}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{error}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="ml-auto text-xs text-[#e2718a] underline hover:text-red-300"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isDeleting={deletingId === match.id}
                  onDelete={deleteMatch}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-white/[0.08] pt-5">
              <p className="text-sm text-[#f8f8fc]/45">
                Página {data.page} de {data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === data.totalPages}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
