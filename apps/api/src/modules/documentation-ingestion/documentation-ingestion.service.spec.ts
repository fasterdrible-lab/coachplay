import { BadRequestException } from '@nestjs/common';
import { DocumentationIngestionService } from './documentation-ingestion.service';
import { DocumentFetcherService } from './document-fetcher.service';
import { GameDocumentsService } from '../game-documents/game-documents.service';

describe('DocumentationIngestionService (Tarefa 4)', () => {
  const dto = {
    gameId: 'game-1',
    sourceId: 'source-1',
    title: 'Controles básicos',
    url: 'https://support.konami.com/efootball/controls',
    documentType: 'CONTROLS' as const,
    language: 'pt-BR',
  };

  let fetcher: { fetchDocument: jest.Mock };
  let gameDocuments: { registerDocument: jest.Mock };
  let service: DocumentationIngestionService;

  beforeEach(() => {
    fetcher = {
      fetchDocument: jest.fn().mockResolvedValue({
        html: '<h1>Controles</h1><p>Segure R2 para passe de calcanhar</p>',
        finalUrl: dto.url,
        httpStatus: 200,
        redirectCount: 0,
        attempts: 1,
      }),
    };
    gameDocuments = {
      registerDocument: jest.fn().mockImplementation((registerDto) =>
        Promise.resolve({
          document: { id: 'doc-1', ...registerDto },
          isNew: true,
          changed: true,
        }),
      ),
    };
    service = new DocumentationIngestionService(fetcher as unknown as DocumentFetcherService, gameDocuments as unknown as GameDocumentsService);
  });

  it('HTML alterado: sanitiza, normaliza e repassa pro registerDocument com changed refletido pelo repositório', async () => {
    const result = await service.ingest(dto);

    expect(fetcher.fetchDocument).toHaveBeenCalledWith(dto.url);
    const registerCall = gameDocuments.registerDocument.mock.calls[0][0];
    expect(registerCall.normalizedContent).toContain('Segure R2 para passe de calcanhar');
    expect(registerCall.rawContent).toContain('<h1>Controles</h1>'); // tag permitida, preservada pelo sanitizador
    expect(registerCall.rawContent).not.toContain('<script');
    expect(result.finalUrl).toBe(dto.url);
    expect(result.httpStatus).toBe(200);
  });

  it('HTML idêntico: registerDocument (Tarefa 3) decide changed:false — não cria versão desnecessária', async () => {
    gameDocuments.registerDocument.mockResolvedValue({
      document: { id: 'doc-1' },
      isNew: false,
      changed: false,
    });

    const result = await service.ingest(dto);

    expect(result.changed).toBe(false);
    expect(result.isNew).toBe(false);
  });

  it('HTML vazio: lança BadRequestException antes de chamar registerDocument', async () => {
    fetcher.fetchDocument.mockResolvedValue({ html: '', finalUrl: dto.url, httpStatus: 200, redirectCount: 0, attempts: 1 });

    await expect(service.ingest(dto)).rejects.toThrow(BadRequestException);
    expect(gameDocuments.registerDocument).not.toHaveBeenCalled();
  });

  it('HTML só com tags/scripts (normaliza pra vazio): lança BadRequestException', async () => {
    fetcher.fetchDocument.mockResolvedValue({
      html: '<script>alert(1)</script><style>body{}</style>',
      finalUrl: dto.url,
      httpStatus: 200,
      redirectCount: 0,
      attempts: 1,
    });

    await expect(service.ingest(dto)).rejects.toThrow(BadRequestException);
    expect(gameDocuments.registerDocument).not.toHaveBeenCalled();
  });

  it('erro de fetch (rede/SSRF/HTTP) propaga sem chamar registerDocument', async () => {
    fetcher.fetchDocument.mockRejectedValue(new Error('Falha ao buscar'));

    await expect(service.ingest(dto)).rejects.toThrow('Falha ao buscar');
    expect(gameDocuments.registerDocument).not.toHaveBeenCalled();
  });

  it('inclui metadados de fetch (redirectCount/fetchAttempts) no resultado', async () => {
    fetcher.fetchDocument.mockResolvedValue({
      html: '<p>conteúdo</p>',
      finalUrl: 'https://support.konami.com/efootball/controls-v2',
      httpStatus: 200,
      redirectCount: 1,
      attempts: 2,
    });

    const result = await service.ingest(dto);

    expect(result.redirectCount).toBe(1);
    expect(result.fetchAttempts).toBe(2);
    expect(result.finalUrl).toBe('https://support.konami.com/efootball/controls-v2');
  });
});
