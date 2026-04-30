import { env } from '@/config/env.js';

import jsonwebtoken from 'jsonwebtoken';
import ResponseError from '@/utils/response-error.js';

import type { Request, Response, NextFunction } from 'express';
import type { UserToken } from '@/@types/globals.js';

/**
 * Middleware untuk memverifikasi autentikasi pengguna melalui JWT token di cookie.
 * Mengekstrak dan memvalidasi token, lalu menyimpan payload ke req.user
 * agar dapat diakses oleh controller selanjutnya.
 *
 * @param {Request} req - Request berisi cookie dengan JWT token
 * @param {Response} _res - Response Express (tidak dipakai)
 * @param {NextFunction} next - Meneruskan ke handler berikutnya atau error handler
 * @returns {void}
 * @throws {ResponseError} 401 - Jika token tidak ditemukan di cookie
 * @throws {JsonWebTokenError} - Jika token invalid atau malformed (ditangani globalError)
 * @throws {TokenExpiredError} - Jika token sudah kadaluwarsa (ditangani globalError)
 */
export default function authorization(req: Request, _res: Response, next: NextFunction): void {
  try {
    const jwtToken = req.cookies[env.AUTH_COOKIE_NAME];

    if (!jwtToken) {
      throw new ResponseError(
        401,
        'User Token Not Found',
        'User token not found, access is not allowed to continue the requested process.',
      );
    }

    const token = jsonwebtoken.verify(jwtToken, env.JWT_SECRET) as UserToken;

    req.user = token;

    next();
  } catch (err) {
    next(err);
  }
}
