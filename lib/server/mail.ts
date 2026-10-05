import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound email.
 *
 * Configured entirely by environment, so nothing about a provider is baked in:
 *
 *   XMARKET_SMTP_HOST      e.g. smtp.postmarkapp.com
 *   XMARKET_SMTP_PORT      587
 *   XMARKET_SMTP_USER
 *   XMARKET_SMTP_PASS
 *   XMARKET_MAIL_FROM      "XMarket <no-reply@yourdomain>"
 *
 * When SMTP is not configured, isMailConfigured() is false and callers must not
 * claim a message was sent. The auth endpoints use that to decide whether the
 * token may be returned in the response for development — the moment a real
 * transport exists, the token stops leaving the server.
 */

export function isMailConfigured(): boolean {
  return Boolean(
    process.env.XMARKET_SMTP_HOST &&
      process.env.XMARKET_SMTP_USER &&
      process.env.XMARKET_SMTP_PASS &&
      process.env.XMARKET_MAIL_FROM
  );
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.XMARKET_SMTP_HOST,
      port: Number(process.env.XMARKET_SMTP_PORT ?? 587),
      secure: Number(process.env.XMARKET_SMTP_PORT ?? 587) === 465,
      auth: {
        user: process.env.XMARKET_SMTP_USER,
        pass: process.env.XMARKET_SMTP_PASS,
      },
    });
  }
  return transporter;
}

/** Absolute origin for links in email, e.g. https://xmarket.example.com */
function baseUrl(): string {
  return (process.env.XMARKET_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error("Mail is not configured. Set the XMARKET_SMTP_* variables.");
  }
  await getTransporter().sendMail({
    from: process.env.XMARKET_MAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export async function sendPasswordReset(
  to: string,
  token: string
): Promise<void> {
  const link = `${baseUrl()}/reset-password?token=${token}`;
  await sendMail({
    to,
    subject: "Reset your XMarket password",
    text: `Use this link to reset your password:\n\n${link}\n\nIt expires in 30 minutes and can only be used once. If you did not ask for this, ignore the email — your password is unchanged.`,
    html: `<p>Use this link to reset your password:</p><p><a href="${link}">${link}</a></p><p>It expires in 30 minutes and can only be used once. If you did not ask for this, ignore this email — your password is unchanged.</p>`,
  });
}

export async function sendEmailVerification(
  to: string,
  token: string
): Promise<void> {
  const link = `${baseUrl()}/verify-email?token=${token}`;
  await sendMail({
    to,
    subject: "Confirm your XMarket email address",
    text: `Confirm your address to start posting requirements:\n\n${link}\n\nThis link expires in 24 hours and can only be used once.`,
    html: `<p>Confirm your address to start posting requirements:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours and can only be used once.</p>`,
  });
}
