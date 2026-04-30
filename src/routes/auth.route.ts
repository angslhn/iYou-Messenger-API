import { Router } from 'express';

import authorization from '@/middlewares/authorization.js';
import validation from '@/middlewares/validation.js';
import loginLimiter from '@/middlewares/login-limiter.js';
import registerLimiter from '@/middlewares/register-limiter.js';
import verifyLimiter from '@/middlewares/verify-limiter.js';
import forgotPasswordLimiter from '@/middlewares/forgot-password-limiter.js';
import resetPasswordLimiter from '@/middlewares/reset-password-limiter.js';

import * as AuthController from '@/controllers/auth.controller.js';
import * as AuthValidator from '@/validators/auth.validator.js';

const routes = Router();

// POST /api/v1/auth/register - Mendaftarkan akun pengguna baru
routes.post(
  '/register',
  registerLimiter,
  validation(
    [
      { name: 'fullname', type: 'string' },
      { name: 'username', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'password', type: 'string' },
    ],
    AuthValidator.register,
  ),
  AuthController.register,
);

// POST /api/v1/auth/verify - Verifikasi akun baru menggunakan kode OTP
routes.post(
  '/verify',
  verifyLimiter,
  validation(
    [
      { name: 'email', type: 'string' },
      { name: 'otp', type: 'string' },
    ],
    AuthValidator.verify,
  ),
  AuthController.verify,
);

// POST /api/v1/auth/resend - Mengirim ulang kode OTP verifikasi ke email
routes.post(
  '/resend',
  validation([{ name: 'email', type: 'string' }], AuthValidator.resend),
  AuthController.resend,
);

// POST /api/v1/auth/login - Masuk ke akun menggunakan username/email/phone dan password
routes.post(
  '/login',
  loginLimiter,
  validation(
    [
      { name: 'identifier', type: 'string' },
      { name: 'password', type: 'string' },
    ],
    AuthValidator.login,
  ),
  AuthController.login,
);

// POST /api/v1/auth/forgot-password - Mengajukan lupa password dan mengirim link/token reset
routes.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validation([{ name: 'identifier', type: 'string' }], AuthValidator.forgotPassword),
  AuthController.forgotPassword,
);

// POST /api/v1/auth/reset-password - Mengganti password lama dengan password baru menggunakan token
routes.post(
  '/reset-password',
  resetPasswordLimiter,
  validation(
    [
      { name: 'token', type: 'string' },
      { name: 'new_password', type: 'string' },
    ],
    AuthValidator.resetPassword,
  ),
  AuthController.resetPassword,
);

// POST /api/v1/auth/logout - Keluar dari sesi akun saat ini
routes.post('/logout', authorization, AuthController.logout);

export default routes;
