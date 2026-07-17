'use client';

import { Suspense, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Check, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/button';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Ao menos uma letra maiúscula')
      .regex(/[a-z]/, 'Ao menos uma letra minúscula')
      .regex(/\d/, 'Ao menos um número'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

const passwordChecks = [
  { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Número', test: (p: string) => /\d/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
      {passwordChecks.map(({ label, test }) => {
        const ok = test(password);
        return (
          <li
            key={label}
            className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-[#6fcf97]' : 'text-[#f8f8fc]/45'}`}
          >
            {ok ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
            {label}
          </li>
        );
      })}
    </ul>
  );
}

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' });

  if (!token) {
    return (
      <div className="rounded-2xl border border-[#e0954a]/30 bg-[#e0954a]/10 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-[#e0954a] mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-[#f8f8fc] mb-2">Link inválido</h2>
        <p className="text-sm text-[#f8f8fc]/55 mb-5">
          Este link de redefinição é inválido ou está incompleto.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-gold-bright hover:text-gold transition-colors"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-8 shadow-xl text-center">
        <CheckCircle className="h-12 w-12 text-[#6fcf97] mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[#f8f8fc] mb-2">Senha redefinida!</h2>
        <p className="text-sm text-[#f8f8fc]/55 mb-6">
          Sua senha foi atualizada com sucesso. Faça login com a nova senha.
        </p>
        <Button onClick={() => router.push('/login')} className="w-full">
          Ir para o login
        </Button>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    try {
      setApiError('');
      await api.post(
        '/auth/reset-password',
        { token, password: data.password },
        { skipAuth: true },
      );
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao redefinir senha. Tente novamente.';
      setApiError(message);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-8 shadow-xl">
      <h2 className="mb-1 text-lg font-semibold text-[#f8f8fc]">Redefinir senha</h2>
      <p className="mb-6 text-sm text-[#f8f8fc]/55">Escolha uma nova senha segura para sua conta.</p>

      {apiError && (
        <div className="mb-5 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
          <p className="text-sm text-[#e2718a]">{apiError}</p>
          {apiError.toLowerCase().includes('expirado') && (
            <Link
              href="/forgot-password"
              className="mt-1 block text-xs text-gold-bright hover:text-gold transition-colors"
            >
              Solicitar novo link →
            </Link>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Nova senha */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-[#f8f8fc]/80">
            Nova senha
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
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
              className="absolute inset-y-0 right-3 flex items-center text-[#f8f8fc]/55 hover:text-[#f8f8fc]/75 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-[#e2718a]">{errors.password.message}</p>
          )}
          <PasswordStrength password={passwordValue} />
        </div>

        {/* Confirmar senha */}
        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#f8f8fc]/80">
            Confirmar nova senha
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className={[
                'w-full rounded-lg border bg-white/[0.04] px-3 py-2.5 pr-10 text-sm text-[#f8f8fc]',
                'placeholder-white/30 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-transparent',
                errors.confirmPassword ? 'border-[#e2718a]' : 'border-white/10',
              ].join(' ')}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
              tabIndex={-1}
              className="absolute inset-y-0 right-3 flex items-center text-[#f8f8fc]/55 hover:text-[#f8f8fc]/75 transition-colors"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-[#e2718a]">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" isLoading={isSubmitting} className="w-full mt-2">
          {isSubmitting ? 'Salvando...' : 'Redefinir senha'}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-ink px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-gold-bright to-gold shadow-gold mb-4">
            <span className="text-[#14100a] text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">Coach Play</h1>
        </div>

        <Suspense
          fallback={
            <div className="rounded-2xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-8 text-center">
              <p className="text-[#f8f8fc]/55 text-sm">Carregando...</p>
            </div>
          }
        >
          <ResetForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-[#f8f8fc]/35">
          © {new Date().getFullYear()} Coach Play
        </p>
      </div>
    </main>
  );
}
