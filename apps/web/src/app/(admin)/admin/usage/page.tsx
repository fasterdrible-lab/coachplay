'use client';

import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Coins,
  KeyRound,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsageRow {
  id: string;
  name: string;
  email: string;
  plan: string | null;
  totalAnalyses: number;
  totalCost: number;
}

interface UsageResponse {
  data: UsageRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OverviewData {
  ai: { totalAnalyses: number; totalCost: number; avgCostPerAnalysis: number };
}

interface ProviderStatus {
  configured: boolean;
  source: 'painel' | 'variável de ambiente' | null;
  preview: string | null;
}

interface AiProviderStatus {
  anthropic: ProviderStatus;
  openai: ProviderStatus;
  deepSeek: ProviderStatus;
  updatedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(value: number): string {
  return `US$ ${value.toFixed(value > 0 && value < 1 ? 4 : 2)}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  const [providerStatus, setProviderStatus] = useState<AiProviderStatus | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [anthropicKeyInput, setAnthropicKeyInput] = useState('');
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [deepSeekKeyInput, setDeepSeekKeyInput] = useState('');
  const [isSavingProviders, setIsSavingProviders] = useState(false);
  const [providerError, setProviderError] = useState('');
  const [providerSaved, setProviderSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    Promise.allSettled([
      api.get<UsageResponse>(`/admin/usage?page=${page}&limit=15`),
      api.get<OverviewData>('/admin/overview'),
    ])
      .then(([usageRes, overviewRes]) => {
        if (cancelled) return;
        if (usageRes.status === 'fulfilled') setData(usageRes.value);
        else setError('Não foi possível carregar o uso de IA.');
        if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [page, retryKey]);

  function loadProviderStatus() {
    setIsLoadingProviders(true);
    api
      .get<AiProviderStatus>('/settings/ai-provider')
      .then((res) => setProviderStatus(res))
      .catch(() => setProviderError('Não foi possível carregar as chaves configuradas.'))
      .finally(() => setIsLoadingProviders(false));
  }

  useEffect(() => {
    loadProviderStatus();
  }, []);

  async function handleSaveProviders(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProviders(true);
    setProviderError('');
    setProviderSaved(false);

    try {
      const body: { anthropicApiKey?: string; openaiApiKey?: string; deepSeekApiKey?: string } = {};
      if (anthropicKeyInput.trim()) body.anthropicApiKey = anthropicKeyInput.trim();
      if (openaiKeyInput.trim()) body.openaiApiKey = openaiKeyInput.trim();
      if (deepSeekKeyInput.trim()) body.deepSeekApiKey = deepSeekKeyInput.trim();

      const res = await api.put<AiProviderStatus>('/settings/ai-provider', body);
      setProviderStatus(res);
      setAnthropicKeyInput('');
      setOpenaiKeyInput('');
      setDeepSeekKeyInput('');
      setProviderSaved(true);
      setTimeout(() => setProviderSaved(false), 3000);
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : 'Erro ao salvar as chaves.');
    } finally {
      setIsSavingProviders(false);
    }
  }

  async function handleRemoveKey(provider: 'anthropicApiKey' | 'openaiApiKey' | 'deepSeekApiKey') {
    setIsSavingProviders(true);
    setProviderError('');

    try {
      const res = await api.put<AiProviderStatus>('/settings/ai-provider', { [provider]: '' });
      setProviderStatus(res);
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : 'Erro ao remover a chave.');
    } finally {
      setIsSavingProviders(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[#f8f8fc]">Uso & IA</h1>
        <p className="mt-1 text-sm text-[#f8f8fc]/55">Consumo de análises e custo estimado por usuário</p>
      </div>

      {/* Provedores de IA */}
      <div className="mb-6 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet/15 text-violet">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/80">Provedores de IA</h2>
            <p className="text-xs text-white/45">
              Chaves de API do Anthropic Claude, OpenAI GPT-4o e DeepSeek usadas na análise das partidas
            </p>
          </div>
        </div>

        {isLoadingProviders ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/35" />
          </div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  { key: 'anthropicApiKey' as const, label: 'Anthropic (Claude)', status: providerStatus?.anthropic },
                  { key: 'openaiApiKey' as const, label: 'OpenAI (GPT-4o)', status: providerStatus?.openai },
                  { key: 'deepSeekApiKey' as const, label: 'DeepSeek', status: providerStatus?.deepSeek },
                ]
              ).map(({ key, label, status }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[#f8f8fc]">{label}</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {status?.configured ? (
                        <>
                          Configurada via {status.source}
                          {status.preview && <span className="ml-1 font-mono">({status.preview})</span>}
                        </>
                      ) : (
                        'Não configurada'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        status?.configured ? 'bg-[#6fcf97]' : 'bg-[#e0954a]',
                      )}
                    />
                    {status?.source === 'painel' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveKey(key)}
                        disabled={isSavingProviders}
                        className="text-xs text-white/45 underline hover:text-[#e2718a] disabled:opacity-50"
                      >
                        remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSaveProviders} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  id="anthropicApiKey"
                  label="Nova chave Anthropic"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-ant-..."
                  value={anthropicKeyInput}
                  onChange={(e) => setAnthropicKeyInput(e.target.value)}
                />
                <Input
                  id="openaiApiKey"
                  label="Nova chave OpenAI"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-..."
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                />
                <Input
                  id="deepSeekApiKey"
                  label="Nova chave DeepSeek"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-..."
                  value={deepSeekKeyInput}
                  onChange={(e) => setDeepSeekKeyInput(e.target.value)}
                />
              </div>

              {providerError && (
                <div className="flex items-center gap-2 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#e2718a]" />
                  <p className="text-sm text-[#e2718a]">{providerError}</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  isLoading={isSavingProviders}
                  disabled={!anthropicKeyInput.trim() && !openaiKeyInput.trim() && !deepSeekKeyInput.trim()}
                >
                  {isSavingProviders ? 'Salvando...' : 'Salvar chaves'}
                </Button>
                {providerSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-[#6fcf97]">
                    <CheckCircle2 className="h-4 w-4" />
                    Salvo com sucesso
                  </span>
                )}
              </div>
              <p className="text-xs text-white/35">
                As chaves são criptografadas antes de serem salvas e nunca são exibidas novamente por completo.
              </p>
            </form>
          </>
        )}
      </div>

      {overview && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-bright">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-sm text-[#f8f8fc]/55">Análises concluídas</p>
            </div>
            <div className="text-2xl font-bold text-[#f8f8fc]">{overview.ai.totalAnalyses}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet/15 text-violet">
                <Coins className="h-4 w-4" />
              </div>
              <p className="text-sm text-[#f8f8fc]/55">Custo total</p>
            </div>
            <div className="text-2xl font-bold text-[#f8f8fc]">{formatCost(overview.ai.totalCost)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e0954a]/15 text-[#e0954a]">
                <Coins className="h-4 w-4" />
              </div>
              <p className="text-sm text-[#f8f8fc]/55">Custo médio por análise</p>
            </div>
            <div className="text-2xl font-bold text-[#f8f8fc]">
              {formatCost(overview.ai.avgCostPerAnalysis)}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{error}</p>
          <button onClick={() => setRetryKey((k) => k + 1)} className="ml-auto text-xs text-[#e2718a] underline">
            Tentar novamente
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-xs text-[#f8f8fc]/45">
                  <th className="px-5 py-3 font-medium">Usuário</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                  <th className="px-5 py-3 font-medium text-right">Análises</th>
                  <th className="px-5 py-3 font-medium text-right">Custo estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data.data.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-[#f8f8fc]">{row.name}</p>
                      <p className="text-xs text-[#f8f8fc]/45">{row.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-[#f8f8fc]/70">{row.plan ?? '—'}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-[#f8f8fc]">
                      {row.totalAnalyses}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-3.5 text-right tabular-nums font-medium',
                        row.totalCost > 0 ? 'text-gold-bright' : 'text-[#f8f8fc]/35',
                      )}
                    >
                      {formatCost(row.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-[#f8f8fc]/45">
                Página {data.page} de {data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
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
