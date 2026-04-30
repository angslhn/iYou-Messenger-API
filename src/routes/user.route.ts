import { Router } from 'express';

import * as UserController from '@/controllers/user.controller.js';
import * as UserValidator from '@/validators/user.validator.js';

import authorization from '@/middlewares/authorization.js';
import validation from '@/middlewares/validation.js';
import resendLimiter from '@/middlewares/resend-limiter.js';
import upload from '@/middlewares/upload.js';

const routes = Router();

// GET /api/v1/users/me - Ambil profile pengguna saat ini
routes.get('/me', authorization, UserController.getProfile);

// GET /api/v1/users/me/counters - Ambil jumlah notifikasi pengguna saat ini
routes.get('/me/counters', authorization, UserController.getCounters);

// GET /api/v1/users/search - Cari pengguna berdasarkan kriteria tertentu
routes.get('/search', authorization, UserController.searchUser);

// GET /api/v1/users/:userId - Ambil profil publik pengguna lain
routes.get('/:userId', authorization, UserController.getPublicProfile);

// POST /api/v1/users/find/pin - Cari pengguna menggunakan PIN unik
routes.post(
  '/find/pin',
  authorization,
  validation([{ name: 'pin', type: 'string' }], UserValidator.findUserByPin),
  UserController.findUserByPin,
);

// POST /api/v1/users/find/phone - Cari pengguna menggunakan nomor telepon
routes.post(
  '/find/phone',
  authorization,
  validation([{ name: 'phone', type: 'string' }], UserValidator.findUserByPhone),
  UserController.findUserByPhone,
);

// POST /api/v1/users/phone/verify - Verifikasi perubahan nomor telepon dengan OTP/Token
routes.post(
  '/phone/verify',
  authorization,
  validation(
    [
      { name: 'token', type: 'string' },
      { name: 'otp', type: 'string' },
    ],
    UserValidator.verifyUpdatePhone,
  ),
  UserController.verifyUpdatePhone,
);

// POST /api/v1/users/resend - Mengirim ulang kode OTP verifikasi ke email
routes.post(
  '/resend',
  resendLimiter,
  validation([{ name: 'email', type: 'string' }], UserValidator.resend),
  UserController.resend,
);

// POST /api/v1/users/email/verify - Verifikasi perubahan email dengan OTP/Token
routes.post(
  '/email/verify',
  authorization,
  validation(
    [
      { name: 'token', type: 'string' },
      { name: 'otp', type: 'string' },
    ],
    UserValidator.verifyUpdateEmail,
  ),
  UserController.verifyUpdateEmail,
);

// PATCH /api/v1/users/avatar - Perbarui foto profil
routes.patch('/avatar', authorization, upload('image'), UserController.updateAvatar);

// PATCH /api/v1/users/profile - Perbarui data profil (nama & about)
routes.patch(
  '/profile',
  authorization,
  validation(
    [
      { name: 'fullname', type: 'string', optional: true },
      { name: 'about', type: 'string', optional: true },
    ],
    UserValidator.updateProfile,
  ),
  UserController.updateProfile,
);

// PATCH /api/v1/users/username - Perbarui username pengguna
routes.patch(
  '/username',
  authorization,
  validation([{ name: 'username', type: 'string' }], UserValidator.updateUsername),
  UserController.updateUsername,
);

// PATCH /api/v1/users/email - Request perubahan alamat email
routes.patch(
  '/email',
  authorization,
  validation([{ name: 'email', type: 'string' }], UserValidator.updateEmail),
  UserController.updateEmail,
);

// PATCH /api/v1/users/phone - Request perubahan nomor telepon
routes.patch(
  '/phone',
  authorization,
  validation([{ name: 'phone', type: 'string' }], UserValidator.updatePhone),
  UserController.updatePhone,
);

// PATCH /api/v1/users/password - Perbarui password akun
routes.patch(
  '/password',
  authorization,
  validation(
    [
      { name: 'current_password', type: 'string' },
      { name: 'new_password', type: 'string' },
    ],
    UserValidator.updatePassword,
  ),
  UserController.updatePassword,
);

// PATCH /api/v1/users/hide-profile - Menyembunyikan profil pengguna dari pencarian
routes.patch(
  '/hide-profile',
  authorization,
  validation([{ name: 'value', type: 'boolean' }], UserValidator.updateHideProfile),
  UserController.updateHideProfile,
);

// PATCH /api/v1/users/show-last-seen - Menonaktifkan waktu terakhir dilihat
routes.patch(
  '/show-last-seen',
  authorization,
  validation([{ name: 'value', type: 'boolean' }], UserValidator.updateLastSeen),
  UserController.updateLastSeen,
);

// PATCH /api/v1/users/read-receipt - Status laporan dibaca (centang biru)
routes.patch(
  '/read-receipt',
  authorization,
  validation([{ name: 'value', type: 'boolean' }], UserValidator.updateReadReceipt),
  UserController.updateReadReceipt,
);

// PATCH /api/v1/users/story-receipt - Status laporan story dilihat
routes.patch(
  '/story-receipt',
  authorization,
  validation([{ name: 'value', type: 'boolean' }], UserValidator.updateStoryReceipt),
  UserController.updateStoryReceipt,
);

// PATCH /api/v1/users/pin - Generate PIN pengguna
routes.patch('/pin', authorization, UserController.cratePin);

// DELETE /api/v1/users/pin - Hapus PIN pengguna
routes.delete('/pin', authorization, UserController.deletePin);

// DELETE /api/v1/users/me - Hapus akun pengguna secara permanen
routes.delete(
  '/me',
  authorization,
  validation([{ name: 'password', type: 'string' }], UserValidator.deleteAccount),
  UserController.deleteAccount,
);

export default routes;
