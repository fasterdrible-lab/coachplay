'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Gamepad2,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  XCircle,
  Bot,
  Swords,
  Shield,
  Shuffle,
  Brain,
  BookOpen,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface GameEvent {
  id: string;
  eventType: string;
  category: string;
  timestampStart: number;
  timestampEnd: number | null;
  description: string | null;
  confidence: number | null;
}

interface DetectedError {
  id: string;
  errorType: string;
  category: string;
  severity: Severity;
  description: string;
  suggestion: string | null;
}

interface ReportScores {
  overallScore: number | null;
  attackScore: number | null;
  defenseScore: number | null;
  passingScore: number | null;
  decisionScore: number | null;
  mainProblem: string | null;
  recommendation: string | null;
}

interface MatchDetail {
  id: string;
  title: string | null;
  gameMode: string | null;
  platform: string;
  matchDate: string | null;
  scoreUser: number | null;
  scoreOpponent: number | null;
  status: string;
  createdAt: string;
  gameEvents: GameEvent[];
  errors: DetectedError[];
  report: ReportScores | null;
}

interface MatchReport {
  matchId: string;
  title: string | null;
  aiSummary: string | null;
  aiModel: string | null;
  report: ReportScores | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  ataque: 'Ataque',
  defesa: 'Defesa',
  passe: 'Passe',
  decisao: 'Decisão',
  posicionamento: 'Posicionamento',
  finalizacao: 'Finalização',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ataque: Swords,
  finalizacao: Swords,
  defesa: Shield,
  passe: Shuffle,
  decisao: Brain,
  posicionamento: Brain,
};

const SEVERITY_CONFIG: Record<Severity, { label: string; className: string }> = {
  critical: { label: 'Crítico', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  high: { label: 'Alto', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  medium: { label: 'Médio', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  low: { label: 'Baixo', className: 'bg-gray-700 text-gray-400 border-gray-600' },
};

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

const TRAINING_TIPS: Record<string, string> = {
  defesa: 'Trabalhe o posicionamento defensivo: pratique o modo 1v1 e revise replays de jogadas defensivas.',
  ataque: 'Melhore suas finalizações: treine o modo Habilidades com foco em chutes de dentro e fora da área.',
  passe: 'Foque na precisão de passe: jogue o modo Treinamento e pratique saídas de bola curtas e transições.',
  decisao: 'Aprimore a tomada de decisão: analise seus replays e identifique quando passar vs. driblar.',
  posicionamento: 'Trabalhe o posicionamento: pratique Ataque Posicional e estude as linhas defensivas adversárias.',
  finalizacao: 'Pratique finalizações com diferentes jogadores no modo Habilidades, variando potência e colocação.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string | null, fallback: string): string {
  return new Date(iso ?? fallback).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-500';
  if (score >= 7) return 'text-green-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    analyzed: { label: 'Analisado', icon: CheckCircle2, className: 'bg-green-500/15 text-green-400' },
    processing: { label: 'Processando', icon: Zap, className: 'bg-yellow-500/15 text-yellow-400' },
    pending: { label: 'Aguardando', icon: Clock, className: 'bg-gray-700 text-gray-400' },
    failed: { label: 'Falha', icon: XCircle, className: 'bg-red-500/15 text-red-400' },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', c.className)}>
      <c.icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function CategoryScoreCard({ label, score, icon: Icon }: { label: string; score: number | null; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
      <Icon className="mx-auto mb-2 h-4 w-4 text-gray-500" />
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <p className={cn('text-xl font-bold', scoreColor(score))}>
        {score !== null ? score.toFixed(1) : '—'}
      </p>
    </div>
  );
}

function ErrorItem({ error }: { error: DetectedError }) {
  const cfg = SEVERITY_CONFIG[error.severity] ?? SEVERITY_CONFIG.low;
  const label = CATEGORY_LABELS[error.category] ?? error.category;
  return (
    <div className={cn('rounded-lg border p-4', cfg.className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <span className="shrink-0 text-xs font-medium">{cfg.label}</span>
      </div>
      <p className="mb-2 text-sm text-gray-300">{error.description}</p>
      {error.suggestion && (
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-400">→ </span>
          {error.suggestion}
        </p>
      )}
    </div>
  );
}

function EventItem({ event }: { event: GameEvent }) {
  const label = CATEGORY_LABELS[event.category] ?? event.category;
  const Icon = CATEGORY_ICONS[event.category] ?? Gamepad2;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-gray-500">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="mt-1 w-px flex-1 bg-gray-800" />
      </div>
      <div className="pb-4 pt-0.5">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="font-mono text-xs text-gray-500">
            {formatTimestamp(event.timestampStart)}
          </span>
          <span className="text-xs font-medium text-gray-400">{label}</span>
        </div>
        {event.description && (
          <p className="text-xs text-gray-600">{event.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchReportPage() {
  const params = useParams();
  const matchId = params.id as string;

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [reportData, setReportData] = useState<MatchReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      api.get<MatchDetail>(`/matches/${matchId}`),
      api.get<MatchReport>(`/matches/${matchId}/report`),
    ]).then(([matchRes, reportRes]) => {
      if (cancelled) return;
      if (matchRes.status === 'fulfilled') {
        setMatch(matchRes.value);
      } else {
        setFetchError('Partida não encontrada.');
      }
      if (reportRes.status === 'fulfilled') {
        setReportData(reportRes.value);
      }
    }).finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [matchId]);

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────

  if (fetchError || !match) {
    return (
      <div className="p-6">
        <Link href="/matches" className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Minhas Partidas
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="text-base font-medium text-white">
            {fetchError || 'Não foi possível carregar a partida'}
          </p>
          <Link href="/matches" className="mt-3 text-sm text-blue-400 hover:text-blue-300">
            Voltar para partidas
          </Link>
        </div>
      </div>
    );
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const report = reportData?.report ?? match.report;
  const aiSummary = reportData?.aiSummary ?? null;
  const aiModel = reportData?.aiModel ?? null;

  const hasScore = match.scoreUser !== null && match.scoreOpponent !== null;

  const sortedErrors = [...match.errors].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const positiveCategories = report
    ? [
        { label: 'Ataque', score: report.attackScore },
        { label: 'Defesa', score: report.defenseScore },
        { label: 'Passe', score: report.passingScore },
        { label: 'Decisão', score: report.decisionScore },
      ].filter((c): c is { label: string; score: number } => c.score !== null && c.score >= 7.0)
    : [];

  const trainingTip = report?.mainProblem ? TRAINING_TIPS[report.mainProblem] : null;

  const visibleEvents = match.gameEvents.slice(0, 15);

  // ─── Not analyzed state ──────────────────────────────────────────────────────

  const isAnalyzed = match.status === 'analyzed';

  return (
    <div className="p-6">
      {/* Back link */}
      <Link
        href="/matches"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Minhas Partidas
      </Link>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={match.status} />
            {match.gameMode && (
              <span className="flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-400">
                <Gamepad2 className="h-3 w-3" />
                {match.gameMode}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {match.title ?? 'Partida sem título'}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {formatDate(match.matchDate, match.createdAt)}
          </p>
        </div>

        {/* Score */}
        <div className="text-right">
          <p className="mb-0.5 text-xs text-gray-500">Placar</p>
          <p className="text-4xl font-bold tabular-nums text-white">
            {hasScore ? `${match.scoreUser} × ${match.scoreOpponent}` : '— × —'}
          </p>
        </div>
      </div>

      {/* ── Not analyzed guard ──────────────────────────────────────────────── */}
      {!isAnalyzed && (
        <div className="mb-8 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-yellow-400" />
          <p className="font-medium text-white">
            {match.status === 'processing'
              ? 'Análise em andamento'
              : match.status === 'failed'
                ? 'Análise falhou'
                : 'Aguardando processamento'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {match.status === 'processing'
              ? 'O vídeo está sendo processado. Volte em alguns minutos.'
              : match.status === 'failed'
                ? 'Houve um erro durante o processamento. Tente fazer o upload novamente.'
                : 'Faça o upload do vídeo para iniciar a análise.'}
          </p>
        </div>
      )}

      {/* ── Scores row (analyzed only) ──────────────────────────────────────── */}
      {isAnalyzed && report && (
        <div className="mb-6">
          {/* Overall score */}
          <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-6 py-5">
            <div>
              <p className="text-sm text-gray-500">Nota Geral</p>
              <p className={cn('text-5xl font-bold', scoreColor(report.overallScore))}>
                {report.overallScore !== null ? report.overallScore.toFixed(1) : '—'}
              </p>
            </div>
            <Star className="h-10 w-10 text-gray-700" />
          </div>

          {/* Category scores */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CategoryScoreCard label="Ataque" score={report.attackScore} icon={Swords} />
            <CategoryScoreCard label="Defesa" score={report.defenseScore} icon={Shield} />
            <CategoryScoreCard label="Passe" score={report.passingScore} icon={Shuffle} />
            <CategoryScoreCard label="Decisão" score={report.decisionScore} icon={Brain} />
          </div>
        </div>
      )}

      {/* ── AI Summary ─────────────────────────────────────────────────────── */}
      {isAnalyzed && aiSummary && (
        <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-300">Resumo do Coach IA</p>
              {aiModel && (
                <p className="text-xs text-gray-600">via {aiModel}</p>
              )}
            </div>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{aiSummary}</p>
        </div>
      )}

      {/* ── Errors + Events grid ────────────────────────────────────────────── */}
      {isAnalyzed && (
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Detected errors */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-400">
              <AlertTriangle className="h-4 w-4" />
              Erros Detectados
              {sortedErrors.length > 0 && (
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                  {sortedErrors.length}
                </span>
              )}
            </h2>
            {sortedErrors.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500" />
                <p className="text-sm text-gray-500">Nenhum erro detectado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedErrors.map((err) => (
                  <ErrorItem key={err.id} error={err} />
                ))}
              </div>
            )}
          </div>

          {/* Game events timeline */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-400">
              <Clock className="h-4 w-4" />
              Lances da Partida
              {match.gameEvents.length > 0 && (
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                  {match.gameEvents.length}
                </span>
              )}
            </h2>
            {visibleEvents.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
                <p className="text-sm text-gray-500">Nenhum lance registrado</p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                {visibleEvents.map((event, index) => (
                  <div key={event.id} className={index === visibleEvents.length - 1 ? '[&_.divider]:hidden' : ''}>
                    <EventItem event={event} />
                  </div>
                ))}
                {match.gameEvents.length > 15 && (
                  <p className="mt-1 text-center text-xs text-gray-600">
                    + {match.gameEvents.length - 15} lances não exibidos
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pontos Positivos ────────────────────────────────────────────────── */}
      {isAnalyzed && positiveCategories.length > 0 && (
        <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Pontos Positivos
          </h2>
          <div className="flex flex-wrap gap-2">
            {positiveCategories.map((c) => (
              <div
                key={c.label}
                className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2"
              >
                <span className="text-sm font-medium text-green-300">{c.label}</span>
                <span className="text-sm font-bold text-green-400">{c.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── O que Treinar ───────────────────────────────────────────────────── */}
      {isAnalyzed && trainingTip && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-400">
            <BookOpen className="h-4 w-4" />
            O que Treinar
          </h2>
          {report?.mainProblem && (
            <p className="mb-2 text-xs text-gray-600">
              Foco: <span className="font-medium text-gray-400">
                {CATEGORY_LABELS[report.mainProblem] ?? report.mainProblem}
              </span>
            </p>
          )}
          <p className="text-sm leading-relaxed text-gray-300">{trainingTip}</p>
        </div>
      )}
    </div>
  );
}
