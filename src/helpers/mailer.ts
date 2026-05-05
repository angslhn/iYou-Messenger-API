import { env } from '@/config/env.js';
import { transporter } from '@/lib/nodemailer.js';

import {
  verifyCodeTemplate,
  resetPasswordTemplate,
  accountChangedTemplate,
} from '@/templates/email.template.js';

export type EmailContext = 'register' | 'resend' | 'change_email' | 'change_phone';

/**
 * Mengirim kode OTP ke email pengguna untuk verifikasi akun.
 *
 * @param {string} email - Alamat email tujuan
 * @param {string} username - Username penerima
 * @param {string} otp - Kode OTP 6 digit
 * @returns {Promise<void>}
 */
export const sendEmailVerifyCode = async (
  email: string,
  username: string,
  otp: string,
  context: EmailContext
): Promise<void> => {
  const subject = { register: 'Verify Your Account', resend: 'Your New Verification Code', change_email: 'Verify Your New Email', change_phone: 'Verify Your New Phone Number' }[context]

  await transporter.sendMail({
    from: `"iYou Messenger" <${env.GMAIL_USER}>`,
    to: email,
    subject: `${subject} — iYou Messenger`,
    html: verifyCodeTemplate(username, otp, context),
  });
};

/**
 * Mengirim tautan reset password ke email pengguna.
 *
 * @param {string} email - Alamat email tujuan
 * @param {string} username - Username penerima
 * @param {string} token - Token reset password 64 karakter hex
 * @returns {Promise<void>}
 */
export const sendEmailResetPassword = async (
  email: string,
  username: string,
  token: string,
): Promise<void> => {
  await transporter.sendMail({
    from: `"iYou Messenger" <${env.GMAIL_USER}>`,
    to: email,
    subject: 'Reset Your Password — iYou Messenger',
    html: resetPasswordTemplate(username, token),
  });
};

/**
 * Mengirim notifikasi ke email lama pengguna bahwa ada permintaan perubahan email.
 *
 * @param {string} email - Alamat email lama pengguna
 * @param {string} username - Username pengguna
 * @param {string} maskedOldEmail - Email lama yang sudah disamarkan (contoh: a***@gmail.com)
 * @returns {Promise<void>}
 */
export const sendEmailAccountChanged = async (
  email: string,
  username: string,
  maskedOldEmail: string,
): Promise<void> => {
  await transporter.sendMail({
    from: `"iYou Messenger" <${env.GMAIL_USER}>`,
    to: email,
    subject: 'Email Change Request — iYou Messenger',
    html: accountChangedTemplate(username, maskedOldEmail),
  });
};
