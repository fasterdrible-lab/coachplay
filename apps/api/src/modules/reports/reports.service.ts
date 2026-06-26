import { ForbiddenException, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ErrorSeverity, MatchStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';

interface ErrorLike {
  category: string;
  severity: ErrorSeverity;
}

const PENALTY: Record<ErrorSeverity, number> = {
  [ErrorSeverity.low]: 0.3,
  [ErrorSeverity.medium]: 0.7,
  [ErrorSeverity.high]: 1.2,
  [ErrorSeverity.critical]: 2.0,
};

const ATTACK_CATS = new Set(['ataque', 'finalizacao']);
const DEFENSE_CATS = new Set(['defesa']);
const PASSING_CATS = new Set(['passe']);
const DECISION_CATS = new Set(['decisao', 'posicionamento']);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatchReport(matchId: string, currentUser: AuthUser) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        title: true,
        gameMode: true,
        platform: true,
        matchDate: true,
        scoreUser: true,
        scoreOpponent: true,
        status: true,
        report: true,
        analysis: { select: { summary: true, modelUsed: true, status: true } },
        errors: { select: { category: true, severity: true } },
        _count: { select: { gameEvents: true, errors: true } },
      },
    });

    if (!match) throw new NotFoundException('Partida não encontrada');
    if (match.userId !== currentUser.id) throw new ForbiddenException('Acesso negado');
    if (match.status !== MatchStatus.analyzed) {
      throw new BadRequestException('Partida ainda não foi analisada');
    }

    const report =
      match.report ??
      (await this.persistReport(matchId, match.errors, match.analysis?.summary ?? null));

    return {
      matchId: match.id,
      title: match.title,
      gameMode: match.gameMode,
      platform: match.platform,
      matchDate: match.matchDate,
      scoreUser: match.scoreUser,
      scoreOpponent: match.scoreOpponent,
      status: match.status,
      report: {
        overallScore: report.overallScore,
        attackScore: report.attackScore,
        defenseScore: report.defenseScore,
        passingScore: report.passingScore,
        decisionScore: report.decisionScore,
        mainProblem: report.mainProblem,
        recommendation: report.recommendation,
      },
      aiSummary: match.analysis?.summary ?? null,
      aiModel: match.analysis?.modelUsed ?? null,
      eventCount: match._count.gameEvents,
      errorCount: match._count.errors,
    };
  }

  // Chamado pelo worker após AI Coach — gera e persiste MatchReport automaticamente
  async generateReport(matchId: string): Promise<void> {
    const [errors, analysis] = await Promise.all([
      this.prisma.detectedError.findMany({
        where: { matchId },
        select: { category: true, severity: true },
      }),
      this.prisma.aIAnalysis.findUnique({
        where: { matchId },
        select: { summary: true },
      }),
    ]);

    await this.persistReport(matchId, errors, analysis?.summary ?? null);
  }

  async getEvolution(userId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const reports = await this.prisma.matchReport.findMany({
      where: {
        match: {
          userId,
          deletedAt: null,
          status: MatchStatus.analyzed,
          createdAt: { gte: since },
        },
      },
      select: {
        overallScore: true,
        attackScore: true,
        defenseScore: true,
        passingScore: true,
        decisionScore: true,
        match: {
          select: { id: true, title: true, gameMode: true, matchDate: true, createdAt: true },
        },
      },
      orderBy: { match: { createdAt: 'asc' } },
    });

    return {
      days,
      data: reports.map((r) => ({
        matchId: r.match.id,
        title: r.match.title,
        gameMode: r.match.gameMode,
        matchDate: r.match.matchDate,
        createdAt: r.match.createdAt,
        overallScore: r.overallScore,
        attackScore: r.attackScore,
        defenseScore: r.defenseScore,
        passingScore: r.passingScore,
        decisionScore: r.decisionScore,
      })),
    };
  }

  async getSummary(userId: string) {
    const reports = await this.prisma.matchReport.findMany({
      where: {
        match: { userId, deletedAt: null, status: MatchStatus.analyzed },
      },
      select: {
        matchId: true,
        overallScore: true,
        attackScore: true,
        defenseScore: true,
        passingScore: true,
        decisionScore: true,
      },
    });

    if (reports.length === 0) {
      return {
        totalAnalyzed: 0,
        avgOverallScore: null,
        bestCategory: null,
        worstCategory: null,
        mostFrequentError: null,
        categoryAvgScores: null,
      };
    }

    const matchIds = reports.map((r) => r.matchId);

    const errorGroups = await this.prisma.detectedError.groupBy({
      by: ['category'],
      where: { matchId: { in: matchIds } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const categoryAvgScores = {
      attack: this.avg(reports.map((r) => r.attackScore)),
      defense: this.avg(reports.map((r) => r.defenseScore)),
      passing: this.avg(reports.map((r) => r.passingScore)),
      decision: this.avg(reports.map((r) => r.decisionScore)),
    };

    const scoreEntries = Object.entries(categoryAvgScores).filter(
      (e): e is [string, number] => e[1] !== null,
    );
    const bestCategory =
      scoreEntries.length > 0
        ? scoreEntries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
        : null;
    const worstCategory =
      scoreEntries.length > 0
        ? scoreEntries.reduce((a, b) => (b[1] < a[1] ? b : a))[0]
        : null;

    return {
      totalAnalyzed: reports.length,
      avgOverallScore: this.avg(reports.map((r) => r.overallScore)),
      bestCategory,
      worstCategory,
      mostFrequentError: errorGroups[0]?.category ?? null,
      categoryAvgScores,
    };
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async persistReport(
    matchId: string,
    errors: ErrorLike[],
    aiSummary: string | null,
  ) {
    const scores = this.calculateScores(errors);
    const mainProblem = this.mainErrorCategory(errors);

    return this.prisma.matchReport.upsert({
      where: { matchId },
      create: { matchId, ...scores, mainProblem, recommendation: aiSummary },
      update: { ...scores, mainProblem, recommendation: aiSummary },
    });
  }

  private calculateScores(errors: ErrorLike[]) {
    const ded = { attack: 0, defense: 0, passing: 0, decision: 0 };

    for (const e of errors) {
      const p = PENALTY[e.severity] ?? 0;
      if (ATTACK_CATS.has(e.category)) ded.attack += p;
      else if (DEFENSE_CATS.has(e.category)) ded.defense += p;
      else if (PASSING_CATS.has(e.category)) ded.passing += p;
      else if (DECISION_CATS.has(e.category)) ded.decision += p;
    }

    const clamp = (n: number) => Math.max(1.0, Math.round((10.0 - n) * 10) / 10);

    const attackScore = clamp(ded.attack);
    const defenseScore = clamp(ded.defense);
    const passingScore = clamp(ded.passing);
    const decisionScore = clamp(ded.decision);
    const overallScore =
      Math.round(((attackScore + defenseScore + passingScore + decisionScore) / 4) * 10) / 10;

    return { overallScore, attackScore, defenseScore, passingScore, decisionScore };
  }

  private mainErrorCategory(errors: ErrorLike[]): string | null {
    if (errors.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const e of errors) counts[e.category] = (counts[e.category] ?? 0) + 1;
    return Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }

  private avg(values: (number | null)[]): number | null {
    const valid = values.filter((v): v is number => v !== null);
    if (valid.length === 0) return null;
    return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
  }
}
