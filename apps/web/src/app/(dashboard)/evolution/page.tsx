'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Loader2,
  Plus,
  Swords,
  Shield,
  Shuffle,
  Brain,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { cn } from '../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvolutionEntry {
  matchId: string;
  title: string | null;
  gameMode: string | null;
  matchDate: string | null;
  createdAt: string;
  overallScore: number | null;
  attackScore: number | null;
  defenseScore: number | null;
  passingScore: number | null;
  decisionScore: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return 'text-[#f8f8fc]/45';
  if (score >= 7) return 'text-[#6fcf97]';
  if (score >= 5) return 'text-[#e0954a]';
  return 'text-[#e2718a]';
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

function formatShortDate(iso: string | null, fallback: string): string {
  return new Date(iso ?? fallback).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

// ─── Score Chart (SVG) ────────────────────────────────────────────────────────

function ScoreChart({ entries }: { entries: EvolutionEntry[] }) {
  const W = 600;
  const H = 200;
  const padL = 34;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const n = entries.length;
  const xAt = (i: number) => padL + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
  const yAt = (score: number) =>
    padT + cH - (Math.max(0, Math.min(10, score)) / 10) * cH;

  const points = entries.map((e, i) => ({
    x: xAt(i),
    y: yAt(e.overallScore ?? 0),
    score: e.overallScore,
    date: formatShortDate(e.matchDate, e.createdAt),
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  const dotColor = (score: number | null) => {
    if (score === null) return '#6b7280';
    if (score >= 7) return '#22c55e';
    if (score >= 5) return '#eab308';
    return '#ef4444';
  };

  const showLabel = (i: number) => {
    if (n <= 5) return true;
    if (n <= 10) return i % 2 === 0;
    const step = Math.ceil(n / 6);
    return i === 0 || i === n - 1 || i % step === 0;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full overflow-visible"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Colour zones */}
      <rect x={padL} y={yAt(10)} width={cW} height={yAt(7) - yAt(10)} fill="#22c55e" opacity="0.05" />
      <rect x={padL} y={yAt(7)} width={cW} height={yAt(5) - yAt(7)} fill="#eab308" opacity="0.05" />
      <rect x={padL} y={yAt(5)} width={cW} height={yAt(0) - yAt(5)} fill="#ef4444" opacity="0.05" />

      {/* Grid lines */}
      {[2, 4, 6, 8, 10].map((s) => {
        const y = yAt(s);
        return (
          <g key={s}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1f2937" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="#4b5563" fontSize="10" fontFamily="ui-monospace,monospace">
              {s}
            </text>
          </g>
        );
      })}

      {/* Reference labels */}
      <text x={W - padR + 2} y={yAt(7) + 4} fill="#22c55e" fontSize="8" opacity="0.6">7</text>
      <text x={W - padR + 2} y={yAt(5) + 4} fill="#eab308" fontSize="8" opacity="0.6">5</text>

      {/* Polyline */}
      {n > 1 && (
        <polyline
          points={polyline}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Area fill */}
      {n > 1 && (
        <polyline
          points={`${padL},${padT + cH} ${polyline} ${padL + cW},${padT + cH}`}
          fill="url(#chartGrad)"
          opacity="0.15"
        />
      )}

      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={5}
          fill={dotColor(p.score)}
          stroke="#0f172a"
          strokeWidth="2"
        />
      ))}

      {/* Date labels */}
      {points.map((p, i) =>
        showLabel(i) ? (
          <text key={i} x={p.x} y={H - 4} textAnchor="middle" fill="#4b5563" fontSize="9">
            {p.date}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// ─── Category Progress Bar ────────────────────────────────────────────────────

function CategoryBar({
  label,
  score,
  icon: Icon,
  rank,
}: {
  label: string;
  score: number | null;
  icon: React.ElementType;
  rank: number;
}) {
  const pct = score !== null ? (score / 10) * 100 : 0;
  const barColor =
    score === null
      ? 'bg-white/[0.08]'
      : score >= 7
        ? 'bg-[#6fcf97]'
        : score >= 5
          ? 'bg-[#e0954a]'
          : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <span className="w-4 shrink-0 text-center text-xs text-[#f8f8fc]/35">{rank}</span>
      <div className="flex w-24 shrink-0 items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#f8f8fc]/45" />
        <span className="text-sm text-[#f8f8fc]/55">{label}</span>
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('w-10 shrink-0 text-right font-mono text-sm font-medium', scoreColor(score))}>
        {score !== null ? score.toFixed(1) : '—'}
      </span>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  iconClass: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm text-[#f8f8fc]/55">{label}</p>
      </div>
      <div className="text-2xl font-bold leading-none text-[#f8f8fc]">{value}</div>
      {sub && <p className="mt-1.5 text-xs text-[#f8f8fc]/45">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EvolutionPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [entries, setEntries] = useState<EvolutionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const isFirst = isLoading;

    if (!isFirst) setIsRefetching(true);

    api
      .get<{ days: number; data: EvolutionEntry[] }>(`/reports/evolution?days=${days}`)
      .then((res) => { if (!cancelled) setEntries(res.data); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefetching(false);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // ─── Derived values ──────────────────────────────────────────────────────────

  const catAvg = {
    attack: avg(entries.map((e) => e.attackScore)),
    defense: avg(entries.map((e) => e.defenseScore)),
    passing: avg(entries.map((e) => e.passingScore)),
    decision: avg(entries.map((e) => e.decisionScore)),
  };

  const sortedCategories = [
    { label: 'Ataque', score: catAvg.attack, icon: Swords },
    { label: 'Defesa', score: catAvg.defense, icon: Shield },
    { label: 'Passe', score: catAvg.passing, icon: Shuffle },
    { label: 'Decisão', score: catAvg.decision, icon: Brain },
  ].sort((a, b) => {
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return a.score - b.score; // worst first = most errors first
  });

  const bestScore =
    entries.length > 0
      ? Math.max(...entries.map((e) => e.overallScore ?? 0))
      : null;

  const trend = (() => {
    if (entries.length < 2) return null;
    const first = entries[0].overallScore;
    const last = entries[entries.length - 1].overallScore;
    if (first === null || last === null) return null;
    return Math.round((last - first) * 10) / 10;
  })();

  const trendValue: React.ReactNode = (() => {
    if (trend === null) return <span className="text-[#f8f8fc]/45">—</span>;
    if (trend > 0)
      return <span className="text-[#6fcf97]">+{trend.toFixed(1)}</span>;
    if (trend < 0)
      return <span className="text-[#e2718a]">{trend.toFixed(1)}</span>;
    return <span className="text-[#f8f8fc]/55">0.0</span>;
  })();

  const trendIcon = trend !== null && trend > 0 ? TrendingUp : trend !== null && trend < 0 ? TrendingDown : Minus;

  // Reverse for table (newest first)
  const entriesDesc = [...entries].reverse();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">Evolução</h1>
          <p className="mt-0.5 text-sm text-[#f8f8fc]/45">
            {entries.length} partida{entries.length !== 1 ? 's' : ''} analisada{entries.length !== 1 ? 's' : ''} no período
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 rounded-lg bg-white/[0.06] p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days as 7 | 30 | 90)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                days === p.days
                  ? 'bg-white/[0.08] text-[#f8f8fc]'
                  : 'text-[#f8f8fc]/45 hover:text-[#f8f8fc]/80',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 && !isRefetching && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06]">
            <TrendingUp className="h-8 w-8 text-[#f8f8fc]/35" />
          </div>
          <p className="mb-1 text-base font-medium text-[#f8f8fc]">
            Nenhuma partida analisada nos últimos {days} dias
          </p>
          <p className="mb-6 text-sm text-[#f8f8fc]/45">
            Envie uma partida para análise para ver sua evolução aqui
          </p>
          <Link
            href="/matches/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-gold-bright to-gold px-4 py-2.5 text-sm font-medium text-[#f8f8fc] hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Nova partida
          </Link>
        </div>
      )}

      {entries.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={Trophy}
              iconClass="bg-gold/15 text-gold-bright"
              label="Partidas no Período"
              value={entries.length}
              sub={`últimos ${days} dias`}
            />
            <StatCard
              icon={Trophy}
              iconClass={
                bestScore !== null && bestScore >= 7
                  ? 'bg-[#6fcf97]/15 text-[#6fcf97]'
                  : bestScore !== null && bestScore >= 5
                    ? 'bg-[#e0954a]/15 text-[#e0954a]'
                    : 'bg-[#e2718a]/15 text-[#e2718a]'
              }
              label="Melhor Nota"
              value={
                bestScore !== null ? (
                  <span className={scoreColor(bestScore)}>{bestScore.toFixed(1)}</span>
                ) : (
                  <span className="text-[#f8f8fc]/45">—</span>
                )
              }
              sub="nota mais alta no período"
            />
            <StatCard
              icon={trendIcon}
              iconClass="bg-violet/15 text-violet"
              label="Tendência"
              value={trendValue}
              sub={
                trend !== null
                  ? trend > 0
                    ? 'melhora no período'
                    : trend < 0
                      ? 'queda no período'
                      : 'estável'
                  : 'dados insuficientes'
              }
            />
          </div>

          {/* Chart */}
          <div className={cn('mb-6 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-4', isRefetching && 'opacity-50')}>
            <h2 className="mb-4 text-sm font-semibold text-[#f8f8fc]/55">Histórico de Notas</h2>
            {isRefetching ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#f8f8fc]/35" />
              </div>
            ) : (
              <ScoreChart entries={entries} />
            )}
          </div>

          {/* Category performance + per-match trend */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Categories sorted worst→best */}
            <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
              <h2 className="mb-4 text-sm font-semibold text-[#f8f8fc]/55">
                Desempenho por Categoria
                <span className="ml-2 text-xs font-normal text-[#f8f8fc]/35">(do mais problemático ao melhor)</span>
              </h2>
              <div className="space-y-3.5">
                {sortedCategories.map((cat, i) => (
                  <CategoryBar
                    key={cat.label}
                    label={cat.label}
                    score={cat.score}
                    icon={cat.icon}
                    rank={i + 1}
                  />
                ))}
              </div>
            </div>

            {/* Per-match trend (last 5) */}
            <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
              <h2 className="mb-4 text-sm font-semibold text-[#f8f8fc]/55">Tendência por Partida</h2>
              {entries.length < 2 ? (
                <p className="text-sm text-[#f8f8fc]/35">Analise mais partidas para ver a tendência individual.</p>
              ) : (
                <div className="space-y-2">
                  {entriesDesc.slice(0, 6).map((entry, i) => {
                    const prevInTime = entriesDesc[i + 1];
                    const delta =
                      prevInTime && prevInTime.overallScore !== null && entry.overallScore !== null
                        ? Math.round((entry.overallScore - prevInTime.overallScore) * 10) / 10
                        : null;

                    return (
                      <Link
                        key={entry.matchId}
                        href={`/matches/${entry.matchId}`}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.06]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[#f8f8fc]/80">
                            {entry.title ?? 'Partida sem título'}
                          </p>
                          <p className="text-xs text-[#f8f8fc]/35">
                            {formatShortDate(entry.matchDate, entry.createdAt)}
                            {entry.gameMode ? ` · ${entry.gameMode}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 pl-3">
                          {delta !== null && (
                            <span
                              className={cn(
                                'flex items-center gap-0.5 text-xs font-medium',
                                delta > 0 ? 'text-[#6fcf97]' : delta < 0 ? 'text-[#e2718a]' : 'text-[#f8f8fc]/45',
                              )}
                            >
                              {delta > 0 ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : delta < 0 ? (
                                <ArrowDown className="h-3 w-3" />
                              ) : (
                                <Minus className="h-3 w-3" />
                              )}
                              {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                            </span>
                          )}
                          <span
                            className={cn(
                              'w-10 text-right text-sm font-bold',
                              scoreColor(entry.overallScore),
                            )}
                          >
                            {entry.overallScore?.toFixed(1) ?? '—'}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Comparison table */}
          <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
            <h2 className="mb-4 text-sm font-semibold text-[#f8f8fc]/55">
              Comparação de Partidas
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left text-xs text-[#f8f8fc]/35">
                    <th className="pb-3 pr-4 font-medium">Data</th>
                    <th className="pb-3 pr-4 font-medium">Partida</th>
                    <th className="pb-3 pr-4 text-right font-medium">Geral</th>
                    <th className="hidden pb-3 pr-4 text-right font-medium sm:table-cell">Ata</th>
                    <th className="hidden pb-3 pr-4 text-right font-medium sm:table-cell">Def</th>
                    <th className="hidden pb-3 pr-4 text-right font-medium sm:table-cell">Pas</th>
                    <th className="hidden pb-3 text-right font-medium sm:table-cell">Dec</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {entriesDesc.map((entry, i) => {
                    const prevInTime = entriesDesc[i + 1];
                    const delta =
                      prevInTime && prevInTime.overallScore !== null && entry.overallScore !== null
                        ? entry.overallScore - prevInTime.overallScore
                        : null;

                    return (
                      <tr key={entry.matchId} className="group">
                        <td className="py-3 pr-4 text-xs text-[#f8f8fc]/45 tabular-nums">
                          {formatShortDate(entry.matchDate, entry.createdAt)}
                        </td>
                        <td className="py-3 pr-4">
                          <Link
                            href={`/matches/${entry.matchId}`}
                            className="truncate text-[#f8f8fc]/80 transition-colors group-hover:text-[#f8f8fc]"
                          >
                            {entry.title ?? 'Partida sem título'}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className={cn('font-bold tabular-nums', scoreColor(entry.overallScore))}>
                            {entry.overallScore?.toFixed(1) ?? '—'}
                          </span>
                          {delta !== null && (
                            <span
                              className={cn(
                                'ml-1.5 text-xs',
                                delta > 0 ? 'text-[#6fcf97]' : delta < 0 ? 'text-[#e2718a]' : 'text-[#f8f8fc]/35',
                              )}
                            >
                              {delta > 0 ? `↑` : delta < 0 ? `↓` : `=`}
                            </span>
                          )}
                        </td>
                        <td className={cn('hidden py-3 pr-4 text-right tabular-nums sm:table-cell', scoreColor(entry.attackScore))}>
                          {entry.attackScore?.toFixed(1) ?? '—'}
                        </td>
                        <td className={cn('hidden py-3 pr-4 text-right tabular-nums sm:table-cell', scoreColor(entry.defenseScore))}>
                          {entry.defenseScore?.toFixed(1) ?? '—'}
                        </td>
                        <td className={cn('hidden py-3 pr-4 text-right tabular-nums sm:table-cell', scoreColor(entry.passingScore))}>
                          {entry.passingScore?.toFixed(1) ?? '—'}
                        </td>
                        <td className={cn('hidden py-3 text-right tabular-nums sm:table-cell', scoreColor(entry.decisionScore))}>
                          {entry.decisionScore?.toFixed(1) ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
