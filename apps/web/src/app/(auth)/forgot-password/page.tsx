'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

const schema = z.object({
  email: z.string().email('Digite um e-mail válido'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    // Sempre exibe confirmação independente do resultado (anti-enumeração)
    await api
      .post('/auth/forgot-password', { email: data.email }, { skipAuth: true })
      .catch(() => {});
    setSubmittedEmail(data.email);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Verifique seu e-mail</h2>
            <p className="text-sm text-gray-400 mb-1">
              Se <span className="text-gray-200 font-medium">{submittedEmail}</span> estiver
              cadastrado, você receberá um link para redefinir sua senha.
            </p>
            <p className="text-xs text-gray-500 mt-3 mb-6">
              O link expira em 1 hora. Verifique também a pasta de spam.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Coach Play</h1>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
          <h2 className="mb-1 text-lg font-semibold text-white">Recuperar senha</h2>
          <p className="mb-6 text-sm text-gray-400">
            Digite seu e-mail e enviaremos um link para redefinir sua senha.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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

            <Button type="submit" isLoading={isSubmitting} className="w-full">
              {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
