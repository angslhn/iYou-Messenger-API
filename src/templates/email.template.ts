import { env } from '@/config/env.js';

import type { EmailContext } from '@/helpers/mailer.js';

/**
 * Format Date ke string yang human-readable untuk email.
 * Menggunakan timezone UTC.
 *
 * @param {Date} date - Objek Date yang akan diformat
 * @returns {string} Contoh: "Friday, April 4, 2025 · 09:41 AM UTC"
 */
const formatEmailDate = (date: Date): string => {
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);

  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(date);

  return `${dateStr} &middot; ${timeStr} UTC`;
};

const yearNow = new Date().getFullYear();

/**
 * Template email verifikasi akun dengan kode OTP.
 *
 * @param {string} username - Username penerima
 * @param {string} otp - Kode OTP 6 digit
 * @param {EmailContext} context - Konteks pengiriman email
 * @returns {string} HTML email
 */
export const verifyCodeTemplate = (
  username: string,
  otp: string,
  context: EmailContext = 'register'
): string => {
  const digits = otp.split('');

  const digitCell = (digit: string) => `
    <td style="padding:0 5px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="
            width:50px;
            height:55px;
            background:#f7f7f7;
            border:1.5px solid #e8e8e8;
            border-radius:5px;
            text-align:center;
            vertical-align:middle;
            font-family:'DM Sans','Verdana',sans-serif;
            font-size:28px;
            font-weight:700;
            color:#0e0e0e;
            letter-spacing:0;
          ">${digit}</td>
        </tr>
      </table>
    </td>`;

const copy = {
  register: {
    title: 'Verify Your Account',
    subtitle: 'Thanks for signing up! Enter the verification code below to activate your account.',
    warning: 'Never share this code with anyone. iYou Messenger will never ask for your verification code via call, chat, or email.',
    footer: "If you didn't create an account with iYou Messenger, you can safely ignore this email. Someone may have entered your email address by mistake.",
  },
  resend: {
    title: 'Your New Verification Code',
    subtitle: "You requested a new verification code. Use the code below to complete your account verification.",
    warning: 'Never share this code with anyone. iYou Messenger will never ask for your verification code via call, chat, or email.',
    footer: "If you didn't request a new code, you can safely ignore this email. Someone may have entered your email address by mistake.",
  },
  change_email: {
    title: 'Verify Your New Email',
    subtitle: 'We received a request to change your email address. Enter the code below to confirm your new email.',
    warning: "If you didn't request an email change, please secure your account immediately by changing your password.",
    footer: "If you didn't request an email change, you can safely ignore this email. Your current email address will remain unchanged.",
  },
  change_phone: {
    title: 'Verify Your New Phone Number',
    subtitle: 'We received a request to change your phone number. Enter the code below to confirm your new number.',
    warning: "If you didn't request a phone number change, please secure your account immediately by changing your password.",
    footer: "If you didn't request a phone number change, you can safely ignore this email. Your current phone number will remain unchanged.",
  },
}[context];

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${copy.title} — iYou Messenger</title>
    </head>
    <body style="margin:0;padding:0;background:#f0f0f0;font-family:'DM Sans','Verdana',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 40px rgba(0,0,0,0.10);">

            <!-- HEADER -->
            <tr>
              <td style="background:#0e0e0e;padding:36px 48px 32px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:26px;font-weight:700;color:#f0f0f0;letter-spacing:-0.5px;">
                      iYou<span style="color:#555555;">Messenger</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding:48px 48px 40px;background:#ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">

                  <!-- Greeting -->
                  <tr>
                    <td style="font-size:13px;color:#999999;padding-bottom:8px;">
                      Hello, ${username}
                    </td>
                  </tr>

                  <!-- Title -->
                  <tr>
                    <td style="font-size:22px;font-weight:700;color:#0e0e0e;letter-spacing:-0.5px;line-height:1.25;padding-bottom:20px;">
                      ${copy.title}
                    </td>
                  </tr>

                  <!-- Description -->
                  <tr>
                    <td style="font-size:15px;color:#555555;line-height:1.7;padding-bottom:36px;">
                      ${copy.subtitle}
                      The code is valid for <strong style="color:#0e0e0e;font-weight:600;">15 minutes</strong>.
                    </td>
                  </tr>

                  <!-- OTP Label -->
                  <tr>
                    <td align="center" style="padding-bottom:20px;">
                      <span style="font-size:11px;color:#aaaaaa;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;">
                        Your verification code
                      </span>
                    </td>
                  </tr>

                  <!-- OTP Digits -->
                  <tr>
                    <td align="center" style="padding-bottom:20px;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          ${digitCell(digits[0] ?? '0')}
                          ${digitCell(digits[1] ?? '0')}
                          ${digitCell(digits[2] ?? '0')}
                          ${digitCell(digits[3] ?? '0')}
                          ${digitCell(digits[4] ?? '0')}
                          ${digitCell(digits[5] ?? '0')}
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Expiry -->
                  <tr>
                    <td align="center" style="padding-bottom:32px;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="font-size:13px;color:#aaaaaa;padding:0 10px;">Expires in 15 minutes</td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Warning Box -->
                  <tr>
                    <td style="background:#fafafa;border:1px solid #f0f0f0;border-radius:10px;padding:16px 20px;">
                      <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="font-size:13px;color:#888888;line-height:1.6;">
                            ${copy.warning}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:28px 48px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:12px;color:#bbbbbb;line-height:1.7;">
                      ${copy.footer}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:12px;font-size:12px;color:#cccccc;">
                      &copy; ${yearNow} iYou Messenger
                      &nbsp;&middot;&nbsp;
                      <a href="${env.CLIENT_ORIGIN}/privacy" style="color:#888888;text-decoration:none;">Privacy Policy</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${env.CLIENT_ORIGIN}/terms" style="color:#888888;text-decoration:none;">Terms of Service</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
    </body>
    </html>`;
};

/**
 * Template email reset password dengan tombol redirect ke link token.
 *
 * @param {string} username - Username penerima
 * @param {string} token - Token reset password 64 karakter hex
 * @returns {string} HTML email
 */
export const resetPasswordTemplate = (username: string, token: string): string => {
  const resetUrl = `${env.CLIENT_ORIGIN}/reset-password/${token}`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Reset Your Password — iYou Messenger</title>
    </head>
    <body style="margin:0;padding:0;background:#f0f0f0;font-family:'DM Sans','Verdana',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 40px rgba(0,0,0,0.10);">

            <!-- HEADER -->
            <tr>
              <td style="background:#0e0e0e;padding:36px 48px 32px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:26px;font-weight:700;color:#f0f0f0;letter-spacing:-0.5px;">
                      iYou<span style="color:#555555;">Messenger</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding:48px 48px 40px;background:#ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">

                  <!-- Greeting -->
                  <tr>
                    <td style="font-size:13px;color:#999999;padding-bottom:8px;">
                      Hello, ${username}
                    </td>
                  </tr>

                  <!-- Title -->
                  <tr>
                    <td style="font-size:22px;font-weight:700;color:#0e0e0e;letter-spacing:-0.5px;line-height:1.25;padding-bottom:20px;">
                      Reset Your Password
                    </td>
                  </tr>

                  <!-- Description -->
                  <tr>
                    <td style="font-size:15px;color:#555555;line-height:1.7;padding-bottom:28px;">
                      We received a request to reset the password for your iYou Messenger account.
                      Click the button below to create a new password.
                    </td>
                  </tr>

                  <!-- Hero Dark Box -->
                  <tr>
                    <td style="background:#0e0e0e;border-radius:12px;padding:32px;text-align:center;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="font-size:36px;padding-bottom:16px;">&#128273;</td>
                        </tr>
                        <tr>
                          <td style="font-size:14px;color:#666666;line-height:1.6;padding-bottom:24px;">
                            This link will take you to a secure page where<br>you can set a new password for your account.
                          </td>
                        </tr>
                        <tr>
                          <td align="center">
                            <a href="${resetUrl}"
                              style="display:inline-block;background:#f5f5f5;color:#0e0e0e;text-decoration:none;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;letter-spacing:-0.2px;">
                              Reset My Password
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Expiry Badge -->
                  <tr>
                    <td style="padding-top:20px;padding-bottom:28px;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="background:#fff8ed;border:1px solid #fde8b8;border-radius:20px;padding:6px 14px;font-size:12px;color:#b07d2a;font-weight:500;">
                            &#9203; Link expires in 15 minutes
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Divider -->
                  <tr>
                    <td style="height:1px;background:#f0f0f0;padding:0;font-size:0;">&nbsp;</td>
                  </tr>

                  <!-- URL Fallback -->
                  <tr>
                    <td style="padding-top:28px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="background:#f7f7f7;border:1px solid #efefef;border-radius:8px;padding:16px 20px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="font-size:11px;color:#aaaaaa;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;padding-bottom:8px;">
                                  Or copy this link
                                </td>
                              </tr>
                              <tr>
                                <td style="font-family:'Courier New',Courier,monospace;font-size:11px;color:#888888;word-break:break-all;line-height:1.5;">
                                  ${resetUrl}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:28px 48px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:12px;color:#bbbbbb;line-height:1.7;">
                      If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                      If you're concerned about your account security,
                      <a href="${env.CLIENT_ORIGIN}/login" style="color:#888888;text-decoration:none;border-bottom:1px solid #dddddd;">contact support</a>.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:12px;font-size:12px;color:#cccccc;">
                      &copy; ${yearNow} iYou Messenger
                      &nbsp;&middot;&nbsp;
                      <a href="${env.CLIENT_ORIGIN}/privacy" style="color:#888888;text-decoration:none;">Privacy Policy</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${env.CLIENT_ORIGIN}/terms" style="color:#888888;text-decoration:none;">Terms of Service</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
    </body>
    </html>`;
};

/**
 * Template email notifikasi perubahan email akun.
 * Dikirim ke email LAMA sebagai security alert.
 *
 * @param {string} username - Username penerima
 * @param {string} maskedOldEmail - Email lama yang sudah disamarkan (contoh: a***@gmail.com)
 * @returns {string} HTML email
 */
export const accountChangedTemplate = (username: string, maskedOldEmail: string): string => {
  const now = formatEmailDate(new Date());

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">\
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Email Change Request — iYou Messenger</title>
    </head>
    <body style="margin:0;padding:0;background:#f0f0f0;font-family:'DM Sans','Verdana',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 40px rgba(0,0,0,0.10);">

            <!-- HEADER -->
            <tr>
              <td style="background:#0e0e0e;padding:36px 48px 32px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:26px;font-weight:700;color:#f0f0f0;letter-spacing:-0.5px;">
                      iYou<span style="color:#555555;">Messenger</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- BODY -->
            <tr>
              <td style="padding:48px 48px 40px;background:#ffffff;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">

                  <!-- Greeting -->
                  <tr>
                    <td style="font-size:13px;color:#999999;padding-bottom:8px;">
                      Hello, ${username}
                    </td>
                  </tr>

                  <!-- Title -->
                  <tr>
                    <td style="font-size:22px;font-weight:700;color:#0e0e0e;letter-spacing:-0.5px;line-height:1.25;padding-bottom:20px;">
                      Your Email Address is Being Changed
                    </td>
                  </tr>

                  <!-- Alert Banner -->
                  <tr>
                    <td style="padding-bottom:28px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="background:#fff8f8;border:1px solid #fde8e8;border-radius:10px;padding:16px 20px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="width:28px;vertical-align:top;font-size:20px;padding-top:1px;">&#9888;&#65039;</td>
                                <td style="padding-left:12px;">
                                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                      <td style="font-size:14px;font-weight:600;color:#c0392b;padding-bottom:4px;">
                                        Security Alert
                                      </td>
                                    </tr>
                                    <tr>
                                      <td style="font-size:13px;color:#888888;line-height:1.6;">
                                        A request was made to change the email address linked to your iYou Messenger account.
                                        If this was you, no action is needed.
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Intro text -->
                  <tr>
                    <td style="font-size:15px;color:#555555;line-height:1.7;padding-bottom:24px;">
                      Here's a summary of what changed on your account:
                    </td>
                  </tr>

                  <!-- Timeline -->
                  <tr>
                    <td style="padding-bottom:28px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">

                        <!-- Timeline Item 1: Date -->
                        <tr>
                          <td style="vertical-align:top;width:32px;">
                            <table cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="width:32px;height:32px;background:#f7f7f7;border:1.5px solid #e8e8e8;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;">
                                  &#128197;
                                </td>
                              </tr>
                              <tr>
                                <td style="width:1px;height:24px;background:#f0f0f0;margin:0 auto;display:block;font-size:0;">&nbsp;</td>
                              </tr>
                            </table>
                          </td>
                          <td style="padding-left:16px;padding-bottom:24px;vertical-align:top;">
                            <table cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="font-size:11px;color:#aaaaaa;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:3px;">
                                  Date &amp; Time
                                </td>
                              </tr>
                              <tr>
                                <td style="font-size:14px;color:#0e0e0e;font-weight:500;">
                                  ${now}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Timeline Item 2: Previous Email -->
                        <tr>
                          <td style="vertical-align:top;width:32px;">
                            <table cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="width:32px;height:32px;background:#f7f7f7;border:1.5px solid #e8e8e8;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;">
                                  &#9993;&#65039;
                                </td>
                              </tr>
                              <tr>
                                <td style="width:1px;height:24px;background:#f0f0f0;margin:0 auto;display:block;font-size:0;">&nbsp;</td>
                              </tr>
                            </table>
                          </td>
                          <td style="padding-left:16px;padding-bottom:24px;vertical-align:top;">
                            <table cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="font-size:11px;color:#aaaaaa;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:3px;">
                                  Previous Email
                                </td>
                              </tr>
                              <tr>
                                <td style="font-size:14px;color:#0e0e0e;font-weight:500;">
                                  ${maskedOldEmail}
                                </td>
                              </tr>
                              <tr>
                                <td style="font-size:12px;color:#aaaaaa;padding-top:2px;">
                                  This address is being replaced
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Timeline Item 3: Status -->
                        <tr>
                          <td style="vertical-align:top;width:32px;">
                            <table cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="width:32px;height:32px;background:#f7f7f7;border:1.5px solid #e8e8e8;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;">
                                  &#128260;
                                </td>
                              </tr>
                            </table>
                          </td>
                          <td style="padding-left:16px;vertical-align:top;">
                            <table cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="font-size:11px;color:#aaaaaa;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:3px;">
                                  Status
                                </td>
                              </tr>
                              <tr>
                                <td style="font-size:14px;color:#0e0e0e;font-weight:500;">
                                  Pending verification
                                </td>
                              </tr>
                              <tr>
                                <td style="font-size:12px;color:#aaaaaa;padding-top:2px;">
                                  OTP has been sent to the new email
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>

                  <!-- Divider -->
                  <tr>
                    <td style="height:1px;background:#f0f0f0;padding:0;font-size:0;">&nbsp;</td>
                  </tr>

                  <!-- If not you -->
                  <tr>
                    <td style="padding-top:28px;padding-bottom:20px;font-size:15px;color:#555555;line-height:1.7;">
                      <strong style="color:#0e0e0e;font-weight:600;">Wasn't you?</strong>
                      If you didn't request this change, your account may be compromised.
                      Secure your account immediately by clicking below.
                    </td>
                  </tr>

                  <!-- Secure Button -->
                  <tr>
                    <td style="padding-bottom:20px;">
                      <a href="${env.CLIENT_ORIGIN}/login"
                        style="display:inline-block;background:#0e0e0e;color:#f5f5f5;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;letter-spacing:-0.2px;">
                        Secure My Account &rarr;
                      </a>
                    </td>
                  </tr>

                  <!-- Ignore Note -->
                  <tr>
                    <td style="background:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:14px 16px;font-size:13px;color:#aaaaaa;line-height:1.6;">
                      If this was you, you can safely ignore this email. The change will only take effect
                      after the OTP sent to your new email address is verified.
                    </td>
                  </tr>

                </table>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background:#fafafa;border-top:1px solid #f0f0f0;padding:28px 48px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:12px;color:#bbbbbb;line-height:1.7;">
                      This is an automated security notification from iYou Messenger.
                      For help, visit our
                      <a href="${env.CLIENT_ORIGIN}/help" style="color:#888888;text-decoration:none;border-bottom:1px solid #dddddd;">Help Center</a>
                      or
                      <a href="${env.CLIENT_ORIGIN}/support" style="color:#888888;text-decoration:none;border-bottom:1px solid #dddddd;">contact support</a>.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:12px;font-size:12px;color:#cccccc;">
                      &copy; ${yearNow} iYou Messenger
                      &nbsp;&middot;&nbsp;
                      <a href="${env.CLIENT_ORIGIN}/privacy" style="color:#888888;text-decoration:none;">Privacy Policy</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${env.CLIENT_ORIGIN}/terms" style="color:#888888;text-decoration:none;">Terms of Service</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
    </body>
    </html>`;
};
