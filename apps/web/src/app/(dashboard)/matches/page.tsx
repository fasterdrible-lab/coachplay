'use client';

import { useEffect, useState } from 'react';
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
  pending: { label: 'Aguardando', icon: Clock, className: 'bg-gray-700 text-gray-300' },
  processing: { label: 'Processando', icon: Zap, className: 'bg-yellow-500/15 text-yellow-400' },
  analyzed: { label: 'Analisado', icon: CheckCircle2, className: 'bg-green-500/15 text-green-400' },
  failed: { label: 'Falha', icon: XCircle, className: 'bg-red-500/15 text-red-400' },
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

function MatchCard({ match }: { match: Match }) {
  const hasScore = match.scoreUser !== null && match.scoreOpponent !== null;
  const overallScore = match.report?.overallScore ?? null;

  return (
    <div className="flex flex-col rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {match.title ?? 'Partida sem título'}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {formatDate(match.matchDate, match.createdAt)}
          </p>
        </div>
        <StatusBadge status={match.status} />
      </div>

      {/* Score */}
      <div className="flex flex-1 items-end justify-between">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-white">
          {hasScore ? `${match.scoreUser} × ${match.scoreOpponent}` : '— × —'}
        </span>

        {overallScore !== null ? (
          <div className="text-right">
            <p className="text-xs text-gray-500">Nota</p>
            <p
              className={cn(
                'text-xl font-bold',
                overallScore >= 7
                  ? 'text-green-400'
                  : overallScore >= 5
                    ? 'text-yellow-400'
                    : 'text-red-400',
              )}
            >
              {overallScore.toFixed(1)}
            </p>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-800 pt-3">
        {match.gameMode ? (
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <Gamepad2 className="h-3 w-3" />
            {match.gameMode}
          </span>
        ) : (
          <span />
        )}
        <Link
          href={`/matches/${match.id}`}
          aria-disabled={match.status !== 'analyzed'}
          className={cn(
            'text-xs font-medium transition-colors',
            match.status === 'analyzed'
              ? 'text-blue-400 hover:text-blue-300'
              : 'pointer-events-none text-gray-600',
          )}
        >
          Ver análise →
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800">
        <Gamepad2 className="h-8 w-8 text-gray-600" />
      </div>
      {hasFilters ? (
        <>
          <p className="mb-1 text-base font-medium text-white">Nenhuma partida encontrada</p>
          <p className="text-sm text-gray-500">Tente outros termos ou limpe os filtros</p>
        </>
      ) : (
        <>
          <p className="mb-1 text-base font-medium text-white">Nenhuma partida ainda</p>
          <p className="mb-6 text-sm text-gray-500">
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

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  // Fetch matches
  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError('');

    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);

    api
      .get<MatchesResponse>(`/matches?${params.toString()}`)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError('Não foi possível carregar as partidas.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [page, debouncedSearch, statusFilter, retryKey]);

  const hasFilters = !!debouncedSearch || !!statusFilter;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Minhas Partidas</h1>
          {data && !isLoading && (
            <p className="mt-0.5 text-sm text-gray-500">
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-3 pr-9 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-auto"
          >
            <option value="">Todos os status</option>
            <option value="pending">Aguardando</option>
            <option value="processing">Processando</option>
            <option value="analyzed">Analisado</option>
            <option value="failed">Falha</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="ml-auto text-xs text-red-400 underline hover:text-red-300"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
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
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-gray-800 pt-5">
              <p className="text-sm text-gray-500">
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
