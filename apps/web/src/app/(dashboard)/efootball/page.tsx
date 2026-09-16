'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BookOpen,
  Coins,
  GraduationCap,
  Loader2,
  Shirt,
  Sparkles,
  Target,
  Users2,
  X,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { LEARNING_LEVEL_LABELS, NEXT_BEST_ACTION_LABELS } from '../../../lib/efootball';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressMetrics {
  learning: { level: string; onboardingCompletedAt: string | null; lessonsCompleted: number; lessonsTotal: number; percent: number };
  roster: { playersOwned: number; favoritePlayers: number; buildsSaved: number };
  squads: { squadsSaved: number };
  economy: { evaluationsCount: number; recommendedCount: number };
  matchAnalysis: { totalAnalyzed: number; worstCategory: string | null; avgOverallScore: number | null };
}

interface ProgressData {
  computedAt: string;
  metrics: ProgressMetrics;
}

interface NextBestAction {
  id: string;
  type: string;
  reason: string;
  lessonId: string | null;
  dismissed: boolean;
}

const ACTION_LINKS: Record<string, string> = {
  COMPLETE_ONBOARDING: '/efootball/onboarding',
  ADD_PLAYERS: '/efootball/players',
  BUILD_SQUAD: '/efootball/squads',
  DO_LESSON: '/efootball/academy',
};

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
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

export default function EfootballDashboardPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [action, setAction] = useState<NextBestAction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  const fetchData = useCallback(() => {
    setIsLoading(true);
    return Promise.allSettled([
      api.get<ProgressData>('/progress/me'),
      api.get<NextBestAction>('/recommendations/next-best-action'),
    ]).then(([progressRes, actionRes]) => {
      if (progressRes.status === 'fulfilled') setProgress(progressRes.value);
      else setError(progressRes.reason?.message ?? 'Não foi possível carregar seu progresso.');
      if (actionRes.status === 'fulfilled') setAction(actionRes.value);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDismiss = async () => {
    if (!action) return;
    setIsDismissing(true);
    try {
      await api.post(`/recommendations/${action.id}/dismiss`);
      setAction({ ...action, dismissed: true });
    } catch {
      // best-effort — se falhar, o card continua visível
    } finally {
      setIsDismissing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold text-[#f8f8fc]">eFootball</h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl py-16 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-[#e2718a]" />
          <p className="text-sm text-[#f8f8fc]/55">{error ?? 'Não foi possível carregar seu progresso.'}</p>
        </div>
      </div>
    );
  }

  const { metrics } = progress;

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-[#f8f8fc]">eFootball</h1>
      <p className="mb-6 text-sm text-[#f8f8fc]/45">Seu progresso no módulo de treinamento de eFootball</p>

      {/* Next best action */}
      {action && action.type !== 'ALL_CAUGHT_UP' && !action.dismissed && (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gold/25 bg-gold/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-bright">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-bright">
                {NEXT_BEST_ACTION_LABELS[action.type] ?? 'Recomendação'}
              </p>
              <p className="mt-1 text-sm text-[#f8f8fc]/85">{action.reason}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {ACTION_LINKS[action.type] && (
              <Link href={ACTION_LINKS[action.type]}>
                <Button variant="primary">Ir agora</Button>
              </Link>
            )}
            <button
              onClick={handleDismiss}
              disabled={isDismissing}
              className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-50"
              title="Dispensar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {action && (action.type === 'ALL_CAUGHT_UP' || action.dismissed) && (
        <div className="mb-6 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
          <p className="text-sm text-[#f8f8fc]/55">{action.reason}</p>
        </div>
      )}

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={GraduationCap}
          iconClass="bg-gold/15 text-gold-bright"
          label="Academia"
          value={`${LEARNING_LEVEL_LABELS[metrics.learning.level] ?? metrics.learning.level}`}
          sub={`${metrics.learning.lessonsCompleted}/${metrics.learning.lessonsTotal} aulas (${metrics.learning.percent}%)`}
        />
        <MetricCard
          icon={Users2}
          iconClass="bg-violet/15 text-violet"
          label="Meus Jogadores"
          value={metrics.roster.playersOwned}
          sub={`${metrics.roster.favoritePlayers} favoritos · ${metrics.roster.buildsSaved} builds salvas`}
        />
        <MetricCard
          icon={Shirt}
          iconClass="bg-[#6fcf97]/15 text-[#6fcf97]"
          label="Squad Builder"
          value={metrics.squads.squadsSaved}
          sub="elencos salvos"
        />
        <MetricCard
          icon={Coins}
          iconClass="bg-[#e0954a]/15 text-[#e0954a]"
          label="Economy Advisor"
          value={metrics.economy.evaluationsCount}
          sub={`${metrics.economy.recommendedCount} packs recomendados`}
        />
        <MetricCard
          icon={Target}
          iconClass="bg-[#e2718a]/15 text-[#e2718a]"
          label="Match Analysis"
          value={metrics.matchAnalysis.totalAnalyzed}
          sub={
            metrics.matchAnalysis.worstCategory
              ? `Ponto fraco: ${metrics.matchAnalysis.worstCategory}`
              : 'Sem partidas analisadas ainda'
          }
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink href="/efootball/academy" icon={BookOpen} label="Academia CoachPlay" desc="Trilhas de aprendizado por nível" />
        <QuickLink href="/efootball/players" icon={Users2} label="Meus Jogadores" desc="Elenco, builds e scanner de cartas" />
        <QuickLink href="/efootball/squads" icon={Shirt} label="Squad Builder" desc="Monte sua escalação titular" />
        <QuickLink href="/efootball/economy" icon={Coins} label="Economy Advisor" desc="Vale a pena esse pack?" />
        <QuickLink href="/efootball/ask-coach" icon={Sparkles} label="Ask Coach" desc="Pergunte qualquer coisa sobre seu jogo" />
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, desc }: { href: string; icon: React.ElementType; label: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-4 transition-colors hover:bg-white/[0.04]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[#f8f8fc]/70">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#f8f8fc]">{label}</p>
        <p className="truncate text-xs text-[#f8f8fc]/45">{desc}</p>
      </div>
    </Link>
  );
}
