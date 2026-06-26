'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
            className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-green-400' : 'text-gray-500'}`}
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
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4 py-12">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Coach Play</h1>
          <p className="mt-1 text-sm text-gray-400">Comece a analisar suas partidas gratuitamente</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
          <h2 className="mb-6 text-lg font-semibold text-white">Criar conta</h2>

          {/* Erro da API */}
          {apiError && (
            <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{apiError}</p>
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={[
                    'w-full rounded-lg border bg-gray-800 px-3 py-2.5 pr-10 text-sm text-white',
                    'placeholder-gray-500 transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    errors.password ? 'border-red-500' : 'border-gray-700',
                  ].join(' ')}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
              <PasswordStrength password={passwordValue} />
            </div>

            {/* Confirmar senha */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={[
                    'w-full rounded-lg border bg-gray-800 px-3 py-2.5 pr-10 text-sm text-white',
                    'placeholder-gray-500 transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-700',
                  ].join(' ')}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
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
          <p className="mt-4 text-center text-xs text-gray-500">
            Ao criar sua conta você concorda com nossos{' '}
            <span className="text-gray-400">Termos de Uso</span>.
          </p>

          {/* Login */}
          <div className="mt-5 border-t border-gray-800 pt-5">
            <p className="text-center text-sm text-gray-400">
              Já tem conta?{' '}
              <Link
                href="/login"
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Entrar
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} Coach Play
        </p>
      </div>
    </main>
  );
}
