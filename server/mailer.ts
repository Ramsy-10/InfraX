import nodemailer from 'nodemailer';

export interface EmailDeliveryStatus {
  configured: boolean;
  provider: 'resend' | 'smtp' | null;
}

export function getEmailDeliveryStatus(): EmailDeliveryStatus {
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
    return { configured: true, provider: 'resend' };
  }
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_HOST.trim() &&
    process.env.SMTP_USER.trim()
  ) {
    return { configured: true, provider: 'smtp' };
  }
  return { configured: false, provider: null };
}

export async function sendVotingOtpEmail(params: {
  toEmail: string;
  otpCode: string;
  schoolName: string;
  expiresInMinutes: number;
}): Promise<void> {
  const status = getEmailDeliveryStatus();
  if (!status.configured) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  const subject = 'InfraX Short Film Voting — Your 6-Digit Verification Code';
  const textBody = [
    'InfraX — Short Film Competition (People’s Choice)',
    'Organized by ICT Club, Bandaranayaka College – Kegalle',
    '',
    `School: ${params.schoolName}`,
    `Your 6-digit verification code is: ${params.otpCode}`,
    '',
    `This code expires in ${params.expiresInMinutes} minutes and can only be used once.`,
    'If you did not request this verification code, you can ignore this email.',
  ].join('\n');

  const htmlBody = `
    <div style="background:#050505;color:#ffffff;font-family:Arial,Helvetica,sans-serif;padding:32px 24px;">
      <div style="max-width:520px;margin:0 auto;border:1px solid #262626;background:#111111;padding:32px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#AEDD00;font-weight:700;">
          INFRAX · SHORT FILM VOTING
        </p>
        <h1 style="margin:12px 0 0;font-size:22px;color:#ffffff;font-weight:700;">
          Email Verification Code
        </h1>
        <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#A0A0A0;">
          Use the six-digit verification code below to verify your eligibility for <strong style="color:#ffffff;">${escapeHtml(params.schoolName)}</strong> and cast your Short Film vote.
        </p>
        <div style="margin:24px 0;padding:18px 20px;border:1px solid #AEDD00;background:#050505;text-align:center;">
          <span style="font-family:monospace;font-size:32px;letter-spacing:0.28em;font-weight:700;color:#AEDD00;">
            ${escapeHtml(params.otpCode)}
          </span>
        </div>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#A0A0A0;">
          This code expires in ${params.expiresInMinutes} minutes. One verified email address may cast one vote.
        </p>
      </div>
    </div>
  `;

  if (status.provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY!.trim();
    const fromEmail =
      process.env.VOTING_FROM_EMAIL?.trim() || 'InfraX Voting <onboarding@resend.dev>';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.toEmail],
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => null)) as
        | { message?: string; name?: string }
        | null;
      const reason = errBody?.message || `HTTP ${response.status}`;
      if (response.status === 403 && reason.toLowerCase().includes('verify a domain')) {
        throw new Error(
          `RESEND_DELIVERY_ERROR: ${reason} Configure a verified sender domain in VOTING_FROM_EMAIL to send OTP codes to external student emails.`
        );
      }
      throw new Error(`RESEND_DELIVERY_ERROR: ${reason}`);
    }
    return;
  }

  // SMTP via Nodemailer
  const port = Number(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!,
    },
  });

  const fromEmail =
    process.env.SMTP_FROM?.trim() ||
    process.env.VOTING_FROM_EMAIL?.trim() ||
    process.env.SMTP_USER!.trim();

  await transporter.sendMail({
    from: fromEmail,
    to: params.toEmail,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
