'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Star,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Gamepad2,
  CalendarDays,
  Target,
  ChevronRight,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../providers/auth-provider';
import { cn } from '../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryData {
  totalAnalyzed: number;
  avgOverallScore: number | null;
  bestCategory: string | null;
  worstCategory: string | null;
  mostFrequentError: string | null;
  categoryAvgScores: {
    attack: number | null;
    defense: number | null;
    passing: number | null;
    decision: number | null;
  } | null;
}

interface EvolutionEntry {
  matchId: string;
  title: string | null;
  matchDate: string | null;
  createdAt: string;
  overallScore: number | null;
}

interface LatestMatch {
  id: string;
  title: string | null;
  gameMode: string | null;
  matchDate: string | null;
  createdAt: string;
  scoreUser: number | null;
  scoreOpponent: number | null;
  status: string;
  report: { overallScore: number | null } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  // keys from summary.worstCategory / bestCategory
  attack: 'Ataque',
  defense: 'Defesa',
  passing: 'Passe',
  decision: 'Decisão',
  // keys from DetectedError.category
  ataque: 'Ataque',
  defesa: 'Defesa',
  passe: 'Passe',
  decisao: 'Decisão',
  posicionamento: 'Posicionamento',
  finalizacao: 'Finalização',
};

const TRAINING_TIPS: Record<string, { focus: string; tip: string }> = {
  defense: {
    focus: 'Defesa',
    tip: 'Trabalhe o posicionamento defensivo: pratique o modo 1v1 e revise replays de jogadas defensivas para identificar os padrões de erro mais recorrentes.',
  },
  attack: {
    focus: 'Ataque',
    tip: 'Melhore suas finalizações: treine o modo Habilidades com foco em chutes de dentro e fora da área, variando potência e colocação.',
  },
  passing: {
    focus: 'Passe',
    tip: 'Foque na precisão de passe: jogue o modo Treinamento e pratique saídas de bola curtas, lançamentos em profundidade e transições rápidas.',
  },
  decision: {
    focus: 'Decisão',
    tip: 'Aprimore a tomada de decisão: analise seus replays e identifique os momentos em que deveria ter passado em vez de driblado — e vice-versa.',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatDate(iso: string | null, fallback: string): string {
  return new Date(iso ?? fallback).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 7) return 'text-green-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

function computeWeeklyDelta(entries: EvolutionEntry[]): number | null {
  if (entries.length < 2) return null;
  const first = entries[0].overallScore;
  const last = entries[entries.length - 1].overallScore;
  if (first === null || last === null) return null;
  return Math.round((last - first) * 10) / 10;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  iconClassName: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
}

function StatCard({ icon: Icon, iconClassName, label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconClassName)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
      <div className="text-2xl font-bold leading-none text-white">{value}</div>
      {sub && <p className="mt-1.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ─── Latest Match Card ────────────────────────────────────────────────────────

function LatestMatchCard({ match }: { match: LatestMatch | null }) {
  if (!match) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-400">Última Partida</h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800">
            <Gamepad2 className="h-6 w-6 text-gray-600" />
          </div>
          <p className="mb-3 text-sm text-gray-500">Nenhuma partida registrada ainda</p>
          <Link
            href="/matches/new"
            className="text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            Criar primeira partida →
          </Link>
        </div>
      </div>
    );
  }

  const hasScore = match.scoreUser !== null && match.scoreOpponent !== null;
  const overallScore = match.report?.overallScore ?? null;

  const statusConfig: Record<string, { label: string; className: string }> = {
    analyzed: { label: 'Analisado', className: 'bg-green-500/15 text-green-400' },
    processing: { label: 'Processando', className: 'bg-yellow-500/15 text-yellow-400' },
    failed: { label: 'Falha', className: 'bg-red-500/15 text-red-400' },
    pending: { label: 'Aguardando', className: 'bg-gray-700 text-gray-400' },
  };
  const cfg = statusConfig[match.status] ?? statusConfig.pending;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400">Última Partida</h2>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', cfg.className)}>
          {cfg.label}
        </span>
      </div>

      <p className="mb-1 text-base font-semibold text-white">
        {match.title ?? 'Partida sem título'}
      </p>
      <p className="mb-5 flex items-center gap-1.5 text-xs text-gray-500">
        <CalendarDays className="h-3 w-3 shrink-0" />
        {formatDate(match.matchDate, match.createdAt)}
        {match.gameMode ? ` · ${match.gameMode}` : ''}
      </p>

      <div className="flex items-end justify-between">
        <div>
          <p className="mb-0.5 text-xs text-gray-500">Placar</p>
          <p className="text-3xl font-bold tabular-nums text-white">
            {hasScore ? `${match.scoreUser} × ${match.scoreOpponent}` : '— × —'}
          </p>
        </div>
        {overallScore !== null && (
          <div className="text-right">
            <p className="mb-0.5 text-xs text-gray-500">Nota</p>
            <p className={cn('text-3xl font-bold', scoreColor(overallScore))}>
              {overallScore.toFixed(1)}
            </p>
          </div>
        )}
      </div>

      {match.status === 'analyzed' && (
        <div className="mt-4 border-t border-gray-800 pt-3 text-right">
          <Link
            href={`/matches/${match.id}`}
            className="text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            Ver análise completa →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Training Recommendation Card ─────────────────────────────────────────────

function TrainingCard({ worstCategory }: { worstCategory: string | null }) {
  const tipData = worstCategory ? (TRAINING_TIPS[worstCategory] ?? null) : null;

  if (!tipData) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-400">Recomendação de Treino</h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800">
            <BookOpen className="h-6 w-6 text-gray-600" />
          </div>
          <p className="text-sm text-gray-500">
            Analise partidas para receber recomendações personalizadas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-400">Recomendação de Treino</h2>

      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-gray-500">Área de foco</p>
          <p className="text-sm font-semibold text-blue-400">{tipData.focus}</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-gray-300">{tipData.tip}</p>

      <div className="mt-4 border-t border-blue-500/20 pt-3">
        <Link
          href="/matches"
          className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          Ver todas as partidas
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [evolution7d, setEvolution7d] = useState<EvolutionEntry[]>([]);
  const [latestMatch, setLatestMatch] = useState<LatestMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<SummaryData>('/reports/summary'),
      api.get<{ days: number; data: EvolutionEntry[] }>('/reports/evolution?days=7'),
      api.get<{ data: LatestMatch[]; total: number }>('/matches?limit=1'),
    ])
      .then(([summaryRes, evolutionRes, matchesRes]) => {
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
        if (evolutionRes.status === 'fulfilled') setEvolution7d(evolutionRes.value.data);
        if (matchesRes.status === 'fulfilled') setLatestMatch(matchesRes.value.data[0] ?? null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ─── Derived values ──────────────────────────────────────────────────────────

  const delta = computeWeeklyDelta(evolution7d);
  const weekCount = evolution7d.length;

  const weeklyValue: React.ReactNode = (() => {
    if (weekCount === 0) return <span className="text-gray-500">—</span>;
    if (delta === null) return <span>{weekCount}</span>;
    if (delta > 0)
      return <span className="text-green-400">+{delta.toFixed(1)}</span>;
    if (delta < 0)
      return <span className="text-red-400">{delta.toFixed(1)}</span>;
    return <span className="text-gray-400">0.0</span>;
  })();

  const weeklyIcon =
    delta !== null && delta > 0
      ? TrendingUp
      : delta !== null && delta < 0
        ? TrendingDown
        : Minus;

  const avgScoreIconClass = (() => {
    const s = summary?.avgOverallScore;
    if (s === null || s === undefined) return 'bg-gray-700 text-gray-500';
    if (s >= 7) return 'bg-green-500/15 text-green-400';
    if (s >= 5) return 'bg-yellow-500/15 text-yellow-400';
    return 'bg-red-500/15 text-red-400';
  })();

  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const firstName = user?.name?.split(' ')[0] ?? '';

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {greeting()}{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="mt-1 text-sm capitalize text-gray-500">{todayFormatted}</p>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Trophy}
          iconClassName="bg-blue-500/15 text-blue-400"
          label="Partidas Analisadas"
          value={summary?.totalAnalyzed ?? 0}
          sub="total acumulado"
        />
        <StatCard
          icon={Star}
          iconClassName={avgScoreIconClass}
          label="Nota Média"
          value={
            summary?.avgOverallScore != null
              ? <span className={scoreColor(summary.avgOverallScore)}>
                  {summary.avgOverallScore.toFixed(1)}
                </span>
              : <span className="text-gray-500">—</span>
          }
          sub="em todas as partidas"
        />
        <StatCard
          icon={AlertTriangle}
          iconClassName="bg-orange-500/15 text-orange-400"
          label="Erro Mais Frequente"
          value={
            summary?.mostFrequentError
              ? CATEGORY_LABELS[summary.mostFrequentError] ?? summary.mostFrequentError
              : <span className="text-gray-500">—</span>
          }
          sub={summary?.mostFrequentError ? 'categoria mais recorrente' : 'sem dados ainda'}
        />
        <StatCard
          icon={weeklyIcon}
          iconClassName="bg-purple-500/15 text-purple-400"
          label="Evolução Semanal"
          value={weeklyValue}
          sub={
            weekCount === 0
              ? 'sem partidas esta semana'
              : `${weekCount} partida${weekCount !== 1 ? 's' : ''} nos últimos 7 dias`
          }
        />
      </div>

      {/* Latest match + training recommendation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LatestMatchCard match={latestMatch} />
        <TrainingCard worstCategory={summary?.worstCategory ?? null} />
      </div>
    </div>
  );
}
