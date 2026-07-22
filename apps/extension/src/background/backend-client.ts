import type { AuthenticatedUser, MatchSummary } from '../shared/messages';

// TODO: tornar configurável (options page) quando isso for além de MVP local —
// mesmo valor padrão já usado pelo apps/desktop (COACH_PLAY_API_URL).
const BASE_URL = 'http://localhost:3001/api/v1';

export class BackendClient {
  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('E-mail ou senha inválidos.');
      if (res.status === 429) throw new Error('Muitas tentativas — aguarde um minuto e tente novamente.');
      throw new Error(`Falha no login (HTTP ${res.status})`);
    }
    return res.json() as Promise<{ accessToken: string; user: AuthenticatedUser }>;
  }

  async listMatches(accessToken: string): Promise<MatchSummary[]> {
    const res = await fetch(`${BASE_URL}/matches?status=pending&limit=20`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Falha ao listar partidas (HTTP ${res.status})`);
    const body = (await res.json()) as { data: MatchSummary[] };
    return body.data;
  }

  async createMatch(accessToken: string, params: { title?: string }): Promise<MatchSummary> {
    const res = await fetch(`${BASE_URL}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Falha ao criar partida (HTTP ${res.status})`);
    return res.json() as Promise<MatchSummary>;
  }

  async createCaptureSession(
    accessToken: string,
    params: { matchId?: string; sourceType: 'window'; sourceName: string; captureFps: number; analysisFps: number },
  ): Promise<{ id: string; status: string }> {
    const res = await fetch(`${BASE_URL}/capture-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Falha ao criar sessão de captura (HTTP ${res.status})`);
    return res.json() as Promise<{ id: string; status: string }>;
  }

  async transitionSession(
    accessToken: string,
    sessionId: string,
    action: 'pause' | 'resume' | 'stop',
    errorMessage?: string,
  ): Promise<{ id: string; status: string }> {
    const res = await fetch(`${BASE_URL}/capture-sessions/${sessionId}/${action}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(errorMessage ? { errorMessage } : {}),
    });
    if (!res.ok) throw new Error(`Falha ao atualizar sessão (HTTP ${res.status})`);
    return res.json() as Promise<{ id: string; status: string }>;
  }

  async uploadFrame(accessToken: string, sessionId: string, buffer: ArrayBuffer, timestampMs: number): Promise<void> {
    const form = new FormData();
    form.append('timestampMs', String(timestampMs));
    form.append('frame', new Blob([buffer], { type: 'image/png' }), 'frame.png');

    const res = await fetch(`${BASE_URL}/capture-sessions/${sessionId}/frames`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Falha ao enviar frame (HTTP ${res.status})`);
  }
}
