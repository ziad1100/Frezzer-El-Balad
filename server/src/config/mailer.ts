import nodemailer from 'nodemailer';
import env from './env';

const smtpConfigured = Boolean(env.smtpHost && env.smtpUser && env.smtpPass);

export { smtpConfigured };

export const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    })
  : null;

export const sendMail = async (to: string, subject: string, html: string): Promise<void> => {
  if (transporter) {
    await transporter.sendMail({ from: env.mailFrom, to, subject, html });
  } else {
    // Dev fallback: log the email body to the console
     
    console.log(`\n[MAIL:dev] To: ${to}\n[MAIL:dev] Subject: ${subject}\n[MAIL:dev] ${html}\n`);
  }
};