import { DocumentFetcherService, DocumentFetchError } from './document-fetcher.service';

describe('DocumentFetcherService (Tarefa 4)', () => {
  const ALLOWED = 'support.konami.com';
  const URL_OK = `https://${ALLOWED}/efootball/controls`;

  const configValues: Record<string, unknown> = {
    DOCUMENTATION_FETCH_TIMEOUT_MS: 80,
    DOCUMENTATION_FETCH_MAX_RETRIES: 2,
    DOCUMENTATION_FETCH_MAX_REDIRECTS: 3,
    DOCUMENTATION_FETCH_MAX_BYTES: 2_000_000,
    DOCUMENTATION_FETCH_RETRY_DELAY_MS: 5,
    DOCUMENTATION_FETCH_USER_AGENT: 'CoachPlay-DocBot/1.0',
    DOCUMENTATION_SOURCE_ALLOWED_DOMAINS: ALLOWED,
  };

  const config = { get: jest.fn((key: string, def?: unknown) => (key in configValues ? configValues[key] : def)) };

  let service: DocumentFetcherService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new DocumentFetcherService(config as any);
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('200 OK: retorna o html e a url final', async () => {
    fetchMock.mockResolvedValue(new Response('<p>Segure R2</p>', { status: 200 }));

    const result = await service.fetchDocument(URL_OK);

    expect(result.html).toContain('Segure R2');
    expect(result.finalUrl).toBe(URL_OK);
    expect(result.httpStatus).toBe(200);
    expect(result.redirectCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('404: lança DocumentFetchError sem tentar de novo', async () => {
    fetchMock.mockResolvedValue(new Response('not found', { status: 404 }));

    await expect(service.fetchDocument(URL_OK)).rejects.toThrow(DocumentFetchError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('500: tenta de novo (retry limitado) e falha depois de esgotar as tentativas', async () => {
    fetchMock.mockResolvedValue(new Response('erro interno', { status: 500 }));

    await expect(service.fetchDocument(URL_OK)).rejects.toThrow(DocumentFetchError);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 tentativa inicial + 2 retries
  });

  it('500 seguido de 200: recupera no retry', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('erro', { status: 500 }))
      .mockResolvedValueOnce(new Response('<p>ok agora</p>', { status: 200 }));

    const result = await service.fetchDocument(URL_OK);

    expect(result.html).toContain('ok agora');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('timeout: aborta e conta como falha retryable, lançando após esgotar tentativas', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await expect(service.fetchDocument(URL_OK)).rejects.toThrow(DocumentFetchError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 15000);

  it('redirect: segue o Location e revalida segurança/allowlist no destino', async () => {
    const target = `https://${ALLOWED}/efootball/controls-v2`;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: target } }))
      .mockResolvedValueOnce(new Response('<p>versão nova</p>', { status: 200 }));

    const result = await service.fetchDocument(URL_OK);

    expect(result.finalUrl).toBe(target);
    expect(result.redirectCount).toBe(1);
    expect(result.html).toContain('versão nova');
  });

  it('redirect loop: excede o limite de redirecionamentos e lança erro explícito', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { Location: url.includes('/a') ? `https://${ALLOWED}/b` : `https://${ALLOWED}/a` },
        }),
      ),
    );

    await expect(service.fetchDocument(`https://${ALLOWED}/a`)).rejects.toThrow(/redirecionamentos/i);
  });

  it('redirect para domínio fora da allowlist: bloqueado antes de seguir', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: 'https://evil.example.com/steal' } }),
    );

    await expect(service.fetchDocument(URL_OK)).rejects.toThrow(/allowlist/i);
  });

  it('redirect para IP privado: bloqueado pela checagem de SSRF no salto', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: 'https://169.254.169.254/latest/meta-data' } }),
    );

    await expect(service.fetchDocument(URL_OK)).rejects.toThrow(/insegura/i);
  });

  it('HTML vazio: não lança, apenas retorna string vazia (validação de conteúdo é do orquestrador)', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    const result = await service.fetchDocument(URL_OK);

    expect(result.html).toBe('');
  });

  it('conteúdo enorme: aborta o download ao ultrapassar o limite de bytes', async () => {
    config.get.mockImplementation((key: string, def?: unknown) =>
      key === 'DOCUMENTATION_FETCH_MAX_BYTES' ? 10 : key in configValues ? configValues[key] : def,
    );
    fetchMock.mockResolvedValue(new Response('x'.repeat(1000), { status: 200 }));

    await expect(service.fetchDocument(URL_OK)).rejects.toThrow(/limite de 10 bytes/);
  });

  it('URL insegura (protocolo não-https): bloqueada antes de qualquer fetch', async () => {
    await expect(service.fetchDocument('http://support.konami.com/x')).rejects.toThrow(DocumentFetchError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('domínio fora da allowlist: bloqueado antes de qualquer fetch', async () => {
    await expect(service.fetchDocument('https://random-blog.example.com/x')).rejects.toThrow(/allowlist/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
