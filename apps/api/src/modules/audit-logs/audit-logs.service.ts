import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';

export interface AuditLogEntry {
  userId?: string | null;
  module: string;
  action: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Best-effort — uma falha ao gravar o log de auditoria nunca deve derrubar o fluxo principal
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          module: entry.module,
          action: entry.action,
          ipAddress: entry.ipAddress ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Falha ao registrar audit log (${entry.module}.${entry.action}): ${(err as Error).message}`,
      );
    }
  }

  async findAll(query: FindAuditLogsQueryDto) {
    const { page = 1, limit = 20, module, action } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(module && { module }),
      ...(action && { action }),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          module: true,
          action: true,
          ipAddress: true,
          metadata: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async remove(id: string): Promise<void> {
    const exists = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Log de auditoria não encontrado');

    await this.prisma.auditLog.delete({ where: { id } });
  }
}
