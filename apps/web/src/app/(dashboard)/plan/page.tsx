'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Gauge,
  Film,
  Zap,
  CalendarDays,
  Loader2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { cn } from '../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanData {
  id: string;
  name: string;
  monthlyAnalysisLimit: number;
  maxVideoMinutes: number;
  liveFeedbackEnabled: boolean;
  price: string;
  status: string;
}

interface SubscriptionData {
  id: string;
  status: 'active' | 'expired' | 'cancelled';
  startedAt: string;
  expiresAt: string | null;
  plan: PlanData;
  usage: {
    analysesThisMonth: number;
    limit: number;
    limitReached: boolean;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatPrice(price: string): string {
  const value = parseFloat(price);
  if (value === 0) return 'Grátis';
  return `R$ ${value.toFixed(2).replace('.', ',')}/mês`;
}

function usageColor(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 80) return 'bg-[#e0954a]';
  return 'bg-[#6fcf97]';
}

function usageTextColor(pct: number): string {
  if (pct >= 100) return 'text-[#e2718a]';
  if (pct >= 80) return 'text-[#e0954a]';
  return 'text-[#6fcf97]';
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-[#6fcf97]/15 text-[#6fcf97]' },
  expired: { label: 'Expirado', className: 'bg-[#e2718a]/15 text-[#e2718a]' },
  cancelled: { label: 'Cancelado', className: 'bg-white/[0.08] text-[#f8f8fc]/55' },
};

// ─── Info Card ────────────────────────────────────────────────────────────────

function InfoCard({
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

export default function PlanPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [otherPlans, setOtherPlans] = useState<PlanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      api.get<SubscriptionData>('/subscriptions/me'),
      api.get<PlanData[]>('/plans'),
    ])
      .then(([subRes, plansRes]) => {
        if (cancelled) return;
        if (subRes.status === 'fulfilled') {
          setSubscription(subRes.value);
        } else {
          setError(subRes.reason?.message ?? 'Não foi possível carregar sua assinatura.');
        }
        if (plansRes.status === 'fulfilled') setOtherPlans(plansRes.value);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold text-[#f8f8fc]">Meu Plano</h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl py-16 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-[#e2718a]" />
          <p className="text-sm text-[#f8f8fc]/55">{error ?? 'Assinatura não encontrada.'}</p>
        </div>
      </div>
    );
  }

  const { plan, usage } = subscription;
  const pct = usage.limit > 0 ? Math.min(100, Math.round((usage.analysesThisMonth / usage.limit) * 100)) : 0;
  const statusCfg = STATUS_LABELS[subscription.status] ?? STATUS_LABELS.active;

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-[#f8f8fc]">Meu Plano</h1>
      <p className="mb-6 text-sm text-[#f8f8fc]/45">Detalhes da sua assinatura e consumo mensal</p>

      {/* Current plan header */}
      <div className="mb-6 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold-bright">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-[#f8f8fc]/45">Plano atual</p>
                <h2 className="text-xl font-bold text-[#f8f8fc]">{plan.name}</h2>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', statusCfg.className)}>
              {statusCfg.label}
            </span>
            <span className="text-sm font-semibold text-[#f8f8fc]/80">{formatPrice(plan.price)}</span>
          </div>
        </div>

        {usage.limitReached && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#e0954a]/20 bg-[#e0954a]/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#e0954a]" />
            <p className="text-sm text-[#e0954a]">
              Limite mensal de análises atingido. Faça upgrade para continuar analisando partidas.
            </p>
          </div>
        )}
      </div>

      {/* Usage progress */}
      <div className="mb-6 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#f8f8fc]/55">Consumo do mês</h2>
          <span className={cn('text-sm font-bold', usageTextColor(pct))}>
            {usage.analysesThisMonth} / {usage.limit} análises
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={cn('h-full rounded-full transition-all duration-500', usageColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#f8f8fc]/45">{pct}% do limite mensal utilizado</p>
      </div>

      {/* Plan details */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard
          icon={Gauge}
          iconClass="bg-violet/15 text-violet"
          label="Limite Mensal"
          value={plan.monthlyAnalysisLimit}
          sub="análises por mês"
        />
        <InfoCard
          icon={Film}
          iconClass="bg-gold/15 text-gold-bright"
          label="Duração Máx. de Vídeo"
          value={`${plan.maxVideoMinutes} min`}
          sub="por partida enviada"
        />
        <InfoCard
          icon={Zap}
          iconClass={plan.liveFeedbackEnabled ? 'bg-[#6fcf97]/15 text-[#6fcf97]' : 'bg-white/[0.08] text-[#f8f8fc]/45'}
          label="Feedback ao Vivo"
          value={plan.liveFeedbackEnabled ? 'Incluído' : 'Não incluído'}
        />
      </div>

      {/* Renewal */}
      <div className="mb-6 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#f8f8fc]/55">
          <CalendarDays className="h-4 w-4" />
          Datas da assinatura
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[#f8f8fc]/45">Início</p>
            <p className="text-sm text-[#f8f8fc]/80">{formatDate(subscription.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-[#f8f8fc]/45">Renovação</p>
            <p className="text-sm text-[#f8f8fc]/80">
              {subscription.expiresAt ? formatDate(subscription.expiresAt) : 'Sem data de renovação'}
            </p>
          </div>
        </div>
      </div>

      {/* Other plans */}
      {otherPlans.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold text-[#f8f8fc]/55">Planos disponíveis</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {otherPlans.map((p) => {
              const isCurrent = p.id === plan.id;
              return (
                <div
                  key={p.id}
                  className={cn(
                    'rounded-xl border p-5',
                    isCurrent ? 'border-gold/40 bg-gold/5' : 'border-white/[0.08] bg-ink2/60 backdrop-blur-xl',
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-[#f8f8fc]">{p.name}</h3>
                    {isCurrent && (
                      <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold-bright">
                        <Check className="h-3 w-3" />
                        Atual
                      </span>
                    )}
                  </div>
                  <p className="mb-4 text-lg font-bold text-[#f8f8fc]">{formatPrice(p.price)}</p>
                  <ul className="space-y-1.5 text-sm text-[#f8f8fc]/55">
                    <li>{p.monthlyAnalysisLimit} análises/mês</li>
                    <li>Vídeos até {p.maxVideoMinutes} min</li>
                    <li>{p.liveFeedbackEnabled ? 'Feedback ao vivo incluído' : 'Sem feedback ao vivo'}</li>
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-[#f8f8fc]/35">
        Precisa de mais análises?{' '}
        <Link href="/matches/new" className="text-gold-bright hover:text-gold">
          Envie uma nova partida
        </Link>{' '}
        ou entre em contato para fazer upgrade do seu plano.
      </p>
    </div>
  );
}
