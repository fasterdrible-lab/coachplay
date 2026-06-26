import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private config: ConfigService) {}

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<void> {
    if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.log(
        `\n${'═'.repeat(52)}\n` +
        `  COACH PLAY — E-MAIL DE REDEFINIÇÃO DE SENHA\n` +
        `${'─'.repeat(52)}\n` +
        `  Para : ${to}\n` +
        `  Nome : ${name}\n` +
        `  Link : ${resetUrl}\n` +
        `  Expira em: 1 hora\n` +
        `${'═'.repeat(52)}`,
      );
      return;
    }

    // Fase 7: implementar envio real via Nodemailer ou Resend
    // Documentação: https://nodemailer.com | https://resend.com
    this.logger.warn('MailService: envio real não configurado em produção');
  }
}
