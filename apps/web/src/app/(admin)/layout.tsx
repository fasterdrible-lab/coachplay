'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/auth-provider';
import { Sidebar } from '../../components/layout/sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-ink">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-gold" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink text-[#f8f8fc]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
