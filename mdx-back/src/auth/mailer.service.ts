import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  async sendLoginCode(email: string, code: string): Promise<boolean> {
    const host = this.config.get<string>('SMTP_HOST');
    const from = this.config.get<string>('SMTP_FROM') ?? this.config.get<string>('MAIL_FROM');
    if (!host || !from) {
      if (this.config.get('NODE_ENV') !== 'production') this.logger.log(`Código de entrada para ${email}: ${code}`);
      return false;
    }

    const port = this.config.get<number>('SMTP_PORT') ?? 587;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS')?.replace(/\s/g, '');
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });

    const logo = logoPath();
    try {
      await transport.sendMail({
        from,
        to: email,
        subject: 'Seu código MDX',
        text: [
          'Mermãs Digitais',
          '',
          `Seu código de entrada é ${code}.`,
          'Ele vale por 10 minutos.',
          'Se você não pediu este código, ignore este e-mail.',
        ].join('\n'),
        html: loginCodeHtml(code, Boolean(logo)),
        attachments: logo
          ? [{ filename: 'logo-mermas.png', path: logo, cid: 'logo-mermas' }]
          : [],
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'falha ao enviar';
      this.logger.warn(`Não foi possível enviar o código: ${message}`);
      if (this.config.get('NODE_ENV') === 'production') return false;
      this.logger.log(`Código de entrada para ${email}: ${code}`);
      return false;
    }
  }
}

function logoPath(): string | undefined {
  const candidates = [
    join(import.meta.dirname, 'brand', 'logo-mermas.png'),
    join(process.cwd(), 'src/auth/brand/logo-mermas.png'),
  ];
  return candidates.find((path) => existsSync(path));
}

function loginCodeHtml(code: string, withLogo: boolean): string {
  const digits = code.replace(/\D/g, '').slice(0, 6)
    .split('')
    .map(
      (digit) =>
        `<td align="center" width="52" height="52" style="width:52px;height:52px;background:#FFF6FB;border-radius:26px;font-family:'Trebuchet MS',Verdana,sans-serif;font-size:26px;font-weight:bold;color:#330043;">${digit}</td>`,
    )
    .join('<td width="8"></td>');
  const logo = withLogo
    ? `<img src="cid:logo-mermas" width="158" height="57" alt="Mermãs Digitais" style="display:block;margin:0 auto 8px;border:0;" />`
    : `<p style="margin:0 0 8px;font-family:'Trebuchet MS',Verdana,sans-serif;font-size:22px;font-weight:bold;color:#330043;">Mermãs Digitais</p>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#330043;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#330043;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:28px;overflow:hidden;">
          <tr>
            <td style="height:8px;background:#FF4A97;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="25%" height="6" bgcolor="#FF4A97" style="font-size:0;line-height:0;">&nbsp;</td>
                  <td width="25%" height="6" bgcolor="#B457FC" style="font-size:0;line-height:0;">&nbsp;</td>
                  <td width="25%" height="6" bgcolor="#FFCD34" style="font-size:0;line-height:0;">&nbsp;</td>
                  <td width="25%" height="6" bgcolor="#FFB347" style="font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 28px 8px;">
              ${logo}
              <p style="margin:18px 0 0;font-family:'Trebuchet MS',Verdana,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#FF4A97;">Código de entrada</p>
              <h1 style="margin:8px 0 0;font-family:'Trebuchet MS',Verdana,sans-serif;font-size:28px;line-height:1.2;color:#330043;">Seu código chegou</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 20px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>${digits}</tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 36px 36px;">
              <p style="margin:0;font-family:'Trebuchet MS',Verdana,sans-serif;font-size:15px;line-height:1.5;color:#6E6278;">Ele vale por 10 minutos. Se você não pediu este código, pode ignorar este e-mail.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
