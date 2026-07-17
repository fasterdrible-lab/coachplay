import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../../shared/decorators/public.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { REFRESH_COOKIE_NAME } from './constants/auth.constants';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  // path: '/' — o middleware do Next.js (apps/web/src/middleware.ts) precisa
  // ver este cookie em qualquer navegação (ex.: /dashboard), não só em
  // requisições de volta para /api/v1/auth
  path: '/',
  maxAge,
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { user, accessToken, refreshToken } = await this.authService.register(dto);
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
      await this.auditLogs.log({
        userId: user.id,
        module: 'auth',
        action: 'register',
        ipAddress: req.ip,
      });
      return { user, accessToken };
    } catch (err) {
      await this.auditLogs.log({
        module: 'auth',
        action: 'register_failed',
        ipAddress: req.ip,
        metadata: { email: dto.email, reason: (err as Error).message },
      });
      throw err;
    }
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { user, accessToken, refreshToken } = await this.authService.login(dto);
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
      await this.auditLogs.log({
        userId: user.id,
        module: 'auth',
        action: 'login',
        ipAddress: req.ip,
      });
      return { user, accessToken };
    } catch (err) {
      await this.auditLogs.log({
        module: 'auth',
        action: 'login_failed',
        ipAddress: req.ip,
        metadata: { email: dto.email, reason: (err as Error).message },
      });
      throw err;
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Refresh token não encontrado');

    const { accessToken, refreshToken } = await this.authService.refresh(token);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(0));
    await this.auditLogs.log({ userId, module: 'auth', action: 'logout', ipAddress: req.ip });
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    // Resposta idêntica independente de o e-mail existir ou não (anti-enumeração)
    return { message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Senha redefinida com sucesso. Faça login com a nova senha.' };
  }

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }
}
