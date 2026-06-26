import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: FindUsersQueryDto) {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { status: status as any }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_PUBLIC_SELECT,
          subscription: {
            select: { status: true, plan: { select: { name: true } } },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, currentUser: AuthUser) {
    this.assertCanAccess(id, currentUser);

    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        ...USER_PUBLIC_SELECT,
        preferences: true,
        subscription: {
          select: {
            status: true,
            startedAt: true,
            expiresAt: true,
            plan: {
              select: {
                name: true,
                monthlyAnalysisLimit: true,
                maxVideoMinutes: true,
                liveFeedbackEnabled: true,
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, currentUser: AuthUser) {
    this.assertCanAccess(id, currentUser);

    const exists = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!exists) throw new NotFoundException('Usuário não encontrado');

    const { name, feedbackLevel, voiceEnabled, language, favoriteMode } = dto;

    const prefFields = { feedbackLevel, voiceEnabled, language, favoriteMode };
    const prefData = Object.fromEntries(
      Object.entries(prefFields).filter(([, v]) => v !== undefined),
    );
    const hasPrefs = Object.keys(prefData).length > 0;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { ...(name && { name }) },
        select: USER_PUBLIC_SELECT,
      });

      if (hasPrefs) {
        await tx.userPreferences.upsert({
          where: { userId: id },
          create: { userId: id, ...prefData },
          update: prefData,
        });
      }

      return user;
    });
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    const exists = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!exists) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: { id: true, email: true, status: true, updatedAt: true },
    });
  }

  async remove(id: string, currentUser: AuthUser) {
    this.assertCanAccess(id, currentUser);

    const exists = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!exists) throw new NotFoundException('Usuário não encontrado');

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'inactive' },
    });
  }

  private assertCanAccess(targetId: string, currentUser: AuthUser) {
    if (currentUser.role !== 'admin' && currentUser.id !== targetId) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso');
    }
  }
}
