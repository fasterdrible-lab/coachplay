import React, { useEffect, useState } from 'react';
import type { MatchSummary } from '../../main/backend-client';

interface MatchSelectorProps {
  onSelect: (matchId: string) => void;
}

export function MatchSelector({ onSelect }: MatchSelectorProps) {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  async function refresh() {
    setIsLoading(true);
    setError('');
    try {
      setMatches(await window.coachPlay.matches.list());
    } catch {
      setError('Não foi possível carregar suas partidas.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsCreating(true);
    try {
      const match = await window.coachPlay.matches.create({ title: title.trim() || undefined });
      onSelect(match.id);
    } catch {
      setError('Não foi possível criar a partida. Tente novamente.');
      setIsCreating(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Vincular a uma partida</h2>
      <p style={{ color: 'rgba(248,248,252,0.55)' }}>
        Escolha uma partida pendente para receber os eventos e dicas desta captura, ou crie uma nova agora.
      </p>

      {error && <p style={{ color: '#e2718a' }}>{error}</p>}

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Nome da nova partida (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" type="submit" disabled={isCreating}>
          {isCreating ? 'Criando...' : 'Nova partida'}
        </button>
      </form>

      {isLoading && <p>Carregando partidas...</p>}

      {!isLoading && matches.length === 0 && (
        <p style={{ color: 'rgba(248,248,252,0.45)' }}>
          Nenhuma partida pendente encontrada. Crie uma nova acima para continuar.
        </p>
      )}

      {!isLoading && matches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map((match) => (
            <div
              key={match.id}
              className="source-item"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => onSelect(match.id)}
            >
              <div>
                <p style={{ margin: 0 }}>{match.title || 'Partida sem título'}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(248,248,252,0.45)' }}>
                  {match.gameMode ?? 'Modo não informado'} ·{' '}
                  {new Date(match.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => onSelect(match.id)}>
                Usar esta
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
