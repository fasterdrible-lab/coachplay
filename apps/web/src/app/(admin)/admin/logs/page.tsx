'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { cn } from '../../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  module: string;
  action: string;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface LogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODULES = ['auth', 'matches', 'game-analysis', 'video-processing', 'plans'];

const MODULE_LABELS: Record<string, string> = {
  auth: 'Autenticação',
  matches: 'Partidas',
  'game-analysis': 'Análise de jogo',
  'video-processing': 'Processamento de vídeo',
  plans: 'Planos',
};

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

const FAILED_ACTIONS = new Set(['login_failed', 'register_failed', 'processing_failed']);

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(1);
  }, [moduleFilter]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setSelectedIds(new Set());

    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (moduleFilter) params.set('module', moduleFilter);

    api
      .get<LogsResponse>(`/audit-logs?${params.toString()}`)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError('Não foi possível carregar os logs.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [page, moduleFilter, retryKey]);

  const allSelected = !!data && data.data.length > 0 && selectedIds.size === data.data.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleSelectAll() {
    if (!data) return;
    setSelectedIds(allSelected ? new Set() : new Set(data.data.map((l) => l.id)));
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteLog(log: AuditLog) {
    if (!window.confirm('Excluir este registro de auditoria? Essa ação não pode ser desfeita.')) return;

    setDeletingId(log.id);
    setActionError('');
    try {
      await api.delete(`/audit-logs/${log.id}`);
      setData((prev) =>
        prev
          ? { ...prev, data: prev.data.filter((l) => l.id !== log.id), total: prev.total - 1 }
          : prev,
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(log.id);
        return next;
      });
    } catch {
      setActionError('Não foi possível excluir este registro.');
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${ids.length} registro(s) de auditoria selecionado(s)? Essa ação não pode ser desfeita.`)) {
      return;
    }

    setIsBulkDeleting(true);
    setActionError('');

    const results = await Promise.allSettled(ids.map((id) => api.delete(`/audit-logs/${id}`)));
    const deletedIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    const failedCount = ids.length - deletedIds.size;

    setData((prev) =>
      prev
        ? {
            ...prev,
            data: prev.data.filter((l) => !deletedIds.has(l.id)),
            total: prev.total - deletedIds.size,
          }
        : prev,
    );
    setSelectedIds(new Set());
    if (failedCount > 0) {
      setActionError(`${failedCount} registro(s) não puderam ser excluídos.`);
    }
    setIsBulkDeleting(false);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[#f8f8fc]">Logs de Auditoria</h1>
        {data && !isLoading && (
          <p className="mt-1 text-sm text-[#f8f8fc]/55">{data.total} eventos registrados</p>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.06] py-2.5 pl-3 pr-9 text-sm text-[#f8f8fc] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 sm:w-auto"
          >
            <option value="">Todos os módulos</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {MODULE_LABELS[m] ?? m}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f8f8fc]/55" />
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-gold/20 bg-gold/5 px-4 py-2 sm:ml-auto">
            <span className="text-sm text-[#f8f8fc]/70">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={isBulkDeleting}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#e2718a] underline disabled:opacity-50"
            >
              {isBulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Excluir selecionados
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-[#f8f8fc]/45 underline"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {(error || actionError) && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{error || actionError}</p>
          {error && (
            <button onClick={() => setRetryKey((k) => k + 1)} className="ml-auto text-xs text-[#e2718a] underline">
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          {data.data.length === 0 ? (
            <p className="py-20 text-center text-sm text-[#f8f8fc]/45">Nenhum evento encontrado</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left text-xs text-[#f8f8fc]/45">
                    <th className="w-10 px-5 py-3">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded accent-gold"
                        aria-label="Selecionar todos"
                      />
                    </th>
                    <th className="px-5 py-3 font-medium">Data</th>
                    <th className="px-5 py-3 font-medium">Módulo</th>
                    <th className="px-5 py-3 font-medium">Ação</th>
                    <th className="px-5 py-3 font-medium">Usuário</th>
                    <th className="px-5 py-3 font-medium">IP</th>
                    <th className="px-5 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {data.data.map((log) => {
                    const isFailed = FAILED_ACTIONS.has(log.action);
                    const isExpanded = expandedId === log.id;
                    const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
                    return (
                      <tr
                        key={log.id}
                        className={cn(
                          selectedIds.has(log.id) && 'bg-gold/5',
                          hasMetadata && 'cursor-pointer hover:bg-white/[0.03]',
                        )}
                        onClick={() => hasMetadata && setExpandedId(isExpanded ? null : log.id)}
                      >
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(log.id)}
                            onChange={() => toggleSelectOne(log.id)}
                            className="h-4 w-4 rounded accent-gold"
                            aria-label="Selecionar registro"
                          />
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-[#f8f8fc]/55">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-[#f8f8fc]/70">
                          {MODULE_LABELS[log.module] ?? log.module}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              'font-medium',
                              isFailed ? 'text-[#e2718a]' : 'text-[#f8f8fc]',
                            )}
                          >
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                          {isExpanded && hasMetadata && (
                            <pre className="mt-2 max-w-md overflow-x-auto rounded-lg bg-black/30 p-2.5 text-xs text-[#f8f8fc]/55">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[#f8f8fc]/70">
                          {log.user ? (
                            <>
                              <p>{log.user.name}</p>
                              <p className="text-xs text-[#f8f8fc]/45">{log.user.email}</p>
                            </>
                          ) : (
                            <span className="text-[#f8f8fc]/35">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-[#f8f8fc]/45">
                          {log.ipAddress ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {deletingId === log.id ? (
                            <Loader2 className="ml-auto h-4 w-4 animate-spin text-[#f8f8fc]/45" />
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLog(log);
                              }}
                              className="inline-flex items-center justify-center rounded-lg p-1.5 text-[#f8f8fc]/45 transition-colors hover:bg-[#e2718a]/10 hover:text-[#e2718a]"
                              aria-label="Excluir registro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

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
