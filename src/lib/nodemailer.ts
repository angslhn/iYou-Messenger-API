import { createTransport } from 'nodemailer';
import { env } from '@/config/env.js';

/**
 * Instance transporter Nodemailer yang dikonfigurasi untuk menangani pengiriman email keluar.
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.GMAIL_USER,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
});