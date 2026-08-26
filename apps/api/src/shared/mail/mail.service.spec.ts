import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const mockSendMail = jest.fn().mockResolvedValue({});
const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

function buildConfig(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('MailService — redefinição de senha', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('em desenvolvimento, só loga o link e não tenta enviar e-mail', async () => {
    const service = new MailService(buildConfig({ NODE_ENV: 'development' }));
    service.onModuleInit();

    await service.sendPasswordReset('user@example.com', 'Ana', 'https://app/reset-password?token=abc');

    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('em produção sem MAIL_USER/MAIL_PASS configurados, não lança e não envia', async () => {
    const service = new MailService(
      buildConfig({ NODE_ENV: 'production', MAIL_HOST: 'smtp.gmail.com' }),
    );
    service.onModuleInit();

    await expect(
      service.sendPasswordReset('user@example.com', 'Ana', 'https://app/reset-password?token=abc'),
    ).resolves.toBeUndefined();

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('em produção com SMTP configurado, envia o e-mail com o link de redefinição', async () => {
    const service = new MailService(
      buildConfig({
        NODE_ENV: 'production',
        MAIL_HOST: 'smtp.gmail.com',
        MAIL_USER: 'noreply@coachplay.app',
        MAIL_PASS: 'app-password',
        MAIL_FROM: 'Coach Play <noreply@coachplay.app>',
      }),
    );
    service.onModuleInit();

    await service.sendPasswordReset('user@example.com', 'Ana', 'https://app/reset-password?token=abc');

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.gmail.com', auth: { user: 'noreply@coachplay.app', pass: 'app-password' } }),
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        from: 'Coach Play <noreply@coachplay.app>',
        subject: expect.stringContaining('Redefinição de senha'),
        text: expect.stringContaining('https://app/reset-password?token=abc'),
        html: expect.stringContaining('https://app/reset-password?token=abc'),
      }),
    );
  });
});
