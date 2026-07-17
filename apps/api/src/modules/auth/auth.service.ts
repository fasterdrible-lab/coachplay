import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../shared/database/prisma.service';
import { MailService } from '../../shared/mail/mail.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './types/jwt-payload.type';
import {
  MAX_LOGIN_ATTEMPTS,
  LOCK_DURATION_MINUTES,
  REFRESH_TOKEN_BYTES,
  RESET_TOKEN_BYTES,
  RESET_TOKEN_EXPIRY_MS,
} from './constants/auth.constants';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
    private auditLogs: AuditLogsService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Este e-mail já está cadastrado');

    const passwordHash = await argon2.hash(dto.password);
    const freePlan = await this.prisma.plan.findFirst({
      where: { name: 'Free', status: 'active' },
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
      });

      if (freePlan) {
        await tx.subscription.create({
          data: { userId: created.id, planId: freePlan.id, startedAt: new Date() },
        });
      }

      return created;
    });

    if (freePlan) {
      await this.auditLogs.log({
        userId: user.id,
        module: 'plans',
        action: 'plan_assigned',
        metadata: { planId: freePlan.id, planName: freePlan.name },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    if (user.status === 'blocked') {
      throw new ForbiddenException('Sua conta está bloqueada. Entre em contato com o suporte.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(
        `Conta bloqueada temporariamente. Tente novamente em ${minutesLeft} minuto(s).`,
      );
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      const newAttempts = user.loginAttempts + 1;
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
          ...(shouldLock && {
            lockedUntil: new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000),
          }),
        },
      });

      if (shouldLock) {
        throw new ForbiddenException(
          `Muitas tentativas inválidas. Conta bloqueada por ${LOCK_DURATION_MINUTES} minutos.`,
        );
      }

      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) throw new UnauthorizedException('Refresh token inválido');

    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { tokenHash } });
      throw new UnauthorizedException('Refresh token expirado. Faça login novamente.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, role: true, status: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.status !== 'active') {
      throw new UnauthorizedException('Usuário inativo');
    }

    // Rotate: delete old, issue new
    await this.prisma.refreshToken.delete({ where: { tokenHash } });

    return this.generateTokens(user.id, user.email, user.role);
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        subscription: {
          select: {
            status: true,
            expiresAt: true,
            plan: {
              select: { name: true, monthlyAnalysisLimit: true, liveFeedbackEnabled: true },
            },
          },
        },
      },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    // Retorno silencioso para não enumerar e-mails cadastrados
    if (!user || user.status === 'blocked') return;

    // Invalidar tokens anteriores do mesmo usuário
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const raw = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${raw}`;

    await this.mail.sendPasswordReset(user.email, user.name, resetUrl);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.hashToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Link de redefinição inválido ou expirado. Solicite um novo.');
    }

    const passwordHash = await argon2.hash(dto.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, loginAttempts: 0, lockedUntil: null },
      });

      // Marcar token como usado
      await tx.passwordResetToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      });

      // Invalidar todas as sessões ativas por segurança
      await tx.refreshToken.deleteMany({ where: { userId: resetToken.userId } });
    });
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload: JwtPayload = { sub: userId, email, role };
    const accessToken = this.jwt.sign(payload);

    const raw = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(
      Date.now() + this.parseDuration(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d')),
    );

    await this.prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });

    return { accessToken, refreshToken: raw };
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseDuration(duration: string): number {
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);
    const map: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * (map[unit] ?? 86_400_000);
  }
}
