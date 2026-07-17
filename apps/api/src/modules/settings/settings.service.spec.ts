import { ConfigService } from '@nestjs/config';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('SettingsService — chaves de provedores de IA', () => {
  let prisma: {
    appSetting: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let config: ConfigService;
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      appSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        return fallback ?? '';
      }),
    } as unknown as ConfigService;

    service = new SettingsService(prisma as unknown as PrismaService, config);
  });

  it('reporta não configurado quando não há chave no banco nem no ambiente', async () => {
    const status = await service.getAiProviderStatus();

    expect(status.anthropic.configured).toBe(false);
    expect(status.openai.configured).toBe(false);
    expect(status.deepSeek.configured).toBe(false);
  });

  it('reporta configurado via variável de ambiente quando não há chave salva', async () => {
    (config.get as jest.Mock).mockImplementation((key: string, fallback?: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      if (key === 'ANTHROPIC_API_KEY') return 'env-anthropic-key';
      return fallback ?? '';
    });

    const status = await service.getAiProviderStatus();

    expect(status.anthropic.configured).toBe(true);
    expect(status.anthropic.source).toBe('variável de ambiente');
    expect(status.anthropic.preview).toBeNull();
  });

  it('criptografa a chave ao salvar e consegue decifrá-la de volta mascarada', async () => {
    await service.updateAiProviderKeys({ anthropicApiKey: 'sk-ant-abcdefgh12345678' });

    const [[upsertArgs]] = prisma.appSetting.upsert.mock.calls;
    const storedValue = upsertArgs.create.anthropicApiKey as string;

    expect(storedValue).not.toContain('sk-ant-abcdefgh12345678');
    expect(storedValue.split(':')).toHaveLength(3);

    prisma.appSetting.findUnique.mockResolvedValue({
      anthropicApiKey: storedValue,
      openaiApiKey: null,
      updatedAt: new Date(),
    });

    const status = await service.getAiProviderStatus();
    expect(status.anthropic.configured).toBe(true);
    expect(status.anthropic.source).toBe('painel');
    expect(status.anthropic.preview).toBe('sk-a••••5678');

    const decrypted = await service.getAnthropicKey();
    expect(decrypted).toBe('sk-ant-abcdefgh12345678');
  });

  it('remove a chave salva quando recebe string vazia', async () => {
    await service.updateAiProviderKeys({ openaiApiKey: '' });

    const [[upsertArgs]] = prisma.appSetting.upsert.mock.calls;
    expect(upsertArgs.create.openaiApiKey).toBeNull();
  });

  it('salva, mascara e decifra a chave do DeepSeek', async () => {
    await service.updateAiProviderKeys({ deepSeekApiKey: 'sk-deepseek-abcdefgh12345678' });

    const [[upsertArgs]] = prisma.appSetting.upsert.mock.calls;
    const storedValue = upsertArgs.create.deepSeekApiKey as string;
    expect(storedValue).not.toContain('sk-deepseek-abcdefgh12345678');

    prisma.appSetting.findUnique.mockResolvedValue({
      deepSeekApiKey: storedValue,
      updatedAt: new Date(),
    });

    const status = await service.getAiProviderStatus();
    expect(status.deepSeek.configured).toBe(true);
    expect(status.deepSeek.source).toBe('painel');
    expect(status.deepSeek.preview).toBe('sk-d••••5678');

    const decrypted = await service.getDeepSeekKey();
    expect(decrypted).toBe('sk-deepseek-abcdefgh12345678');
  });
});
