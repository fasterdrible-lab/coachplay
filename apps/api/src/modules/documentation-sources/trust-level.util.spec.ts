import { assertTrustLevelAllowed, DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE } from './trust-level.util';

describe('DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE', () => {
  it('Konami (OFFICIAL) tem default AUTHORITATIVE', () => {
    expect(DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE.OFFICIAL).toBe('AUTHORITATIVE');
  });

  it('os outros 3 tipos nunca têm default AUTHORITATIVE', () => {
    expect(DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE.VERIFIED_COMMUNITY).not.toBe('AUTHORITATIVE');
    expect(DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE.COMMUNITY).not.toBe('AUTHORITATIVE');
    expect(DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE.MANUAL).not.toBe('AUTHORITATIVE');
  });
});

describe('assertTrustLevelAllowed (Tarefa 2 — impede fonte comunitária virar AUTHORITATIVE)', () => {
  it('permite OFFICIAL + AUTHORITATIVE', () => {
    expect(() => assertTrustLevelAllowed('OFFICIAL', 'AUTHORITATIVE')).not.toThrow();
  });

  it('permite qualquer sourceType com trustLevel não-AUTHORITATIVE', () => {
    expect(() => assertTrustLevelAllowed('COMMUNITY', 'MEDIUM')).not.toThrow();
    expect(() => assertTrustLevelAllowed('VERIFIED_COMMUNITY', 'HIGH')).not.toThrow();
    expect(() => assertTrustLevelAllowed('MANUAL', 'LOW')).not.toThrow();
  });

  it.each(['VERIFIED_COMMUNITY', 'COMMUNITY', 'MANUAL'] as const)(
    'lança erro se %s tentar virar AUTHORITATIVE',
    (sourceType) => {
      expect(() => assertTrustLevelAllowed(sourceType, 'AUTHORITATIVE')).toThrow(/AUTHORITATIVE/);
    },
  );
});
