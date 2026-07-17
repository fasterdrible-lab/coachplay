'use client';

import { useEffect, useState } from 'react';
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { cn } from '../../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserStatus = 'active' | 'inactive' | 'blocked';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  createdAt: string;
  subscription: { status: string; plan: { name: string } } | null;
}

interface UsersResponse {
  data: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  player_free: 'Free',
  player_pro: 'Pro',
  player_premium: 'Premium',
  support: 'Suporte',
};

const STATUS_CONFIG: Record<UserStatus, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-[#6fcf97]/15 text-[#6fcf97]' },
  inactive: { label: 'Inativo', className: 'bg-white/[0.08] text-[#f8f8fc]/55' },
  blocked: { label: 'Bloqueado', className: 'bg-[#e2718a]/15 text-[#e2718a]' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);

    api
      .get<UsersResponse>(`/users?${params.toString()}`)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError('Não foi possível carregar os usuários.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [page, debouncedSearch, statusFilter, retryKey]);

  async function toggleStatus(user: AdminUser) {
    const nextStatus: UserStatus = user.status === 'blocked' ? 'active' : 'blocked';
    setPendingId(user.id);
    setActionError('');
    try {
      await api.patch(`/users/${user.id}/status`, { status: nextStatus });
      setData((prev) =>
        prev
          ? { ...prev, data: prev.data.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)) }
          : prev,
      );
    } catch {
      setActionError('Não foi possível atualizar o status deste usuário.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[#f8f8fc]">Usuários</h1>
        {data && !isLoading && (
          <p className="mt-1 text-sm text-[#f8f8fc]/55">
            {data.total} {data.total === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f8f8fc]/45" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] py-2.5 pl-9 pr-4 text-sm text-[#f8f8fc] placeholder-white/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.06] py-2.5 pl-3 pr-9 text-sm text-[#f8f8fc] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 sm:w-auto"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="blocked">Bloqueado</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f8f8fc]/55" />
        </div>
      </div>

      {(error || actionError) && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{error || actionError}</p>
          {error && (
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="ml-auto text-xs text-[#e2718a] underline"
            >
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
            <p className="py-20 text-center text-sm text-[#f8f8fc]/45">Nenhum usuário encontrado</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left text-xs text-[#f8f8fc]/45">
                    <th className="px-5 py-3 font-medium">Usuário</th>
                    <th className="px-5 py-3 font-medium">Papel</th>
                    <th className="px-5 py-3 font-medium">Plano</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Criado em</th>
                    <th className="px-5 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {data.data.map((user) => {
                    const cfg = STATUS_CONFIG[user.status];
                    const isBlocked = user.status === 'blocked';
                    return (
                      <tr key={user.id}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-[#f8f8fc]">{user.name}</p>
                          <p className="text-xs text-[#f8f8fc]/45">{user.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-[#f8f8fc]/70">
                          {ROLE_LABELS[user.role] ?? user.role}
                        </td>
                        <td className="px-5 py-3.5 text-[#f8f8fc]/70">
                          {user.subscription?.plan?.name ?? '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', cfg.className)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[#f8f8fc]/45">{formatDate(user.createdAt)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {user.role === 'admin' ? (
                            <span className="text-xs text-[#f8f8fc]/35">—</span>
                          ) : (
                            <button
                              onClick={() => toggleStatus(user)}
                              disabled={pendingId === user.id}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                                isBlocked
                                  ? 'bg-[#6fcf97]/15 text-[#6fcf97] hover:bg-[#6fcf97]/25'
                                  : 'bg-[#e2718a]/15 text-[#e2718a] hover:bg-[#e2718a]/25',
                              )}
                            >
                              {pendingId === user.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isBlocked ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Ban className="h-3 w-3" />
                              )}
                              {isBlocked ? 'Ativar' : 'Bloquear'}
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
