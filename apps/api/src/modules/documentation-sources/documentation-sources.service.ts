import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentationSource } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateDocumentationSourceDto } from './dto/create-documentation-source.dto';
import { UpdateDocumentationSourceDto } from './dto/update-documentation-source.dto';
import { checkSourceUrlSafety } from './url-safety.util';
import { isDomainAllowed, parseAllowedDomains } from './allowed-domains.util';
import { assertTrustLevelAllowed, DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE } from './trust-level.util';

/**
 * Cadastro de fontes de documentação (Tarefa 2) — primeiro módulo da Base Oficial de
 * Documentação do eFootball (prompt separado do módulo eFootball de 24 tarefas, ver
 * docs/efootball/documentation-architecture.md). Só CRUD de `DocumentationSource` — nenhuma
 * coleta de verdade acontece aqui, isso é a Tarefa 4 (`documentation-ingestion`).
 */
@Injectable()
export class DocumentationSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateDocumentationSourceDto): Promise<DocumentationSource> {
    const game = await this.prisma.game.findUnique({ where: { id: dto.gameId } });
    if (!game) {
      throw new NotFoundException(`Jogo "${dto.gameId}" não encontrado`);
    }

    const urlSafety = checkSourceUrlSafety(dto.url);
    if (!urlSafety.safe) {
      throw new BadRequestException(`URL inválida ou insegura: ${urlSafety.reason}`);
    }

    const allowedDomains = parseAllowedDomains(this.config.get<string>('DOCUMENTATION_SOURCE_ALLOWED_DOMAINS'));
    if (!isDomainAllowed(urlSafety.domain, allowedDomains)) {
      throw new BadRequestException(
        `Domínio "${urlSafety.domain}" não está na lista de domínios autorizados ` +
          '(DOCUMENTATION_SOURCE_ALLOWED_DOMAINS) — peça a um administrador pra configurá-lo antes.',
      );
    }

    const trustLevel = dto.trustLevel ?? DEFAULT_TRUST_LEVEL_BY_SOURCE_TYPE[dto.sourceType];
    this.assertTrustLevel(dto.sourceType, trustLevel);

    const existing = await this.prisma.documentationSource.findUnique({
      where: { gameId_url: { gameId: dto.gameId, url: dto.url } },
    });
    if (existing) {
      throw new ConflictException('Já existe uma fonte cadastrada com essa URL para este jogo');
    }

    return this.prisma.documentationSource.create({
      data: {
        gameId: dto.gameId,
        name: dto.name,
        url: dto.url,
        domain: urlSafety.domain,
        sourceType: dto.sourceType,
        language: dto.language,
        trustLevel,
      },
    });
  }

  async findAll(gameId: string, includeInactive = false): Promise<DocumentationSource[]> {
    return this.prisma.documentationSource.findMany({
      where: { gameId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<DocumentationSource> {
    const source = await this.prisma.documentationSource.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundException(`Fonte "${id}" não encontrada`);
    }
    return source;
  }

  async update(id: string, dto: UpdateDocumentationSourceDto): Promise<DocumentationSource> {
    const source = await this.findOne(id);

    const nextTrustLevel = dto.trustLevel ?? source.trustLevel;
    this.assertTrustLevel(source.sourceType, nextTrustLevel);

    return this.prisma.documentationSource.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.active !== undefined && { active: dto.active }),
        trustLevel: nextTrustLevel,
      },
    });
  }

  private assertTrustLevel(sourceType: DocumentationSource['sourceType'], trustLevel: DocumentationSource['trustLevel']): void {
    try {
      assertTrustLevelAllowed(sourceType, trustLevel);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}
