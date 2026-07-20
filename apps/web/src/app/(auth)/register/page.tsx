'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { useAuth } from '../../../providers/auth-provider';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Nome deve ter ao menos 2 caracteres')
      .max(100, 'Nome muito longo'),
    email: z.string().email('Digite um e-mail válido'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Deve ter ao menos uma letra maiúscula')
      .regex(/[a-z]/, 'Deve ter ao menos uma letra minúscula')
      .regex(/\d/, 'Deve ter ao menos um número'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

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
            {ok ? (
              <Check className="h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <X className="h-3 w-3 shrink-0" aria-hidden />
            )}
            {label}
          </li>
        );
      })}
    </ul>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();

  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setApiError('');
      await registerUser(data.name, data.email, data.password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.';
      setApiError(message);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-ink px-4 py-12">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl shadow-gold mb-4 overflow-hidden">
            <Image src="/logo-mark.png" alt="Coach Play" width={48} height={48} priority />
          </div>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">Coach Play</h1>
          <p className="mt-1 text-sm text-[#f8f8fc]/55">Comece a analisar suas partidas gratuitamente</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-8 shadow-xl">
          <h2 className="mb-6 text-lg font-semibold text-[#f8f8fc]">Criar conta</h2>

          {/* Erro da API */}
          {apiError && (
            <div className="mb-5 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
              <p className="text-sm text-[#e2718a]">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

            {/* Nome */}
            <Input
              id="name"
              label="Nome"
              type="text"
              autoComplete="name"
              autoFocus
              placeholder="Seu nome"
              error={errors.name?.message}
              {...register('name')}
            />

            {/* E-mail */}
            <Input
              id="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />

            {/* Senha */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-[#f8f8fc]/80">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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
              <PasswordStrength password={passwordValue} />
            </div>

            {/* Confirmar senha */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#f8f8fc]/80">
                Confirmar senha
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
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-[#e2718a]">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="w-full mt-2"
            >
              {isSubmitting ? 'Criando conta...' : 'Criar conta grátis'}
            </Button>
          </form>

          {/* Termos */}
          <p className="mt-4 text-center text-xs text-[#f8f8fc]/45">
            Ao criar sua conta você concorda com nossos{' '}
            <span className="text-[#f8f8fc]/55">Termos de Uso</span>.
          </p>

          {/* Login */}
          <div className="mt-5 border-t border-white/[0.08] pt-5">
            <p className="text-center text-sm text-[#f8f8fc]/55">
              Já tem conta?{' '}
              <Link
                href="/login"
                className="font-medium text-gold-bright hover:text-gold transition-colors"
              >
                Entrar
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[#f8f8fc]/35">
          © {new Date().getFullYear()} Coach Play
        </p>
      </div>
    </main>
  );
}
