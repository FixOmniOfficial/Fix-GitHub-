/**
 * Email service — wraps nodemailer.
 * Reads SMTP credentials from environment secrets.
 *
 * Config secrets needed (set in Replit Secrets):
 *   SMTP_HOST     e.g. smtp.gmail.com
 *   SMTP_PORT     e.g. 587
 *   SMTP_USER     your Gmail / SMTP user
 *   SMTP_PASS     app-password or SMTP password
 *   SMTP_FROM     display name + address, e.g. "Fix Omni <no-reply@fixomni.com>"
 *
 * If SMTP is not configured, the OTP is logged to console and returned in the
 * API response as `demoOtp` (same as the phone-OTP demo mode). This keeps
 * development/testing smooth without requiring live email setup.
 */

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? `Fix Omni <${SMTP_USER}>`;

export const isEmailConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

function createTransport() {
  if (!isEmailConfigured) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

interface SendOtpOptions {
  to: string;
  recipientName: string;
  otp: string;
  /** Optional extra context lines added below the OTP (e.g. "Your Tech ID: TECH-XXXX") */
  extraLines?: string[];
}

/**
 * Send a 6-digit OTP to the given email.
 * Returns `{ sent: true }` if email was dispatched, `{ sent: false, demoOtp }` if SMTP is not configured.
 */
export async function sendOtpEmail(opts: SendOtpOptions): Promise<{ sent: boolean; demoOtp?: string }> {
  const { to, recipientName, otp, extraLines = [] } = opts;

  if (!isEmailConfigured) {
    console.log(`[EMAIL-DEV] OTP for ${to}: ${otp}`);
    return { sent: false, demoOtp: otp };
  }

  const transport = createTransport()!;

  const extraHtml = extraLines
    .map((l) => `<p style="margin:6px 0;color:#64748b;font-size:14px;">${l}</p>`)
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#1e293b;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">🔐 Fix Omni</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Secure Verification Code</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#e2e8f0;font-size:16px;margin:0 0 8px;">Hello, <strong>${recipientName}</strong></p>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">
        Your Fix Omni one-time verification code is:
      </p>
      <div style="background:#0f172a;border:2px dashed #6366f1;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
        <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#a5b4fc;">${otp}</span>
      </div>
      ${extraHtml}
      <p style="color:#64748b;font-size:13px;margin:20px 0 0;line-height:1.6;">
        ⏱️ This code is valid for <strong style="color:#94a3b8;">10 minutes</strong>.<br>
        Do not share this code with anyone.<br>
        If you didn't request this, please ignore this email.
      </p>
    </div>
    <div style="background:#0f172a;padding:16px 32px;text-align:center;">
      <p style="color:#334155;font-size:12px;margin:0;">
        © Fix Omni — Automated message, please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;

  await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject: `${otp} — Fix Omni Verification Code`,
    html,
    text: `Your Fix Omni verification code is: ${otp}\n\nValid for 10 minutes. Do not share.\n${extraLines.join("\n")}`,
  });

  return { sent: true };
}
