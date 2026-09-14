import { Injectable, Logger } from '@nestjs/common';
import { DataImportRun } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { EfootballDataSource } from './efootball-data-source.interface';
import { RawPlayerRecord } from './raw-player-record.type';
import { normalizeRecord } from './normalize';
import { validateRecord } from './validate';
import { computeBatchChecksum } from './checksum.util';
import { diffCard } from './card-diff';

export interface ImportBatchParams {
  gameId: string;
  gameDataSourceId: string;
  source: string;
  sourceVersion: string;
  records: RawPlayerRecord[];
}

export interface ImportFromSourceParams {
  gameId: string;
  gameDataSourceId: string;
  source: string;
  sourceVersion: string;
}

@Injectable()
export class EfootballDataProviderService {
  private readonly logger = new Logger(EfootballDataProviderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importFromSource(
    dataSource: EfootballDataSource,
    meta: ImportFromSourceParams,
  ): Promise<DataImportRun> {
    const records = await dataSource.fetch();
    return this.importBatch({ ...meta, records });
  }

  /**
   * Orquestra normalize → validate → version → import. Assume que `records` representa o
   * catálogo COMPLETO atual da fonte para este jogo — cartas ativas não presentes no lote são
   * marcadas como removidas (ver docs/efootball-architecture.md, Tarefa 4).
   */
  async importBatch(params: ImportBatchParams): Promise<DataImportRun> {
    const { gameId, gameDataSourceId, source, sourceVersion, records } = params;

    const validations = records.map((raw) => ({ raw, result: validateRecord(raw) }));
    const invalid = validations.filter((v) => !v.result.valid);
    const valid = validations.filter((v) => v.result.valid).map((v) => normalizeRecord(v.raw));

    const checksum = computeBatchChecksum(valid);

    const run = await this.prisma.dataImportRun.create({
      data: {
        gameDataSourceId,
        source,
        sourceVersion,
        importedAt: new Date(),
        checksum,
        recordCount: records.length,
        errorCount: invalid.length,
        status: 'processing',
        errorDetail:
          invalid.length > 0
            ? invalid.map((v) => ({ externalId: (v.raw as { externalId?: string }).externalId, errors: v.result.errors }))
            : undefined,
      },
    });

    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const incomingCardKeys = new Set<string>();

    for (const record of valid) {
      let player = await this.prisma.player.findUnique({
        where: { gameId_externalId: { gameId, externalId: record.externalId } },
      });

      if (!player) {
        player = await this.prisma.player.create({
          data: {
            gameId,
            externalId: record.externalId,
            name: record.name,
            normalizedName: record.normalizedName,
            nationality: record.nationality,
            preferredFoot: record.preferredFoot,
            height: record.height,
          },
        });
        await this.prisma.dataImportChange.create({
          data: {
            dataImportRunId: run.id,
            changeType: 'player_created',
            entityType: 'player',
            entityId: player.id,
          },
        });
      }

      for (const card of record.cards) {
        incomingCardKeys.add(`${record.externalId}::${card.externalId}`);

        const existingCard = await this.prisma.playerCard.findUnique({
          where: { playerId_externalId: { playerId: player.id, externalId: card.externalId } },
        });

        const changeType = diffCard(existingCard, card);
        const cardData = {
          cardType: card.cardType,
          version: card.version,
          overallBase: card.overallBase,
          maxLevel: card.maxLevel,
          position: card.position,
          imageUrl: card.imageUrl,
          releaseDate: card.releaseDate ? new Date(card.releaseDate) : undefined,
          dataVersion: sourceVersion,
          source,
          sourceVersion,
          lastVerifiedAt: new Date(),
          active: true,
        };

        if (changeType === 'created') {
          const created = await this.prisma.playerCard.create({
            data: { ...cardData, playerId: player.id, externalId: card.externalId },
          });
          createdCount++;
          await this.prisma.dataImportChange.create({
            data: {
              dataImportRunId: run.id,
              changeType: 'card_created',
              entityType: 'player_card',
              entityId: created.id,
            },
          });
        } else if (changeType === 'updated') {
          const updated = await this.prisma.playerCard.update({
            where: { id: existingCard!.id },
            data: cardData,
          });
          updatedCount++;
          await this.prisma.dataImportChange.create({
            data: {
              dataImportRunId: run.id,
              changeType: 'card_updated',
              entityType: 'player_card',
              entityId: updated.id,
              diff: {
                before: {
                  cardType: existingCard!.cardType,
                  version: existingCard!.version,
                  overallBase: existingCard!.overallBase,
                  maxLevel: existingCard!.maxLevel,
                  position: existingCard!.position,
                },
                after: {
                  cardType: card.cardType,
                  version: card.version,
                  overallBase: card.overallBase,
                  maxLevel: card.maxLevel,
                  position: card.position,
                },
              },
            },
          });
        } else {
          unchangedCount++;
          await this.prisma.playerCard.update({
            where: { id: existingCard!.id },
            data: { lastVerifiedAt: new Date() },
          });
        }
      }
    }

    const removedCount = await this.markRemovedCards(gameId, incomingCardKeys, run.id);

    const status = invalid.length === 0 ? 'done' : createdCount + updatedCount > 0 ? 'partial' : 'failed';

    this.logger.log(
      `Import ${source}@${sourceVersion}: ${createdCount} criadas, ${updatedCount} atualizadas, ` +
        `${unchangedCount} sem alteração, ${removedCount} removidas, ${invalid.length} erros`,
    );

    return this.prisma.dataImportRun.update({
      where: { id: run.id },
      data: { createdCount, updatedCount, unchangedCount, removedCount, status },
    });
  }

  private async markRemovedCards(
    gameId: string,
    incomingCardKeys: Set<string>,
    runId: string,
  ): Promise<number> {
    const activeCards = await this.prisma.playerCard.findMany({
      where: { active: true, player: { gameId } },
      select: { id: true, externalId: true, player: { select: { externalId: true } } },
    });

    let removedCount = 0;
    for (const card of activeCards) {
      const key = `${card.player.externalId}::${card.externalId}`;
      if (incomingCardKeys.has(key)) continue;

      await this.prisma.playerCard.update({ where: { id: card.id }, data: { active: false } });
      removedCount++;
      await this.prisma.dataImportChange.create({
        data: {
          dataImportRunId: runId,
          changeType: 'card_removed',
          entityType: 'player_card',
          entityId: card.id,
        },
      });
    }

    return removedCount;
  }
}
