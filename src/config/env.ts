import DotenvFlow from 'dotenv-flow';

import type { StringValue } from 'ms';

// Load environment variables dari file .env
// silent: true agar tidak throw error jika file .env tidak ditemukan
DotenvFlow.config({ silent: true });

/**
 * Konfigurasi environment variable aplikasi.
 * Semua nilai diambil dari file .env melalui dotenv-flow.
 */
export type EnvConfig = {
  readonly PORT: number;
  readonly NODE_ENV: 'development' | 'production' | 'staging' | 'test';
  readonly SMTP_EMAIL: string;
  readonly SMTP_PASSWORD: string;
  readonly CLIENT_ORIGIN: string;
  readonly DATABASE_URL: string;
  readonly AUTH_COOKIE_NAME: string;
  readonly AUTH_COOKIE_MAX_AGE: number;
  readonly JWT_SECRET: string;
  readonly JWT_EXPIRES_IN: StringValue;
  readonly CLOUDINARY_CLOUD_NAME: string;
  readonly CLOUDINARY_API_KEY: string;
  readonly CLOUDINARY_API_SECRET: string;
  readonly REQUEST_COOLDOWN: number;
  readonly REQUEST_EMAIL_LIMIT: number;
  readonly IDENTIFIER_CHANGE_COOLDOWN: number;
  readonly IDENTIFIER_CHANGE_EXPIRES_IN: number;
  readonly REQUEST_EMAIL_LIMIT_RESET_TIME: number;
  readonly VERIFICATION_EXPIRES_IN: number;
  readonly GLOBAL_LIMIT: number;
  readonly GLOBAL_LIMIT_DURATION_TIME: number;
  readonly REGISTER_LIMIT: number;
  readonly REGISTER_LIMIT_DURATION_TIME: number;
  readonly LOGIN_LIMIT: number;
  readonly LOGIN_LIMIT_DURATION_TIME: number;
  readonly VERIFY_LIMIT: number;
  readonly VERIFY_LIMIT_DURATION_TIME: number;
  readonly RESEND_LIMIT: number;
  readonly RESEND_LIMIT_DURATION_TIME: number;
  readonly FORGOT_PASSWORD_LIMIT: number;
  readonly FORGOT_PASSWORD_LIMIT_DURATION_TIME: number;
  readonly RESET_PASSWORD_LIMIT: number;
  readonly RESET_PASSWORD_LIMIT_DURATION_TIME: number;
};

/**
 * Konfigurasi environment variable aplikasi.
 * Semua nilai diambil dari file .env melalui dotenv-flow.
 * Nilai default tersedia untuk beberapa konfigurasi opsional.
 */
export const env: EnvConfig = {
  // Server
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'staging' | 'test',

  // Client
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN as string,

  // Database
  DATABASE_URL: process.env.DATABASE_URL as string,

  // Nodemailer (Gmail SMTP)
  SMTP_EMAIL: process.env.SMTP_EMAIL as string,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD as string,

  // JWT & Cookie
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME as string,
  AUTH_COOKIE_MAX_AGE: Number(process.env.AUTH_COOKIE_MAX_AGE) || 1000 * 60 * 60 * 24 * 7, // Default: 7 hari
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_EXPIRES_IN: (process.env.JWT_EXPIRES_IN as StringValue) || '7d', // Default: 7 hari

  // Cloudinary (Cloud Storage untuk avatar)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME as string,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY as string,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET as string,

  // Rate Limiting & Cooldown
  REQUEST_COOLDOWN: Number(process.env.REQUEST_COOLDOWN) || 1000 * 60 * 1, // Default: 1 menit
  REQUEST_EMAIL_LIMIT: Number(process.env.REQUEST_EMAIL_LIMIT) || 3,
  REQUEST_EMAIL_LIMIT_RESET_TIME:
    Number(process.env.REQUEST_EMAIL_LIMIT_RESET_TIME) || 1000 * 60 * 60 * 24 * 1, // Default: 1 hari

  // Identifier & Verifikasi
  IDENTIFIER_CHANGE_COOLDOWN:
    Number(process.env.IDENTIFIER_CHANGE_COOLDOWN) || 1000 * 60 * 60 * 24 * 14, // Default: 14 hari
  IDENTIFIER_CHANGE_EXPIRES_IN: Number(process.env.IDENTIFIER_CHANGE_EXPIRES_IN) || 1000 * 60 * 5, // Default: 5 menit
  VERIFICATION_EXPIRES_IN: Number(process.env.VERIFICATION_EXPIRES_IN) || 1000 * 60 * 15, // Default: 15 menit

  // Middleware Limiter (Independent Setiap Route Jika Ada Perubahan)
  GLOBAL_LIMIT: Number(process.env.GLOBAL_LIMIT) || 1000,
  GLOBAL_LIMIT_DURATION_TIME: Number(process.env.GLOBAL_LIMIT_DURATION_TIME) || 15 * 60 * 1000, // Default: 15 menit
  REGISTER_LIMIT: Number(process.env.REGISTER_LIMIT) || 5,
  REGISTER_LIMIT_DURATION_TIME:
    Number(process.env.REGISTER_LIMIT_DURATION_TIME) || 1000 * 60 * 60 * 1, // Default: 1 jam
  LOGIN_LIMIT: Number(process.env.LOGIN_LIMIT) || 5,
  LOGIN_LIMIT_DURATION_TIME: Number(process.env.LOGIN_LIMIT_DURATION_TIME) || 1000 * 60 * 60 * 1, // Default: 1 jam
  VERIFY_LIMIT: Number(process.env.VERIFY_LIMIT) || 3,
  VERIFY_LIMIT_DURATION_TIME: Number(process.env.VERIFY_LIMIT_DURATION_TIME) || 1000 * 60 * 60 * 1, // Default: 1 jam
  RESEND_LIMIT: Number(process.env.RESEND_LIMIT) || 3,
  RESEND_LIMIT_DURATION_TIME: Number(process.env.RESEND_LIMIT_DURATION_TIME) || 1000 * 60 * 60 * 1, // Default: 1 jam
  FORGOT_PASSWORD_LIMIT: Number(process.env.FORGOT_PASSWORD_LIMIT) || 3,
  FORGOT_PASSWORD_LIMIT_DURATION_TIME:
    Number(process.env.FORGOT_PASSWORD_LIMIT_DURATION_TIME) || 1000 * 60 * 60 * 1, // Default: 1 jam
  RESET_PASSWORD_LIMIT: Number(process.env.RESET_PASSWORD_LIMIT) || 3,
  RESET_PASSWORD_LIMIT_DURATION_TIME:
    Number(process.env.RESET_PASSWORD_LIMIT_DURATION_TIME) || 1000 * 60 * 60 * 1, // Default: 1 jam
} as const;
