import { isIP } from 'net';

export interface UrlSafetyResult {
  safe: boolean;
  /** Hostname em minúsculas, extraído da URL — sempre presente mesmo quando `safe: false`, pra
   * mensagem de erro; string vazia só quando a URL nem chegou a ser parseável. */
  domain: string;
  reason?: string;
}

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0']);

/** IPv4 privado/reservado (RFC 1918, loopback, link-local — inclui 169.254.169.254, o alvo
 * clássico de SSRF pra metadata de cloud). */
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC 1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 169 && b === 254) return true; // link-local (metadata de nuvem)
  if (a === 0) return true; // "this network"
  return false;
}

/**
 * Camada de segurança CONTRA SSRF pra `DocumentationSource.url` — núcleo implementado já na
 * Tarefa 2 (não esperar a Tarefa 25), conforme recomendado em
 * docs/efootball/documentation-architecture.md, risco 3. Só valida a SINTAXE da URL — não faz
 * nenhuma requisição de rede nem resolve DNS (isso é responsabilidade do coletor, Tarefa 4/25,
 * no momento real do fetch, quando o resultado da resolução pode ter mudado desde o cadastro).
 *
 * Bloqueia por design, sem exceção: protocolo != https, hosts de loopback/link-local conhecidos,
 * e QUALQUER literal de IP (v4 ou v6, público ou privado) — fonte de documentação deve sempre
 * ser identificada por nome de domínio, nunca por IP.
 */
export function checkSourceUrlSafety(rawUrl: string): UrlSafetyResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, domain: '', reason: 'URL inválida — não foi possível interpretar' };
  }

  if (parsed.protocol !== 'https:') {
    return { safe: false, domain: parsed.hostname, reason: `Protocolo "${parsed.protocol}" não permitido — só https:// é aceito` };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, domain: hostname, reason: `Host "${hostname}" bloqueado (loopback/local)` };
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    if (isPrivateOrReservedIPv4(hostname)) {
      return { safe: false, domain: hostname, reason: `Endereço IPv4 privado/reservado bloqueado: ${hostname}` };
    }
    return { safe: false, domain: hostname, reason: 'Literal de IP não é permitido — use um nome de domínio' };
  }
  if (ipVersion === 6) {
    return { safe: false, domain: hostname, reason: 'Literal de IPv6 não é permitido — use um nome de domínio' };
  }

  return { safe: true, domain: hostname };
}
