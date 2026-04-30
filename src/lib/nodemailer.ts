import { createTransport } from 'nodemailer';
import { env } from '@/config/env.js';

/**
 * Instance transporter Nodemailer yang dikonfigurasi untuk menangani pengiriman email keluar.
 */
export const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: env.SMTP_EMAIL,
    pass: env.SMTP_PASSWORD,
  },
});
