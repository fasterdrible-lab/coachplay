'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../providers/auth-provider';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

const loginSchema = z.object({
  email: z.string().email('Digite um e-mail válido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setApiError('');
      await login(data.email, data.password);
      const redirectTo = searchParams.get('from') ?? '/dashboard';
      router.push(redirectTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.';
      setApiError(message);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-8 shadow-2xl">
      <h2 className="mb-6 font-display text-lg font-semibold text-[#f8f8fc]">Entrar na conta</h2>

      {/* Erro da API */}
      {apiError && (
        <div className="mb-5 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
          <p className="text-sm text-[#e2718a]">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

        {/* E-mail */}
        <Input
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="seu@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Senha */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-white/80">
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className={[
                'w-full rounded-lg border bg-white/[0.04] px-3 py-2.5 pr-10 text-sm text-[#f8f8fc]',
                'placeholder-white/30 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-transparent',
                errors.password ? 'border-[#e2718a]' : 'border-white/10',
              ].join(' ')}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={-1}
              className="absolute inset-y-0 right-3 flex items-center text-white/45 hover:text-white/75 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-[#e2718a]">{errors.password.message}</p>
          )}
        </div>

        {/* Esqueceu a senha */}
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-gold-bright hover:text-gold transition-colors"
          >
            Esqueceu a senha?
          </Link>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      {/* Cadastro */}
      <p className="mt-6 text-center text-sm text-white/55">
        Não tem conta?{' '}
        <Link
          href="/register"
          className="font-medium text-gold-bright hover:text-gold transition-colors"
        >
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-ink px-4">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl shadow-gold mb-4 overflow-hidden">
            <Image src="/logo-mark.png" alt="Coach Play" width={48} height={48} priority />
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#f8f8fc]">Coach Play</h1>
          <p className="mt-1 text-sm text-white/55">Seu treinador digital de EA FC</p>
        </div>

        <Suspense
          fallback={
            <div className="rounded-2xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-8 text-center">
              <p className="text-white/55 text-sm">Carregando...</p>
            </div>
          }
        >
          <LoginCard />
        </Suspense>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-white/35">
          © {new Date().getFullYear()} Coach Play
        </p>
      </div>
    </main>
  );
}
