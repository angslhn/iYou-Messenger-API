import { createTransport } from 'nodemailer';
import { env } from '@/config/env.js';

/**
 * Instance transporter Nodemailer yang dikonfigurasi untuk menangani pengiriman email keluar.
 */
export const transporter = createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: env.GMAIL_USER,
    clientId: env.GMAIL_CLIENT_ID,
    clientSecret: env.GMAIL_CLIENT_SECRET,
    refreshToken: env.GMAIL_REFRESH_TOKEN,
  },
});