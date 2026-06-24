import nodemailer from 'nodemailer';

// Email delivery. Three modes, picked in this order:
//   1. RESEND_API_KEY set    -> send via Resend's HTTP API (recommended, no SMTP).
//   2. SMTP_HOST set         -> send via SMTP (nodemailer).
//   3. nothing configured    -> log the message to the console (dev fallback).
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const HOST = process.env.SMTP_HOST || '';
const PORT = Number(process.env.SMTP_PORT) || 587;
const USER = process.env.SMTP_USER || '';
const PASS = process.env.SMTP_PASS || '';
// The "From" address. Must be on a domain verified with your provider.
const FROM = process.env.MAIL_FROM || process.env.SMTP_FROM || (USER ? `Qoders <${USER}>` : 'Qoders <onboarding@resend.dev>');

const transporter = HOST
  ? nodemailer.createTransport({ host: HOST, port: PORT, secure: PORT === 465, auth: USER ? { user: USER, pass: PASS } : undefined })
  : null;

async function sendViaResend(to: string, subject: string, html: string, text: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  if (!r.ok) {
    let msg = `Resend error (${r.status}).`;
    try { const e: any = await r.json(); if (e?.message) msg = `Resend: ${e.message}`; } catch { /* ignore */ }
    throw new Error(msg);
  }
}

export async function sendMail(to: string, subject: string, html: string, text?: string) {
  const txt = text || html.replace(/<[^>]+>/g, ' ');
  try {
    if (RESEND_API_KEY) { await sendViaResend(to, subject, html, txt); return; }
    if (transporter) { await transporter.sendMail({ from: FROM, to, subject, html, text: txt }); return; }
    console.log(`\n[mailer] No email provider configured — would send to ${to}\n  Subject: ${subject}\n  ${txt}\n`);
  } catch (e) {
    console.error('[mailer] send failed:', (e as Error).message);
    throw new Error('Could not send the email.');
  }
}

export function resetEmail(name: string, link: string) {
  const subject = 'Reset your Qoders password';
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1f2937">
      <h2 style="color:#111827">Reset your password</h2>
      <p>Hi ${name || 'there'},</p>
      <p>We received a request to reset your Qoders password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#473AE0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9999px;font-weight:600">Reset password</a></p>
      <p style="font-size:13px;color:#6b7280">Or paste this link into your browser:<br><a href="${link}">${link}</a></p>
      <p style="font-size:13px;color:#9ca3af">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
  const text = `Reset your Qoders password: ${link} (expires in 1 hour). If you didn't request this, ignore this email.`;
  return { subject, html, text };
}
