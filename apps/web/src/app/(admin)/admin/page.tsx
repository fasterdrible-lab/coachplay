'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Gamepad2,
  Sparkles,
  ShieldAlert,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { cn } from '../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  users: { total: number; active: number; blocked: number; inactive: number };
  matches: {
    total: number;
    analyzed: number;
    processing: number;
    failed: number;
    pending: number;
  };
  ai: { totalAnalyses: number; totalCost: number; avgCostPerAnalysis: number };
  recentLogs: {
    id: string;
    module: string;
    action: string;
    createdAt: string;
    user: { name: string; email: string } | null;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  login_failed: 'Falha no login',
  register: 'Cadastro',
  register_failed: 'Falha no cadastro',
  logout: 'Logout',
  video_upload: 'Upload de vídeo',
  analysis_completed: 'Análise concluída',
  processing_failed: 'Falha no processamento',
  plan_assigned: 'Plano atribuído',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCost(value: number): string {
  return `US$ ${value.toFixed(value < 1 ? 4 : 2)}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  iconClassName: string;
  label: string;
  value: React.ReactNode;
  breakdown?: { label: string; value: React.ReactNode; className?: string }[];
}

function StatCard({ icon: Icon, iconClassName, label, value, breakdown }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconClassName)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm text-[#f8f8fc]/55">{label}</p>
      </div>
      <div className="text-2xl font-bold leading-none text-[#f8f8fc]">{value}</div>
      {breakdown && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {breakdown.map((b) => (
            <span key={b.label} className="text-xs text-[#f8f8fc]/45">
              {b.label} <span className={cn('font-medium', b.className)}>{b.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<OverviewData>('/admin/overview')
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError('Não foi possível carregar a visão geral.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#f8f8fc]">Painel Admin</h1>
        <p className="mt-1 text-sm text-[#f8f8fc]/55">Visão geral de usuários, partidas e uso de IA</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          iconClassName="bg-gold/15 text-gold-bright"
          label="Usuários"
          value={data.users.total}
          breakdown={[
            { label: 'ativos', value: data.users.active, className: 'text-[#6fcf97]' },
            { label: 'bloqueados', value: data.users.blocked, className: 'text-[#e2718a]' },
          ]}
        />
        <StatCard
          icon={Gamepad2}
          iconClassName="bg-violet/15 text-violet"
          label="Partidas"
          value={data.matches.total}
          breakdown={[
            { label: 'analisadas', value: data.matches.analyzed, className: 'text-[#6fcf97]' },
            { label: 'com falha', value: data.matches.failed, className: 'text-[#e2718a]' },
          ]}
        />
        <StatCard
          icon={Sparkles}
          iconClassName="bg-gold/15 text-gold-bright"
          label="Análises de IA concluídas"
          value={data.ai.totalAnalyses}
          breakdown={[{ label: 'custo total', value: formatCost(data.ai.totalCost) }]}
        />
        <StatCard
          icon={ShieldAlert}
          iconClassName="bg-[#e0954a]/15 text-[#e0954a]"
          label="Custo médio por análise"
          value={formatCost(data.ai.avgCostPerAnalysis)}
          breakdown={[{ label: 'usuários inativos', value: data.users.inactive }]}
        />
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#f8f8fc]/80">Atividade recente</h2>
          <Link
            href="/admin/logs"
            className="flex items-center gap-1 text-xs font-medium text-gold-bright hover:text-gold"
          >
            Ver todos os logs
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {data.recentLogs.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#f8f8fc]/45">Nenhum evento registrado ainda</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {data.recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-[#f8f8fc]">
                    {ACTION_LABELS[log.action] ?? log.action}
                    <span className="ml-2 text-xs text-[#f8f8fc]/35">{log.module}</span>
                  </p>
                  <p className="truncate text-xs text-[#f8f8fc]/45">
                    {log.user ? `${log.user.name} · ${log.user.email}` : 'Sistema'}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-[#f8f8fc]/35">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
