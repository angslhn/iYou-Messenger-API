import { env } from '@/config/env.js';

import rateLimit from 'express-rate-limit';

import type { RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Middleware khusus untuk membatasi laju permintaan (rate limiting) pada endpoint verify.
 * Bertujuan untuk melindungi sistem dari serangan Brute Force dan Credential Stuffing.
 * Jika sebuah IP melampaui batas percobaan verify yang ditentukan, sistem akan
 * secara otomatis memblokir akses sementara dan mengembalikan respons HTTP 429 (Too Many Requests).
 */
const verifyLimiter: RateLimitRequestHandler = rateLimit({
  // Durasi jendela waktu memori/pemblokiran: beberapa waktu (dalam milidetik)
  windowMs: env.VERIFY_LIMIT_DURATION_TIME,

  // Batas maksimal percobaan (request) verify per IP dalam rentang waktu windowMs
  limit: env.VERIFY_LIMIT,

  // Format respons JSON yang dikembalikan ketika batas maksimal terlampaui
  message: {
    title: 'Too Many Requests',
    message: 'You have exceeded the maximum number of requests. Please try again after a while.',
  },

  // Mengirimkan informasi rate limit pada HTTP headers standar terbaru
  // (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset)
  standardHeaders: true,

  // Menonaktifkan pengiriman informasi rate limit pada HTTP headers lama/usang
  // (X-RateLimit-Limit, X-RateLimit-Remaining) untuk menghemat bandwidth
  legacyHeaders: false,
});

export default verifyLimiter;
