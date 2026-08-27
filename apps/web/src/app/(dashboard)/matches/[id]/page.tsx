'use client';

import { useCallback, useEffect, useState } from 'react';
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
  Users,
} from 'lucide-react';
import { api, API_ORIGIN } from '../../../../lib/api';
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
  frameUrl: string | null;
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
  playerTeam: string | null;
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
  critical: { label: 'Crítico', className: 'bg-[#e2718a]/15 text-[#e2718a] border-[#e2718a]/30' },
  high: { label: 'Alto', className: 'bg-[#e0954a]/15 text-[#e0954a] border-orange-500/30' },
  medium: { label: 'Médio', className: 'bg-[#e0954a]/15 text-[#e0954a] border-yellow-500/30' },
  low: { label: 'Baixo', className: 'bg-white/[0.08] text-[#f8f8fc]/55 border-white/15' },
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
  if (score === null) return 'text-[#f8f8fc]/45';
  if (score >= 7) return 'text-[#6fcf97]';
  if (score >= 5) return 'text-[#e0954a]';
  return 'text-[#e2718a]';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    analyzed: { label: 'Analisado', icon: CheckCircle2, className: 'bg-[#6fcf97]/15 text-[#6fcf97]' },
    processing: { label: 'Processando', icon: Zap, className: 'bg-[#e0954a]/15 text-[#e0954a]' },
    pending: { label: 'Aguardando', icon: Clock, className: 'bg-white/[0.08] text-[#f8f8fc]/55' },
    failed: { label: 'Falha', icon: XCircle, className: 'bg-[#e2718a]/15 text-[#e2718a]' },
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
    <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-4 text-center">
      <Icon className="mx-auto mb-2 h-4 w-4 text-[#f8f8fc]/45" />
      <p className="mb-1 text-xs text-[#f8f8fc]/45">{label}</p>
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
    <div className={cn('overflow-hidden rounded-lg border', cfg.className)}>
      {error.frameUrl && (
        <a href={`${API_ORIGIN}${error.frameUrl}`} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem servida direto pela API, fora do domínio otimizado pelo next/image */}
          <img
            src={`${API_ORIGIN}${error.frameUrl}`}
            alt={`Frame do lance: ${error.description}`}
            className="aspect-video w-full object-cover"
          />
        </a>
      )}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
          <span className="shrink-0 text-xs font-medium">{cfg.label}</span>
        </div>
        <p className="mb-2 text-sm text-[#f8f8fc]/80">{error.description}</p>
        {error.suggestion && (
          <p className="text-xs text-[#f8f8fc]/45">
            <span className="font-medium text-[#f8f8fc]/55">→ </span>
            {error.suggestion}
          </p>
        )}
      </div>
    </div>
  );
}

function EventItem({ event }: { event: GameEvent }) {
  const label = CATEGORY_LABELS[event.category] ?? event.category;
  const Icon = CATEGORY_ICONS[event.category] ?? Gamepad2;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#f8f8fc]/45">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="mt-1 w-px flex-1 bg-white/[0.06]" />
      </div>
      <div className="pb-4 pt-0.5">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="font-mono text-xs text-[#f8f8fc]/45">
            {formatTimestamp(event.timestampStart)}
          </span>
          <span className="text-xs font-medium text-[#f8f8fc]/55">{label}</span>
        </div>
        {event.description && (
          <p className="text-xs text-[#f8f8fc]/35">{event.description}</p>
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

  const fetchMatch = useCallback(async () => {
    const [matchRes, reportRes] = await Promise.allSettled([
      api.get<MatchDetail>(`/matches/${matchId}`),
      api.get<MatchReport>(`/matches/${matchId}/report`),
    ]);
    if (matchRes.status === 'fulfilled') {
      setMatch(matchRes.value);
    } else {
      setFetchError('Partida não encontrada.');
    }
    if (reportRes.status === 'fulfilled') {
      setReportData(reportRes.value);
    }
  }, [matchId]);

  useEffect(() => {
    let cancelled = false;
    fetchMatch().finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [fetchMatch]);

  // A análise roda em background (BullMQ) — sem isso, quem abre a tela enquanto ainda
  // está "Aguardando"/"Processando" fica preso vendo o status antigo até dar F5.
  useEffect(() => {
    if (!match || (match.status !== 'pending' && match.status !== 'processing')) return;
    const interval = setInterval(fetchMatch, 8_000);
    return () => clearInterval(interval);
  }, [match?.status, fetchMatch]);

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────

  if (fetchError || !match) {
    return (
      <div className="p-6">
        <Link href="/matches" className="mb-6 flex items-center gap-1.5 text-sm text-[#f8f8fc]/45 hover:text-[#f8f8fc]">
          <ArrowLeft className="h-4 w-4" />
          Minhas Partidas
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-[#e2718a]" />
          <p className="text-base font-medium text-[#f8f8fc]">
            {fetchError || 'Não foi possível carregar a partida'}
          </p>
          <Link href="/matches" className="mt-3 text-sm text-gold-bright hover:text-gold">
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
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#f8f8fc]/45 transition-colors hover:text-[#f8f8fc]"
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
              <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-[#f8f8fc]/55">
                <Gamepad2 className="h-3 w-3" />
                {match.gameMode}
              </span>
            )}
            {match.playerTeam && (
              <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-[#f8f8fc]/55">
                <Users className="h-3 w-3" />
                {match.playerTeam}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">
            {match.title ?? 'Partida sem título'}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#f8f8fc]/45">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {formatDate(match.matchDate, match.createdAt)}
          </p>
        </div>

        {/* Score */}
        <div className="text-right">
          <p className="mb-0.5 text-xs text-[#f8f8fc]/45">Placar</p>
          <p className="text-4xl font-bold tabular-nums text-[#f8f8fc]">
            {hasScore ? `${match.scoreUser} × ${match.scoreOpponent}` : '— × —'}
          </p>
        </div>
      </div>

      {/* ── Not analyzed guard ──────────────────────────────────────────────── */}
      {!isAnalyzed && (
        <div className="mb-8 rounded-xl border border-[#e0954a]/20 bg-[#e0954a]/5 p-6 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-[#e0954a]" />
          <p className="font-medium text-[#f8f8fc]">
            {match.status === 'processing'
              ? 'Análise em andamento'
              : match.status === 'failed'
                ? 'Análise falhou'
                : 'Aguardando processamento'}
          </p>
          <p className="mt-1 text-sm text-[#f8f8fc]/45">
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
          <div className="mb-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl px-6 py-5">
            <div>
              <p className="text-sm text-[#f8f8fc]/45">Nota Geral</p>
              <p className={cn('text-5xl font-bold', scoreColor(report.overallScore))}>
                {report.overallScore !== null ? report.overallScore.toFixed(1) : '—'}
              </p>
            </div>
            <Star className="h-10 w-10 text-white/35" />
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
        <div className="mb-6 rounded-xl border border-gold/20 bg-gold/5 p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold-bright">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gold">Resumo do Coach IA</p>
              {aiModel && (
                <p className="text-xs text-[#f8f8fc]/35">via {aiModel}</p>
              )}
            </div>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#f8f8fc]/80">{aiSummary}</p>
        </div>
      )}

      {/* ── Errors + Events grid ────────────────────────────────────────────── */}
      {isAnalyzed && (
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Detected errors */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#f8f8fc]/55">
              <AlertTriangle className="h-4 w-4" />
              Erros Detectados
              {sortedErrors.length > 0 && (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-[#f8f8fc]/45">
                  {sortedErrors.length}
                </span>
              )}
            </h2>
            {sortedErrors.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-[#6fcf97]" />
                <p className="text-sm text-[#f8f8fc]/45">Nenhum erro detectado</p>
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
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#f8f8fc]/55">
              <Clock className="h-4 w-4" />
              Lances da Partida
              {match.gameEvents.length > 0 && (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-[#f8f8fc]/45">
                  {match.gameEvents.length}
                </span>
              )}
            </h2>
            {visibleEvents.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-6 text-center">
                <p className="text-sm text-[#f8f8fc]/45">Nenhum lance registrado</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-4">
                {visibleEvents.map((event, index) => (
                  <div key={event.id} className={index === visibleEvents.length - 1 ? '[&_.divider]:hidden' : ''}>
                    <EventItem event={event} />
                  </div>
                ))}
                {match.gameEvents.length > 15 && (
                  <p className="mt-1 text-center text-xs text-[#f8f8fc]/35">
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
        <div className="mb-6 rounded-xl border border-[#6fcf97]/20 bg-[#6fcf97]/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#6fcf97]">
            <CheckCircle2 className="h-4 w-4" />
            Pontos Positivos
          </h2>
          <div className="flex flex-wrap gap-2">
            {positiveCategories.map((c) => (
              <div
                key={c.label}
                className="flex items-center gap-2 rounded-lg border border-[#6fcf97]/20 bg-[#6fcf97]/10 px-3 py-2"
              >
                <span className="text-sm font-medium text-[#6fcf97]">{c.label}</span>
                <span className="text-sm font-bold text-[#6fcf97]">{c.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── O que Treinar ───────────────────────────────────────────────────── */}
      {isAnalyzed && trainingTip && (
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#f8f8fc]/55">
            <BookOpen className="h-4 w-4" />
            O que Treinar
          </h2>
          {report?.mainProblem && (
            <p className="mb-2 text-xs text-[#f8f8fc]/35">
              Foco: <span className="font-medium text-[#f8f8fc]/55">
                {CATEGORY_LABELS[report.mainProblem] ?? report.mainProblem}
              </span>
            </p>
          )}
          <p className="text-sm leading-relaxed text-[#f8f8fc]/80">{trainingTip}</p>
        </div>
      )}
    </div>
  );
}
