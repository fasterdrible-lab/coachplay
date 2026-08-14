import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './shared/database/prisma.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MatchesModule } from './modules/matches/matches.module';
import { AiCoachModule } from './modules/ai-coach/ai-coach.module';
import { GameAnalysisModule } from './modules/game-analysis/game-analysis.module';
import { VideoCaptureModule } from './modules/video-capture/video-capture.module';
import { PlansModule } from './modules/plans/plans.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AdminModule } from './modules/admin/admin.module';
import { CaptureSessionsModule } from './modules/capture-sessions/capture-sessions.module';
import { TacticalEngineModule } from './modules/tactical-engine/tactical-engine.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        const parsed = new URL(redisUrl);
        return {
          connection: {
            host: parsed.hostname,
            port: parseInt(parsed.port || '6379', 10),
            ...(parsed.password && { password: decodeURIComponent(parsed.password) }),
          },
        };
      },
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    MatchesModule,
    AiCoachModule,
    GameAnalysisModule,
    VideoCaptureModule,
    PlansModule,
    ReportsModule,
    AuditLogsModule,
    SettingsModule,
    AdminModule,
    CaptureSessionsModule,
    TacticalEngineModule,
  ],
  providers: [
    // ThrottlerGuard precisa vir primeiro: aplica o rate limit antes de qualquer verificação de auth
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
