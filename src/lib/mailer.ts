import { env } from '@/config/env.js';

export type EmailContext = 'register' | 'resend' | 'change_email' | 'change_phone';

/**
 * Internal helper untuk mengirim POST request ke mailer service.
 *
 * @param {object} body - Payload yang akan dikirim ke mailer service
 * @returns {Promise<void>}
 */
const post = async (body: object): Promise<void> => {
  await fetch(`${env.MAILER_URL}/api/mail/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.MAILER_API_KEY,
    },
    body: JSON.stringify(body),
  });
};

/**
 * Mengirim kode OTP ke email pengguna untuk verifikasi akun.
 *
 * @param {string}       email    - Alamat email tujuan
 * @param {string}       username - Username penerima
 * @param {string}       otp      - Kode OTP 6 digit
 * @param {EmailContext} context  - Konteks pengiriman: 'register' | 'resend' | 'change_email' | 'change_phone'
 * @returns {Promise<void>}
 */
export const emailVerifyCode = async (
  email: string,
  username: string,
  otp: string,
  context: EmailContext,
): Promise<void> => {
  await post({ type: context, to: email, username, otp });
};

/**
 * Mengirim tautan reset password ke email pengguna.
 *
 * @param {string} email    - Alamat email tujuan
 * @param {string} username - Username penerima
 * @param {string} token    - Token reset password 64 karakter hex
 * @returns {Promise<void>}
 */
export const emailResetPassword = async (
  email: string,
  username: string,
  token: string,
): Promise<void> => {
  await post({ type: 'reset_password', to: email, username, token });
};

/**
 * Mengirim notifikasi ke email lama pengguna bahwa ada permintaan perubahan email.
 *
 * @param {string} email          - Alamat email lama pengguna
 * @param {string} username       - Username pengguna
 * @param {string} maskedOldEmail - Email lama yang sudah disamarkan (contoh: a***@gmail.com)
 * @returns {Promise<void>}
 */
export const emailAccountChanged = async (
  email: string,
  username: string,
  maskedOldEmail: string,
): Promise<void> => {
  await post({ type: 'account_changed', to: email, username, maskedOldEmail });
};
