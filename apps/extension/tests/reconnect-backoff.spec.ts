import { getBackoffDelayMs, RECONNECT_MAX_ATTEMPTS } from '../src/shared/reconnect-backoff';
import { RECONNECT_BACKOFF_MS } from '../src/shared/capture-config';

describe('getBackoffDelayMs', () => {
  it('retorna os delays configurados em ordem para os primeiros N tentativas', () => {
    RECONNECT_BACKOFF_MS.forEach((expected, attempt) => {
      expect(getBackoffDelayMs(attempt)).toBe(expected);
    });
  });

  it('retorna null além do número máximo de tentativas (nunca tenta pra sempre)', () => {
    expect(getBackoffDelayMs(RECONNECT_MAX_ATTEMPTS)).toBeNull();
    expect(getBackoffDelayMs(RECONNECT_MAX_ATTEMPTS + 10)).toBeNull();
  });

  it('RECONNECT_MAX_ATTEMPTS bate com o tamanho da tabela de backoff', () => {
    expect(RECONNECT_MAX_ATTEMPTS).toBe(RECONNECT_BACKOFF_MS.length);
  });
});
