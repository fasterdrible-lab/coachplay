'use client';

import Link from 'next/link';
import Image from 'next/image';
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
  BookOpen,
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

function HelpLink() {
  return (
    <a
      href="/manual.html"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.06] hover:text-[#f8f8fc]"
    >
      <BookOpen className="h-4 w-4 shrink-0" />
      <span>Manual</span>
    </a>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-gold/[0.14] text-gold-bright'
          : 'text-white/55 hover:bg-white/[0.06] hover:text-[#f8f8fc]',
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
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-white/[0.08] bg-ink2/60 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-gold">
          <Image src="/logo-mark.png" alt="Coach Play" width={32} height={32} />
        </div>
        <span className="font-display font-semibold text-[#f8f8fc]">Coach Play</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        <HelpLink />

        {user?.role === 'admin' && (
          <>
            <div className="my-3 border-t border-white/[0.08]" />
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-violet/85">
              Administração
            </p>
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </>
        )}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/[0.08] p-3">
        <div className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
            <span className="text-xs font-medium uppercase text-white/70">{initial}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#f8f8fc]">{user?.name}</p>
            <p className="truncate text-xs text-white/45">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/55 transition-colors hover:bg-white/[0.06] hover:text-[#f8f8fc]"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
