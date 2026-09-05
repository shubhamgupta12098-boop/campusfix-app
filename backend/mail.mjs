import nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'node:crypto';
import { config } from './config.mjs';
import { dbCollection, newId } from './db.mjs';

function smtpConfigured() {
  return Boolean(config.smtpHost && config.smtpPort && config.smtpUser && config.smtpPass && config.mailFrom);
}

function tokenHash(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function resetUrl(token) {
  const base = String(config.appBaseUrl || '').replace(/\/$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

export function hasSmtpPasswordReset() {
  return smtpConfigured();
}

export async function sendSmtpPasswordReset(email) {
  if (!smtpConfigured()) {
    const error = new Error('SMTP password reset is not configured.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.resetTokenMinutes * 60 * 1000);
  const now = new Date();
  await dbCollection('password_reset_tokens').insertOne({
    id: newId('reset'),
    email: String(email).trim().toLowerCase(),
    token_hash: tokenHash(rawToken),
    created_at: now,
    expires_at: expiresAt,
    used_at: null,
  });

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });

  const url = resetUrl(rawToken);
  const safeUrl = escapeHtml(url);
  try {
    await transporter.verify();
    await transporter.sendMail({
      from: config.mailFrom,
      to: email,
      subject: 'CCMMS password reset',
      text: `You requested a CCMMS password reset. Open this link within ${config.resetTokenMinutes} minutes:\n\n${url}\n\nIf you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#16231d"><h2 style="margin:0 0 12px">CCMMS password reset</h2><p>You requested a password reset.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#1bc98e;color:#052016;text-decoration:none;border-radius:10px;font-weight:700">Reset password</a></p><p style="font-size:13px;color:#5b6b63">This link expires in ${config.resetTokenMinutes} minutes. If you did not request this, you can ignore this email.</p></div>`,
    });
  } catch (error) {
    await dbCollection('password_reset_tokens').deleteOne({ token_hash: tokenHash(rawToken) }).catch(() => {});
    error.code = error.code || 'SMTP_SEND_FAILED';
    throw error;
  }

  return { ok: true };
}

export async function consumePasswordResetToken(rawToken) {
  const hash = tokenHash(rawToken);
  const now = new Date();
  const record = await dbCollection('password_reset_tokens').findOne({
    token_hash: hash,
    used_at: null,
    expires_at: { $gt: now },
  });
  if (!record) return null;

  const claimed = await dbCollection('password_reset_tokens').findOneAndUpdate(
    { _id: record._id, used_at: null },
    { $set: { used_at: now } },
    { returnDocument: 'after' },
  );
  return claimed ? String(record.email || '').toLowerCase() : null;
}
