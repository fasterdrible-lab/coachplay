import { checkSourceUrlSafety } from './url-safety.util';

describe('checkSourceUrlSafety (Tarefa 2 — segurança do coletor, núcleo)', () => {
  it('aceita uma URL https com domínio público', () => {
    const result = checkSourceUrlSafety('https://support.example.com/efootball/controls');

    expect(result).toEqual({ safe: true, domain: 'support.example.com' });
  });

  it('rejeita URL inválida (não parseável)', () => {
    const result = checkSourceUrlSafety('não é uma url');

    expect(result.safe).toBe(false);
    expect(result.reason).toContain('URL inválida');
  });

  it.each(['http://example.com', 'ftp://example.com', 'file:///etc/passwd'])(
    'rejeita protocolo != https (%s)',
    (url) => {
      const result = checkSourceUrlSafety(url);

      expect(result.safe).toBe(false);
      expect(result.reason).toContain('Protocolo');
    },
  );

  it.each(['https://localhost/x', 'https://0.0.0.0/x'])('rejeita hostname de loopback/local (%s)', (url) => {
    const result = checkSourceUrlSafety(url);

    expect(result.safe).toBe(false);
    expect(result.reason).toContain('bloqueado');
  });

  it.each([
    'https://127.0.0.1/x',
    'https://10.0.0.5/x',
    'https://172.16.0.1/x',
    'https://192.168.1.1/x',
    'https://169.254.169.254/x', // metadata de nuvem — alvo clássico de SSRF
  ])('rejeita endereço IPv4 privado/reservado (%s)', (url) => {
    const result = checkSourceUrlSafety(url);

    expect(result.safe).toBe(false);
    expect(result.reason).toContain('privado/reservado');
  });

  it('rejeita literal de IPv4 público (exige nome de domínio)', () => {
    const result = checkSourceUrlSafety('https://8.8.8.8/x');

    expect(result.safe).toBe(false);
    expect(result.reason).toContain('nome de domínio');
  });

  it('rejeita literal de IPv6', () => {
    const result = checkSourceUrlSafety('https://[::1]/x');

    expect(result.safe).toBe(false);
    expect(result.reason).toContain('IPv6');
  });

  it('normaliza o domínio pra minúsculas', () => {
    const result = checkSourceUrlSafety('https://SUPPORT.EXAMPLE.COM/x');

    expect(result.domain).toBe('support.example.com');
  });
});
