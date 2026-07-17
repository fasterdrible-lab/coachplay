import { readFile } from 'fs/promises';

/**
 * Cliente HTTP para falar com apps/api. O token de acesso vive só em memória
 * do processo main (nunca gravado em disco em texto plano) — ver
 * docs/REMOTE_PLAY_CAPTURE.md, Plano de privacidade.
 */
export class BackendClient {
  private accessToken: string | null = null;

  constructor(private readonly baseUrl: string) {}

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  private authHeaders(): Record<string, string> {
    if (!this.accessToken) throw new Error('Não autenticado — faça login antes de iniciar a captura');
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async login(email: string, password: string): Promise<{ accessToken: string; user: unknown }> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Falha no login (HTTP ${res.status})`);
    const body = (await res.json()) as { accessToken: string; user: unknown };
    this.accessToken = body.accessToken;
    return body;
  }

  async createCaptureSession(params: {
    matchId?: string;
    sourceType: string;
    sourceName: string;
    resolutionWidth?: number;
    resolutionHeight?: number;
    captureFps?: number;
    analysisFps?: number;
  }): Promise<{ id: string; status: string }> {
    const res = await fetch(`${this.baseUrl}/capture-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Falha ao criar sessão de captura (HTTP ${res.status})`);
    return res.json() as Promise<{ id: string; status: string }>;
  }

  async transitionSession(
    sessionId: string,
    action: 'pause' | 'resume' | 'stop',
    errorMessage?: string,
  ): Promise<{ id: string; status: string }> {
    const res = await fetch(`${this.baseUrl}/capture-sessions/${sessionId}/${action}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(errorMessage ? { errorMessage } : {}),
    });
    if (!res.ok) throw new Error(`Falha ao atualizar sessão (HTTP ${res.status})`);
    return res.json() as Promise<{ id: string; status: string }>;
  }

  async uploadFrame(sessionId: string, framePath: string, timestampMs: number): Promise<void> {
    const buffer = await readFile(framePath);
    const form = new FormData();
    form.append('timestampMs', String(timestampMs));
    form.append('frame', new Blob([buffer], { type: 'image/png' }), 'frame.png');

    const res = await fetch(`${this.baseUrl}/capture-sessions/${sessionId}/frames`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: form,
    });
    if (!res.ok) throw new Error(`Falha ao enviar frame (HTTP ${res.status})`);
  }
}
