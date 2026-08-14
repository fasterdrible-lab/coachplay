import { TacticalProfilesService } from './tactical-profiles.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { StrategicProfile } from './strategic-profile.type';

describe('TacticalProfilesService', () => {
  let prisma: { tacticalProfile: { upsert: jest.Mock; findUnique: jest.Mock } };
  let service: TacticalProfilesService;

  beforeEach(() => {
    prisma = { tacticalProfile: { upsert: jest.fn(), findUnique: jest.fn() } };
    service = new TacticalProfilesService(prisma as unknown as PrismaService);
  });

  const buildProfile = (overrides: Partial<StrategicProfile> = {}): StrategicProfile => ({
    dominantPrinciples: ['SPACE_EXPANSION'],
    neglectedPrinciples: ['KING_SAFETY'],
    sampleSize: 12,
    ...overrides,
  });

  describe('upsert', () => {
    it('faz upsert do perfil pela chave userId, sobrescrevendo a última agregação', async () => {
      prisma.tacticalProfile.upsert.mockResolvedValue({ userId: 'user-1' });

      await service.upsert('user-1', buildProfile());

      expect(prisma.tacticalProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: {
          userId: 'user-1',
          dominantPrinciples: ['SPACE_EXPANSION'],
          neglectedPrinciples: ['KING_SAFETY'],
          sampleSize: 12,
        },
        update: {
          dominantPrinciples: ['SPACE_EXPANSION'],
          neglectedPrinciples: ['KING_SAFETY'],
          sampleSize: 12,
        },
      });
    });
  });

  describe('findByUser', () => {
    it('busca o perfil único do usuário', async () => {
      prisma.tacticalProfile.findUnique.mockResolvedValue(null);

      await service.findByUser('user-1');

      expect(prisma.tacticalProfile.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });
});
