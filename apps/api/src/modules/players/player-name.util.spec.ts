import { normalizePlayerName } from './player-name.util';

describe('normalizePlayerName', () => {
  it('remove acentos e coloca em minúsculas', () => {
    expect(normalizePlayerName('Éder Militão')).toBe('eder militao');
  });

  it('mantém substring buscável para apelidos (Kvara → Kvaratskhelia)', () => {
    const full = normalizePlayerName('Khvicha Kvaratskhelia');
    expect(full).toContain(normalizePlayerName('Kvara'));
  });

  it('remove espaços extras nas pontas', () => {
    expect(normalizePlayerName('  Neymar  ')).toBe('neymar');
  });
});
