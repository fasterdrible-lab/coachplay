'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Gamepad2,
  TrendingUp,
  Settings,
  CreditCard,
  LogOut,
  Shield,
  Users,
  FileText,
  BarChart2,
} from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';
import { cn } from '../../lib/utils';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

const mainNav: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/matches', icon: Gamepad2, label: 'Partidas' },
  { href: '/evolution', icon: TrendingUp, label: 'Evolução' },
  { href: '/settings', icon: Settings, label: 'Configurações' },
  { href: '/plan', icon: CreditCard, label: 'Meu Plano' },
];

const adminNav: NavItem[] = [
  { href: '/admin', icon: Shield, label: 'Dashboard Admin' },
  { href: '/admin/users', icon: Users, label: 'Usuários' },
  { href: '/admin/logs', icon: FileText, label: 'Logs' },
  { href: '/admin/usage', icon: BarChart2, label: 'Uso & IA' },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-blue-600/20 text-blue-400'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/admin') return pathname === href;
    return pathname.startsWith(href);
  };

  const initial =
    user?.name?.trim().charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    '?';

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-gray-800 bg-gray-900">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-gray-800 px-4 py-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <span className="text-xs font-bold text-white">CP</span>
        </div>
        <span className="font-semibold text-white">Coach Play</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="my-3 border-t border-gray-800" />
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Administração
            </p>
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </>
        )}
      </nav>

      {/* User + logout */}
      <div className="border-t border-gray-800 p-3">
        <div className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700">
            <span className="text-xs font-medium uppercase text-gray-300">{initial}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
