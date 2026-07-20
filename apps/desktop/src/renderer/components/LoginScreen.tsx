import React, { useState } from 'react';
import type { AuthenticatedUser } from '../../main/backend-client';

interface LoginScreenProps {
  onSuccess: (user: AuthenticatedUser) => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const user = await window.coachPlay.auth.login(email, password);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h1 style={{ marginTop: 0 }}>Entrar</h1>
      <p style={{ color: 'rgba(248,248,252,0.55)' }}>
        Use a mesma conta do Coach Play para vincular a captura ao seu perfil.
      </p>

      {error && <p style={{ color: '#e2718a' }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
