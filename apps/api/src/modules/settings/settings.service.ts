import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../shared/database/prisma.service';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';

const SETTINGS_ID = 'global';

function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

@Injectable()
export class SettingsService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Deriva a chave de criptografia do JWT_SECRET já existente, evitando
    // exigir mais uma variável de ambiente só para isso.
    const secret = this.config.get<string>('JWT_SECRET', 'coach-play-fallback-secret');
    this.encryptionKey = crypto.createHash('sha256').update(secret).digest();
  }

  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
  }

  private decrypt(stored: string): string {
    const [ivHex, tagHex, dataHex] = stored.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  async getAiProviderStatus() {
    const settings = await this.prisma.appSetting.findUnique({ where: { id: SETTINGS_ID } });

    const anthropicEnv = !!this.config.get<string>('ANTHROPIC_API_KEY', '');
    const openaiEnv = !!this.config.get<string>('OPENAI_API_KEY', '');
    const deepSeekEnv = !!this.config.get<string>('DEEPSEEK_API_KEY', '');

    return {
      anthropic: {
        configured: !!settings?.anthropicApiKey || anthropicEnv,
        source: settings?.anthropicApiKey ? 'painel' : anthropicEnv ? 'variável de ambiente' : null,
        preview: settings?.anthropicApiKey ? maskKey(this.decrypt(settings.anthropicApiKey)) : null,
      },
      openai: {
        configured: !!settings?.openaiApiKey || openaiEnv,
        source: settings?.openaiApiKey ? 'painel' : openaiEnv ? 'variável de ambiente' : null,
        preview: settings?.openaiApiKey ? maskKey(this.decrypt(settings.openaiApiKey)) : null,
      },
      deepSeek: {
        configured: !!settings?.deepSeekApiKey || deepSeekEnv,
        source: settings?.deepSeekApiKey ? 'painel' : deepSeekEnv ? 'variável de ambiente' : null,
        preview: settings?.deepSeekApiKey ? maskKey(this.decrypt(settings.deepSeekApiKey)) : null,
      },
      updatedAt: settings?.updatedAt ?? null,
    };
  }

  async updateAiProviderKeys(dto: UpdateAiProviderDto) {
    const data: {
      anthropicApiKey?: string | null;
      openaiApiKey?: string | null;
      deepSeekApiKey?: string | null;
    } = {};

    if (dto.anthropicApiKey !== undefined) {
      data.anthropicApiKey = dto.anthropicApiKey ? this.encrypt(dto.anthropicApiKey) : null;
    }
    if (dto.openaiApiKey !== undefined) {
      data.openaiApiKey = dto.openaiApiKey ? this.encrypt(dto.openaiApiKey) : null;
    }
    if (dto.deepSeekApiKey !== undefined) {
      data.deepSeekApiKey = dto.deepSeekApiKey ? this.encrypt(dto.deepSeekApiKey) : null;
    }

    await this.prisma.appSetting.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    });

    return this.getAiProviderStatus();
  }

  async getAnthropicKey(): Promise<string> {
    const settings = await this.prisma.appSetting.findUnique({ where: { id: SETTINGS_ID } });
    if (settings?.anthropicApiKey) return this.decrypt(settings.anthropicApiKey);
    return this.config.get<string>('ANTHROPIC_API_KEY', '');
  }

  async getOpenAiKey(): Promise<string> {
    const settings = await this.prisma.appSetting.findUnique({ where: { id: SETTINGS_ID } });
    if (settings?.openaiApiKey) return this.decrypt(settings.openaiApiKey);
    return this.config.get<string>('OPENAI_API_KEY', '');
  }

  async getDeepSeekKey(): Promise<string> {
    const settings = await this.prisma.appSetting.findUnique({ where: { id: SETTINGS_ID } });
    if (settings?.deepSeekApiKey) return this.decrypt(settings.deepSeekApiKey);
    return this.config.get<string>('DEEPSEEK_API_KEY', '');
  }
}
