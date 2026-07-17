/**
 * State machine pura da sessão de captura local do Coach Play Desktop.
 *
 * Não depende do Electron nem de nenhuma API de captura — só modela as
 * transições válidas de estado, para poder ser testada sem GUI e para
 * refletir localmente (com resposta instantânea na UI) o mesmo contrato do
 * `CaptureSessionStatus` do backend (apps/api/prisma/schema.prisma).
 *
 * O backend continua sendo a fonte de verdade da sessão (é ele quem persiste);
 * esta classe só evita que a UI trave esperando um round-trip de rede para
 * saber se uma ação (pausar, retomar, etc.) é válida no estado atual.
 */

export type CaptureSessionStatus = 'starting' | 'running' | 'paused' | 'stopped' | 'failed';

export type CaptureSourceType = 'window' | 'monitor' | 'region';

export interface CaptureSessionSnapshot {
  status: CaptureSessionStatus;
  sourceType: CaptureSourceType | null;
  sourceName: string | null;
  captureFps: number;
  analysisFps: number;
  startedAt: number | null;
  endedAt: number | null;
  errorMessage: string | null;
}

export class InvalidTransitionError extends Error {
  constructor(from: CaptureSessionStatus, to: CaptureSessionStatus) {
    super(`Transição inválida: não é possível ir de "${from}" para "${to}"`);
    this.name = 'InvalidTransitionError';
  }
}

const VALID_TRANSITIONS: Record<CaptureSessionStatus, CaptureSessionStatus[]> = {
  starting: ['running', 'failed', 'stopped'],
  running: ['paused', 'stopped', 'failed'],
  paused: ['running', 'stopped', 'failed'],
  stopped: [],
  failed: [],
};

export class CaptureSessionState {
  private status: CaptureSessionStatus = 'starting';
  private sourceType: CaptureSourceType | null = null;
  private sourceName: string | null = null;
  private captureFps = 2;
  private analysisFps = 1;
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  private errorMessage: string | null = null;

  private assertTransition(next: CaptureSessionStatus): void {
    if (!VALID_TRANSITIONS[this.status].includes(next)) {
      throw new InvalidTransitionError(this.status, next);
    }
  }

  start(source: { type: CaptureSourceType; name: string; captureFps?: number; analysisFps?: number }): void {
    this.assertTransition('running');
    this.sourceType = source.type;
    this.sourceName = source.name;
    this.captureFps = source.captureFps ?? 2;
    this.analysisFps = source.analysisFps ?? 1;
    this.startedAt = Date.now();
    this.status = 'running';
  }

  pause(): void {
    this.assertTransition('paused');
    this.status = 'paused';
  }

  resume(): void {
    this.assertTransition('running');
    this.status = 'running';
  }

  stop(): void {
    this.assertTransition('stopped');
    this.status = 'stopped';
    this.endedAt = Date.now();
  }

  fail(reason: string): void {
    this.assertTransition('failed');
    this.status = 'failed';
    this.errorMessage = reason;
    this.endedAt = Date.now();
  }

  getSnapshot(): CaptureSessionSnapshot {
    return {
      status: this.status,
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      captureFps: this.captureFps,
      analysisFps: this.analysisFps,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      errorMessage: this.errorMessage,
    };
  }

  isActive(): boolean {
    return this.status === 'running' || this.status === 'paused';
  }
}
