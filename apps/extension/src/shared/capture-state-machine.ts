export type CaptureState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'reconnecting'
  | 'stopping'
  | 'stopped'
  | 'failed';

export class InvalidCaptureTransitionError extends Error {
  constructor(from: CaptureState, to: CaptureState) {
    super(`Transição inválida: não é possível ir de "${from}" para "${to}"`);
    this.name = 'InvalidCaptureTransitionError';
  }
}

const VALID_TRANSITIONS: Record<CaptureState, CaptureState[]> = {
  idle: ['starting', 'stopped', 'failed'],
  starting: ['running', 'failed', 'stopping'],
  running: ['paused', 'reconnecting', 'stopping', 'failed'],
  paused: ['running', 'reconnecting', 'stopping', 'failed'],
  reconnecting: ['running', 'paused', 'stopping', 'failed'],
  stopping: ['stopped', 'failed'],
  stopped: ['starting'],
  failed: ['starting'],
};

export interface CaptureStateSnapshot {
  state: CaptureState;
  errorMessage: string | null;
}

export class CaptureSessionState {
  private status: CaptureState = 'idle';
  // Pra saber, ao reconectar com sucesso, se devemos voltar a 'running' ou a 'paused' —
  // uma sessão pausada que perde o stream ainda deve estar pausada depois de reconectar.
  private preReconnectState: CaptureState = 'running';
  private errorMessage: string | null = null;

  private transition(next: CaptureState): void {
    if (!VALID_TRANSITIONS[this.status].includes(next)) {
      throw new InvalidCaptureTransitionError(this.status, next);
    }
    this.status = next;
  }

  begin(): void {
    this.errorMessage = null;
    this.transition('starting');
  }

  markRunning(): void {
    this.transition('running');
  }

  markStartFailed(reason: string): void {
    this.errorMessage = reason;
    this.transition('failed');
  }

  pause(): void {
    this.transition('paused');
  }

  resume(): void {
    this.transition('running');
  }

  markStreamLost(): void {
    this.preReconnectState = this.status === 'paused' ? 'paused' : 'running';
    this.transition('reconnecting');
  }

  markReconnected(): void {
    this.transition(this.preReconnectState);
  }

  markReconnectFailed(reason: string): void {
    this.errorMessage = reason;
    this.transition('failed');
  }

  requestStop(): void {
    if (this.status === 'idle') return;
    this.transition('stopping');
  }

  markStopped(): void {
    this.transition('stopped');
  }

  fail(reason: string): void {
    this.errorMessage = reason;
    this.transition('failed');
  }

  getSnapshot(): CaptureStateSnapshot {
    return { state: this.status, errorMessage: this.errorMessage };
  }

  isActive(): boolean {
    return this.status === 'running' || this.status === 'paused' || this.status === 'reconnecting';
  }
}
