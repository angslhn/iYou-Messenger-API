import { env } from '@/config/env.js';

import * as Mask from '@/helpers/mask.js';
import * as User from '@/models/user.model.js';
import * as AuthService from '@/services/auth.service.js';
import * as WsManager from '@/lib/ws.js';

import type { NextFunction, Request, Response } from 'express';
import type { UserData } from '@/@types/globals.js';

/**
 * Menangani permintaan pendaftaran pengguna baru.
 * Meneruskan data registrasi ke service dan mengembalikan ID pengguna yang terdaftar.
 *
 * @param {Request} req - Request berisi username, email, dan password di body
 * @param {Response} res - Response 201 dengan ID pengguna jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 * @returns {Promise<void>}
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload: Pick<UserData, 'fullname' | 'username' | 'email' | 'password'> = req.body;

    await AuthService.register(payload);

    res.status(201).json({
      title: 'Registration Successful',
      message: `Your registration was successful, we have sent your verification code via email address ${Mask.email(payload.email)}, please check your inbox.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan verifikasi pengguna menggunakan kode OTP.
 * Meneruskan email dan otp ke service untuk divalidasi.
 *
 * @param {Request} req - Request berisi email dan otp di body
 * @param {Response} res - Response 200 jika verifikasi berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 * @returns {Promise<void>}
 */
export const verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload: { email: string; otp: string } = req.body;

    await AuthService.verify(payload);

    res.status(200).json({
      title: 'Verification Successful',
      message:
        'Your verification is successful, please log in to your account first to continue using this platform.',
      redirect: 'login',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengiriman ulang kode OTP verifikasi email.
 * Meneruskan email pengguna ke service untuk diproses dan mengirim kode baru.
 *
 * @param {Request} req - Request berisi email di body
 * @param {Response} res - Response 200 jika pengiriman ulang berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 * @returns {Promise<void>}
 */
export const resend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email }: { email: string } = req.body;

    await AuthService.resend(email);

    res.status(200).json({
      title: 'Resend Code Successful',
      message: `We have sent a new verification code to the email address ${Mask.email(email)}, please check your email inbox.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan autentikasi login pengguna.
 * Meneruskan identifier dan password ke service, lalu menyimpan JWT token
 * ke dalam cookie HTTP-only setelah autentikasi berhasil.
 *
 * @param {Request} req - Request berisi identifier dan password di body
 * @param {Response} res - Response 200 dengan cookie JWT jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 * @returns {Promise<void>}
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload: { identifier: string; password: string } = req.body;

    const token = await AuthService.login(payload);

    res.cookie(env.AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: env.AUTH_COOKIE_MAX_AGE,
      path: '/',
    });

    res.status(200).json({
      title: 'Login Successful',
      message:
        'Your login is successful, now you can use this platform to interact with all your social friends.',
      redirect: 'chat',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan lupa password pengguna menggunakan identifier.
 * Meneruskan identifier ke service dan mengembalikan informasi pengiriman
 * token reset password beserta kontak yang disamarkan.
 *
 * @param {Request} req - Request berisi identifier di body
 * @param {Response} res - Response 200 dengan informasi pengiriman jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 * @returns {Promise<void>}
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { identifier }: { identifier: string } = req.body;

    const { type, maskedContact } = await AuthService.forgotPassword(identifier);

    const via = type === 'email' ? 'email' : 'phone number';

    const inbox = type === 'email' ? 'inbox' : 'messages';

    res.status(200).json({
      title: 'Recovery Password Request Successful',
      message: `Your password recovery request was successful. We've sent you a link to reset your password via your ${via} ${maskedContact}. Please check your ${inbox}.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan reset password pengguna menggunakan token verifikasi.
 * Meneruskan token dan password baru ke service untuk diproses.
 *
 * @param {Request} req - Request berisi token dan new_password di body
 * @param {Response} res - Response 200 jika reset password berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 * @returns {Promise<void>}
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payload: { token: string; new_password: string } = req.body;

    await AuthService.resetPassword(payload);

    res.status(200).json({
      title: 'Reset Password Successful',
      message:
        'Your account password reset was successful, please log in to your account first to continue using this platform.',
      redirect: 'login',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan logout pengguna.
 * Menghapus cookie autentikasi dan memperbarui status online pengguna.
 *
 * @param {Request} req - Request berisi data user dari JWT middleware
 * @param {Response} res - Response 200 jika logout berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 * @returns {Promise<void>}
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Hapus cookie autentikasi
    res.clearCookie(env.AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'none',
      path: '/',
    });

    // Update status online user menjadi offline
    await User.updateById({
      id: req.user.id,
      is_online: false,
      last_seen: new Date(),
    });

    // Putus koneksi WebSocket secara paksa dari sisi server
    const activeSocket = WsManager.getConnection(req.user.id);

    if (activeSocket) {
      activeSocket.close(1000, 'User logged out');
    }

    res.status(200).json({
      title: 'Logout Successful',
      message:
        'You have been logged out successfully. Your session has been ended and your account is now offline.',
    });
  } catch (err) {
    next(err);
  }
};
