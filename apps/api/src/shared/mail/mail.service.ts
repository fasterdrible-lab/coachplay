import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    if (this.config.get('NODE_ENV') !== 'production') return;

    const host = this.config.get<string>('MAIL_HOST', '');
    const user = this.config.get<string>('MAIL_USER', '');
    const pass = this.config.get<string>('MAIL_PASS', '');

    if (!host || !user || !pass) {
      this.logger.warn(
        'MailService: MAIL_HOST/MAIL_USER/MAIL_PASS não configurados — e-mails não serão enviados',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('MAIL_PORT', 587),
      secure: this.config.get<string>('MAIL_SECURE', 'false') === 'true',
      auth: { user, pass },
    });
  }

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

    if (!this.transporter) {
      this.logger.error(`MailService: não foi possível enviar e-mail para ${to} — SMTP não configurado`);
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM', 'Coach Play <noreply@coachplay.app>'),
      to,
      subject: 'Redefinição de senha — Coach Play',
      text:
        `Olá, ${name}!\n\n` +
        `Recebemos um pedido para redefinir sua senha no Coach Play.\n\n` +
        `Clique no link abaixo para criar uma nova senha (válido por 1 hora):\n${resetUrl}\n\n` +
        `Se você não solicitou isso, pode ignorar este e-mail.`,
      html:
        `<p>Olá, ${name}!</p>` +
        `<p>Recebemos um pedido para redefinir sua senha no Coach Play.</p>` +
        `<p><a href="${resetUrl}">Clique aqui para criar uma nova senha</a> (válido por 1 hora).</p>` +
        `<p>Se você não solicitou isso, pode ignorar este e-mail.</p>`,
    });
  }
}
