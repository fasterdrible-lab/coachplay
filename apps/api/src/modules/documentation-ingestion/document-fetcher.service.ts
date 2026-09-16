import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { checkSourceUrlSafety } from '../documentation-sources/url-safety.util';
import { isDomainAllowed, parseAllowedDomains } from '../documentation-sources/allowed-domains.util';

export class DocumentFetchError extends Error {}

export interface FetchDocumentResult {
  html: string;
  finalUrl: string;
  httpStatus: number;
  redirectCount: number;
  attempts: number;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Responsável só pelo "fetch" do fluxo da Tarefa 4 — sanitização/normalização/hash/comparação/
 * armazenamento vivem em `DocumentationIngestionService` e (reaproveitado) `GameDocumentsService`
 * (Tarefa 3). Proteção contra SSRF é checada de novo A CADA salto de redirecionamento — nunca
 * confia que um redirect de um domínio já validado aponte pra outro lugar seguro.
 */
@Injectable()
export class DocumentFetcherService {
  constructor(private readonly config: ConfigService) {}

  async fetchDocument(url: string): Promise<FetchDocumentResult> {
    const timeoutMs = this.config.get<number>('DOCUMENTATION_FETCH_TIMEOUT_MS', 10000);
    const maxRetries = this.config.get<number>('DOCUMENTATION_FETCH_MAX_RETRIES', 2);
    const maxRedirects = this.config.get<number>('DOCUMENTATION_FETCH_MAX_REDIRECTS', 5);
    const maxBytes = this.config.get<number>('DOCUMENTATION_FETCH_MAX_BYTES', 2_000_000);
    const retryDelayMs = this.config.get<number>('DOCUMENTATION_FETCH_RETRY_DELAY_MS', 300);
    const userAgent = this.config.get<string>('DOCUMENTATION_FETCH_USER_AGENT', 'CoachPlay-DocBot/1.0');
    const allowedDomains = parseAllowedDomains(this.config.get<string>('DOCUMENTATION_SOURCE_ALLOWED_DOMAINS'));

    let currentUrl = url;
    let redirectCount = 0;
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      this.assertUrlIsSafeToFetch(currentUrl, allowedDomains);

      let response: Response;
      try {
        response = await this.fetchWithTimeout(currentUrl, userAgent, timeoutMs);
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) {
          throw new DocumentFetchError(
            `Falha ao buscar "${currentUrl}" após ${attempt} tentativa(s): ${(err as Error).message}`,
          );
        }
        await this.delay(retryDelayMs);
        continue;
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw new DocumentFetchError(
            `Limite de ${maxRedirects} redirecionamentos excedido (possível loop) a partir de "${url}"`,
          );
        }
        const location = response.headers.get('location');
        if (!location) {
          throw new DocumentFetchError(`Redirecionamento (${response.status}) sem header Location: "${currentUrl}"`);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (response.status >= 500) {
        attempt++;
        if (attempt > maxRetries) {
          throw new DocumentFetchError(`Servidor retornou ${response.status} após ${attempt} tentativa(s): "${currentUrl}"`);
        }
        await this.delay(retryDelayMs);
        continue;
      }

      if (response.status !== 200) {
        throw new DocumentFetchError(`Status HTTP ${response.status} inesperado ao buscar "${currentUrl}"`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader && Number(contentLengthHeader) > maxBytes) {
        throw new DocumentFetchError(`Conteúdo de "${currentUrl}" excede o limite de ${maxBytes} bytes (Content-Length)`);
      }

      const html = await this.readBodyWithLimit(response, maxBytes, currentUrl);
      return { html, finalUrl: currentUrl, httpStatus: response.status, redirectCount, attempts: attempt + 1 };
    }
  }

  private assertUrlIsSafeToFetch(url: string, allowedDomains: string[]): void {
    const safety = checkSourceUrlSafety(url);
    if (!safety.safe) {
      throw new DocumentFetchError(`URL insegura ("${url}"): ${safety.reason}`);
    }
    if (!isDomainAllowed(safety.domain, allowedDomains)) {
      throw new DocumentFetchError(`Domínio "${safety.domain}" não está na allowlist (DOCUMENTATION_SOURCE_ALLOWED_DOMAINS)`);
    }
  }

  private async fetchWithTimeout(url: string, userAgent: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        redirect: 'manual',
        headers: { 'User-Agent': userAgent },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Nunca confia em Content-Length sozinho (pode faltar ou mentir) — corta o download assim que
   * o total de bytes lidos ultrapassa o limite, mesmo que o servidor não pare de mandar dados. */
  private async readBodyWithLimit(response: Response, maxBytes: number, url: string): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      return '';
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new DocumentFetchError(`Conteúdo de "${url}" excede o limite de ${maxBytes} bytes durante o download`);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf-8');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
