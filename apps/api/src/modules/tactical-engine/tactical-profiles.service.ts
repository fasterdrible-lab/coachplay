import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { StrategicProfile } from './strategic-profile.type';

// Persistência do StrategicProfile agregado (strategic-profile.builder.ts, Tarefa 22). Uma
// linha por usuário, sempre sobrescrita na última agregação — sem histórico de perfis
// anteriores (ver comentário do model TacticalProfile no schema.prisma).
@Injectable()
export class TacticalProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, profile: StrategicProfile) {
    return this.prisma.tacticalProfile.upsert({
      where: { userId },
      create: {
        userId,
        dominantPrinciples: profile.dominantPrinciples,
        neglectedPrinciples: profile.neglectedPrinciples,
        sampleSize: profile.sampleSize,
      },
      update: {
        dominantPrinciples: profile.dominantPrinciples,
        neglectedPrinciples: profile.neglectedPrinciples,
        sampleSize: profile.sampleSize,
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.tacticalProfile.findUnique({ where: { userId } });
  }
}
