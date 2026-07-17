'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/auth-provider';
import { Sidebar } from '../../components/layout/sidebar';

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-ink">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-gold" />
        <p className="text-sm text-white/45">Carregando...</p>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-ink text-[#f8f8fc]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
