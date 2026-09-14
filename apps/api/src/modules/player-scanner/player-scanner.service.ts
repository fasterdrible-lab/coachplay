import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CARD_IMAGE_EXTRACTOR, CardImageExtractor } from './card-image-extractor.interface';
import { InvalidImageError, preprocessImage } from './preprocess-image';
import { parseExtractedText, ParsedCardText } from './parse-extracted-text';
import { computeFinalConfidence, decideScanOutcome, scoreCard, scoreNameMatch } from './scan-scoring';
import { MAX_CANDIDATES_RETURNED } from './player-scanner.config';

export interface ScanCardParams {
  userId: string;
  gameId: string;
  imageBuffer: Buffer;
}

export interface ScanCandidateView {
  playerCardId: string;
  playerId: string;
  playerName: string;
  cardType: string;
  overallBase: number;
  score: number;
}

export interface ScanCardResult {
  id: string;
  status: 'AUTO_IDENTIFIED' | 'NEEDS_CONFIRMATION' | 'NEEDS_NEW_IMAGE' | 'INVALID_IMAGE';
  confidence: number;
  matchedPlayerCardId?: string;
  candidates: ScanCandidateView[];
}

interface PlayerWithCards {
  id: string;
  name: string;
  normalizedName: string;
  cards: Array<{ id: string; cardType: string; overallBase: number; active: boolean }>;
}

@Injectable()
export class PlayerScannerService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CARD_IMAGE_EXTRACTOR) private readonly extractor: CardImageExtractor,
  ) {}

  async scan(params: ScanCardParams): Promise<ScanCardResult> {
    try {
      await preprocessImage(params.imageBuffer);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return this.persistAndReturn(params.userId, 'INVALID_IMAGE', 0, undefined, [], undefined);
      }
      throw err;
    }

    const extraction = await this.extractor.extract(params.imageBuffer);
    const parsed = parseExtractedText(extraction.rawText);

    const players = await this.findCandidatePlayers(params.gameId, parsed);
    const candidates = this.buildCandidateViews(parsed, players);

    const { confidence, ambiguous } = computeFinalConfidence(
      extraction.extractionConfidence,
      candidates.map((c) => ({ playerCardId: c.playerCardId, playerId: c.playerId, score: c.score })),
    );
    const status = decideScanOutcome(confidence);

    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const matchedPlayerCardId = status === 'AUTO_IDENTIFIED' && !ambiguous ? top?.playerCardId : undefined;

    return this.persistAndReturn(
      params.userId,
      status,
      confidence,
      matchedPlayerCardId,
      sorted.slice(0, MAX_CANDIDATES_RETURNED),
      { rawText: extraction.rawText, extractionConfidence: extraction.extractionConfidence },
    );
  }

  private async findCandidatePlayers(gameId: string, parsed: ParsedCardText): Promise<PlayerWithCards[]> {
    const tokenConditions = parsed.nameTokens
      .filter((token) => token.length >= 3)
      .map((token) => ({ normalizedName: { contains: token, mode: 'insensitive' as const } }));

    if (tokenConditions.length === 0) return [];

    return this.prisma.player.findMany({
      where: { gameId, OR: tokenConditions },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        cards: { where: { active: true }, select: { id: true, cardType: true, overallBase: true, active: true } },
      },
    });
  }

  private buildCandidateViews(parsed: ParsedCardText, players: PlayerWithCards[]): ScanCandidateView[] {
    const candidates: ScanCandidateView[] = [];

    for (const player of players) {
      const nameScore = scoreNameMatch(parsed.nameTokens, player.normalizedName);
      if (nameScore <= 0) continue;

      for (const card of player.cards) {
        candidates.push({
          playerCardId: card.id,
          playerId: player.id,
          playerName: player.name,
          cardType: card.cardType,
          overallBase: card.overallBase,
          score: scoreCard(nameScore, card, parsed),
        });
      }
    }

    return candidates;
  }

  private async persistAndReturn(
    userId: string,
    status: ScanCardResult['status'],
    confidence: number,
    matchedPlayerCardId: string | undefined,
    candidates: ScanCandidateView[],
    rawExtraction: { rawText: string; extractionConfidence: number } | undefined,
  ): Promise<ScanCardResult> {
    const scan = await this.prisma.cardScan.create({
      data: {
        userId,
        status,
        confidenceScore: confidence,
        matchedPlayerCardId,
        candidateCardIds: candidates.map((c) => ({ playerCardId: c.playerCardId, score: c.score })),
        rawExtraction: rawExtraction ?? undefined,
      },
    });

    return { id: scan.id, status, confidence, matchedPlayerCardId, candidates };
  }
}
