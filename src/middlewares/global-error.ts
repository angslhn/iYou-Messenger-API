import { env } from '@/config/env.js';
import ResponseError from '@/utils/response-error.js';

import type { Request, Response, NextFunction } from 'express';

// Error dari PostgreSQL (pg package)
interface PgError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

// Error dari JWT (jsonwebtoken package)
interface JwtError extends Error {
  name: 'JsonWebTokenError' | 'TokenExpiredError' | 'NotBeforeError';
  expiredAt?: Date;
}

// Error dari Nodemailer (nodemailer package)
interface MailError extends Error {
  code?: 'EAUTH' | 'ECONNREFUSED' | 'EMESSAGE';
  command?: string;
}

// Union semua tipe error yang mungkin terjadi
type AppError = PgError | JwtError | MailError | ResponseError;

/**
 * Middleware global untuk menangani semua error yang terjadi di aplikasi.
 * Menangkap error dari PostgreSQL, JWT, Nodemailer, dan ResponseError buatan sendiri.
 * Error detail hanya ditampilkan di environment development, production hanya pesan umum.
 *
 * @param {AppError} err - Object error yang diterima dari middleware sebelumnya
 * @param {Request} req - Object request Express
 * @param {Response} res - Object response Express
 * @param {NextFunction} _next - Fungsi next Express (tidak dipakai, wajib ada untuk signature error handler)
 * @returns {void} Mengembalikan response JSON dengan status code dan pesan error
 */
export default function globalError(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let title = 'A Process Error Occurred';
  let message = 'An error occurred on the server and it was unable to process the request.';

  if (err instanceof ResponseError) {
    // Error yang sengaja dilempar dari service atau controller
    statusCode = err.statusCode;
    title = err.title;
    message = err.message;
  } else if ((err as PgError).code === '23505') {
    // PostgreSQL: unique/duplicate violation
    statusCode = 409;
    title = 'Duplicate Field Value';
    message =
      env.NODE_ENV === 'production'
        ? 'The data you submitted already exists in the system. Please use a different value and try again.'
        : `The data you submitted already exists in the system: ${(err as PgError).detail ?? (err as PgError).constraint ?? 'unknown field'}. Please use a different value and try again.`;
  } else if ((err as PgError).code === '23503') {
    // PostgreSQL: foreign key violation
    statusCode = 400;
    title = 'Invalid Reference';
    message =
      env.NODE_ENV === 'production'
        ? 'The data you referenced does not exist in the system. Please ensure the referenced data exists before trying again.'
        : `The data you referenced does not exist in the system: ${(err as PgError).detail ?? 'unknown'}. Please ensure the referenced data exists before trying again.`;
  } else if ((err as PgError).code === '23502') {
    // PostgreSQL: not null violation
    statusCode = 400;
    title = 'Missing Required Field';
    message =
      env.NODE_ENV === 'production'
        ? 'A required field is missing from your request. Please ensure all required fields are filled in and try again.'
        : `A required field is missing from your request: ${(err as PgError).detail ?? 'unknown'}. Please ensure all required fields are filled in and try again.`;
  } else if (err.name === 'JsonWebTokenError') {
    // JWT: token tidak valid atau malformed
    statusCode = 401;
    title = 'Invalid Token';
    message =
      'Access denied, the token provided is invalid or malformed. Please login again to get a new token.';
  } else if (err.name === 'TokenExpiredError') {
    // JWT: token sudah kadaluwarsa
    statusCode = 401;
    title = 'Token Expired';
    message =
      'Access denied, your session has expired. Please login again to continue using the platform.';
  } else if (err.name === 'NotBeforeError') {
    // JWT: token belum aktif
    statusCode = 401;
    title = 'Token Not Active';
    message = 'Access denied, the token provided is not active yet. Please try again in a moment.';
  } else if ((err as MailError).code === 'EAUTH') {
    // Nodemailer: autentikasi Gmail gagal
    statusCode = 503;
    title = 'Mail Service Error';
    message =
      'The mail service failed to authenticate. Please try again later or contact support if the issue persists.';
  } else if ((err as MailError).code === 'ECONNREFUSED') {
    // Nodemailer/DB: koneksi ke service gagal
    statusCode = 503;
    title = 'Service Unavailable';
    message =
      'Unable to connect to a required service at this time. Please try again in a few moments.';
  } else if ((err as MailError).code === 'EMESSAGE') {
    // Nodemailer: pesan email gagal dikirim
    statusCode = 503;
    title = 'Mail Delivery Failed';
    message =
      'Your email could not be delivered at this time. Please check your email address and try again later.';
  }

  const response: {
    title: string;
    message: string;
    redirect?: 'home' | 'login' | 'register' | 'verify' | 'forgot_password';
    email?: string;
    stack?: string;
  } = { title, message };

  if (err instanceof ResponseError && err.redirect) {
    response.redirect = err.redirect;

    if (err.email) response.email = err.email;
  }

  if (env.NODE_ENV === 'production') {
    // Sembunyikan detail error internal di production
    if (statusCode === 500) response.title = 'Internal Server Error';
    response.stack = undefined;
  } else {
    // Tampilkan error detail di development untuk debugging
    console.error(`[ERROR] ${req.method} ${req.path}`, err);
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
