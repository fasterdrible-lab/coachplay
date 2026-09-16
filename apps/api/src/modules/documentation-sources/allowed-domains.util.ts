/**
 * Allowlist de domínios autorizados a virar `DocumentationSource` — lida via
 * `DOCUMENTATION_SOURCE_ALLOWED_DOMAINS` (`ConfigService`, lista separada por vírgula),
 * deny-by-default: sem a variável configurada, NENHUM domínio é autorizado. Decisão deliberada
 * (docs/efootball/documentation-architecture.md, risco 1) — este módulo nunca assume/adivinha um
 * domínio real da Konami ou de qualquer fonte comunitária; cabe a um operador configurar
 * explicitamente quais domínios são confiáveis antes de qualquer fonte poder ser cadastrada.
 */
export function parseAllowedDomains(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/** Casa domínio exato ou subdomínio de um domínio autorizado (ex.: `allowedDomains: ['konami.com']`
 * também autoriza `support.konami.com`, mas nunca `notkonami.com` nem `konami.com.evil.net`). */
export function isDomainAllowed(domain: string, allowedDomains: string[]): boolean {
  const normalized = domain.toLowerCase();
  return allowedDomains.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}
