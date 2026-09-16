import { isDomainAllowed, parseAllowedDomains } from './allowed-domains.util';

describe('parseAllowedDomains', () => {
  it('separa por vírgula, remove espaços e normaliza pra minúsculas', () => {
    expect(parseAllowedDomains(' Konami.com, Support.Konami.com ,other.org')).toEqual([
      'konami.com',
      'support.konami.com',
      'other.org',
    ]);
  });

  it('sem variável configurada, retorna lista vazia (deny-by-default)', () => {
    expect(parseAllowedDomains(undefined)).toEqual([]);
    expect(parseAllowedDomains(null)).toEqual([]);
    expect(parseAllowedDomains('')).toEqual([]);
  });
});

describe('isDomainAllowed', () => {
  const allowed = ['konami.com', 'community-wiki.org'];

  it('autoriza domínio exato', () => {
    expect(isDomainAllowed('konami.com', allowed)).toBe(true);
  });

  it('autoriza subdomínio de um domínio permitido', () => {
    expect(isDomainAllowed('support.konami.com', allowed)).toBe(true);
  });

  it('rejeita domínio não relacionado, mesmo que pareça (typosquatting)', () => {
    expect(isDomainAllowed('notkonami.com', allowed)).toBe(false);
  });

  it('rejeita domínio que só termina com o nome permitido, sem ser subdomínio de verdade', () => {
    expect(isDomainAllowed('konami.com.evil.net', allowed)).toBe(false);
  });

  it('lista vazia nunca autoriza nada', () => {
    expect(isDomainAllowed('konami.com', [])).toBe(false);
  });
});
