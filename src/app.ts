import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { env } from '@/config/env.js';

import mainRoutes from '@/routes/main.route.js';
import globalError from '@/middlewares/global-error.js';

import type { CorsOptions } from 'cors';
import type { RateLimitRequestHandler } from 'express-rate-limit';

const app = express();

// Diperlukan agar Express percaya pada proxy header seperti X-Forwarded-For
// Penting untuk rate limiting yang akurat di balik reverse proxy Railway
app.set('trust proxy', 1);

// Rate limiting — maksimum request per windowMs per IP
// Mencegah brute force dan abuse endpoint
const limiter: RateLimitRequestHandler = rateLimit({
  windowMs: env.GLOBAL_LIMIT_DURATION_TIME,
  limit: env.GLOBAL_LIMIT,
  message: {
    title: 'Too Many Requests',
    message: 'You have exceeded the maximum number of requests. Please try again after a while.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Konfigurasi CORS — hanya izinkan request dari CLIENT_ORIGIN
// credentials: true diperlukan agar cookie JWT bisa dikirim dari FE
const corsOptions: CorsOptions = {
  origin: env.CLIENT_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// Security headers — mencegah XSS, clickjacking, dan serangan umum lainnya
app.use(helmet());

// CORS — hanya izinkan origin yang terdaftar
app.use(cors(corsOptions));

// Rate limiting — batasi request per IP
app.use(limiter);

// Parse cookie dari request header — dibutuhkan untuk JWT cookie
app.use(cookieParser());

// Parse JSON body — limit 10kb untuk mencegah payload attack
app.use(express.json({ limit: '10kb' }));

// Main router — semua endpoint API terdaftar di sini
app.use('/api/v1', mainRoutes);

// Handle unknown route
app.use((req, res) => {
  if (env.NODE_ENV === 'development') {
    res.status(404).json({
      error: 'Not Found',
      message: `Route [${req.method.toUpperCase()}] ${req.originalUrl} not found on server.`,
    });
  } else {
    // Balik ke mode silent saat production
    res.sendStatus(404);
  }
});

// Global error handler — harus dipasang paling akhir
app.use(globalError);

export default app;
