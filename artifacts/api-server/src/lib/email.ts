/**
 * Email service — Gmail OAuth2 via nodemailer.
 *
 * Secrets required (set in Replit Secrets):
 *   GMAIL_CLIENT_ID      — OAuth2 client ID from Google Cloud Console
 *   GMAIL_CLIENT_SECRET  — OAuth2 client secret
 *   GMAIL_REFRESH_TOKEN  — Long-lived refresh token for officialfixomnihelp@gmail.com
 *
 * If credentials are missing the OTP is logged to console and returned in the
 * API response as `demoOtp` so development keeps working without live email.
 */

import nodemailer from "nodemailer";

const SENDER  = "officialfixomnihelp@gmail.com";
const FROM    = `Fix Omni <${SENDER}>`;

const CLIENT_ID     = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

export const isEmailConfigured = !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);

/** Create a fresh transporter each call so token refresh always works. */
function createTransport() {
  if (!isEmailConfigured) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type:         "OAuth2",
      user:         SENDER,
      clientId:     CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshToken: REFRESH_TOKEN,
    },
  } as Parameters<typeof nodemailer.createTransport>[0]);
}

interface SendOtpOptions {
  to: string;
  recipientName: string;
  otp: string;
  /** Optional extra context lines added below the OTP */
  extraLines?: string[];
}

/**
 * Send a 6-digit OTP to the given email.
 * Returns `{ sent: true }` if dispatched, `{ sent: false, demoOtp }` if not configured.
 */
export async function sendOtpEmail(
  opts: SendOtpOptions
): Promise<{ sent: boolean; demoOtp?: string }> {
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
    from:    FROM,
    to,
    subject: `${otp} — Fix Omni Verification Code`,
    html,
    text: `Your Fix Omni verification code is: ${otp}\n\nValid for 10 minutes. Do not share.\n${extraLines.join("\n")}`,
  });

  return { sent: true };
}
