import { env } from '@/config/env.js';

import * as Mask from '@/helpers/mask.js';
import * as WsManager from '@/lib/ws.js';
import * as UserService from '@/services/user.service.js';
import * as Friendship from '@/models/friendship.model.js';
import * as Conversation from '@/models/conversation.model.js';

import type { Request, Response, NextFunction } from 'express';

/**
 * Menangani permintaan pengambilan data profil pengguna yang sedang login.
 * Mengambil ID dari JWT payload dan meneruskan ke service untuk diproses.
 *
 * @param {Request} req - Request berisi data user dari JWT middleware
 * @param {Response} res - Response 200 dengan data profil pengguna
 * @param {NextFunction} next - Meneruskan error ke global error handler
 * @returns {Promise<void>}
 */
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;

    const profile = await UserService.getProfile(id);

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

/**
 * Mengambil jumlah notifikasi (badges) untuk navigasi bawah.
 *
 * @param {Request} req
 * @param {Response} res
 */
export const getCounters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    // Eksekusi kedua query COUNT secara paralel agar lebih cepat
    const [pendingRequests, pendingInvites] = await Promise.all([
      Friendship.countPendingRequests(userId),
      Conversation.countPendingInvites(userId),
    ]);

    res.status(200).json({
      pendingRequests,
      pendingInvites,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Menangani permintaan pengambilan profil publik pengguna lain berdasarkan ID.
 *
 * @param {Request} req - Request dengan param userId dan JWT payload di req.user
 * @param {Response} res - Response 200 dengan data profil publik
 * @param {NextFunction} next - Error handler
 * @returns {Promise<void>}
 */
export const getPublicProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId as string;

    const profile = await UserService.getPublicProfile(currentUserId, targetUserId);

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pencarian pengguna berdasarkan username.
 * Query pencarian diambil dari query parameter `q`.
 *
 * @param {Request} req - Request object dengan query parameter `q` dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const searchUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;
    const query = req.query.q as string;

    const profiles = await UserService.searchUser(id, query);

    res.status(200).json(profiles);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pencarian pengguna berdasarkan PIN unik.
 * PIN diambil dari request body.
 *
 * @param {Request} req - Request object dengan `pin` di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const findUserByPin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;
    const { pin }: { pin: string } = req.body;

    const profile = await UserService.findUserByPin(id, pin);

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pencarian pengguna berdasarkan nomor telepon.
 * nomor telepon diambil dari request body.
 *
 * @param {Request} req - Request object dengan `phone` di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const findUserByPhone = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;
    const { phone }: { phone: string } = req.body;

    const profile = await UserService.findUserByPhone(id, phone);

    if (!profile) return void res.sendStatus(200);

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pembaruan foto profil.
 * @param {Request} req - Request object file foto profil di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updateAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;

    // Di isi otomatis karena middleware upload.single('image') dari Multer
    const file = req.file;

    const avatarUrl = await UserService.updateAvatar(id, file?.buffer);

    res.status(200).json({
      title: 'Avatar Updated Successfully',
      message: 'Your profile picture has been updated',
      avatar_url: avatarUrl,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pembaruan profil pengguna.
 * Memperbarui fullname dan/atau about berdasarkan data yang dikirim di request body.
 *
 * @param {Request} req - Request object dengan `fullname` dan/atau `about` di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;
    const payload: { fullname?: string; about?: string } = req.body;

    await UserService.updateProfile(id, payload);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pembaruan username pengguna.
 * Username baru diambil dari request body.
 *
 * @param {Request} req - Request object dengan `username` di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updateUsername = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;
    const { username }: { username: string } = req.body;

    await UserService.updateUsername(id, username);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan perubahan email pengguna.
 * Mengirim OTP ke email baru dan notifikasi ke email lama.
 * Mengembalikan token untuk navigasi ke halaman verifikasi OTP.
 *
 * @param {Request} req - Request object dengan `email` di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updateEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;
    const { email }: { email: string } = req.body;

    const token = await UserService.updateEmail(id, email);

    res.status(200).json({ token });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan verifikasi OTP untuk perubahan email pengguna.
 * Token param dan kode OTP diambil dari request body.
 *
 * @param {Request} req - Request object dengan `token` dan `otp` di body
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const verifyUpdateEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { token, otp }: { token: string; otp: string } = req.body;

    await UserService.verifyUpdateEmail(token, otp);

    res.status(200).json({
      title: 'Email Changed Successfully',
      message:
        'The old email on your account has been successfully changed to a new email, notifications from this platform will be sent to your new email.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan perubahan nomor telepon pengguna.
 * Mengirim OTP ke email aktif pengguna sebagai verifikasi.
 * Mengembalikan token untuk navigasi ke halaman verifikasi OTP.
 *
 * @param {Request} req - Request object dengan `phone` di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updatePhone = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;
    const { phone }: { phone: string } = req.body;

    const token = await UserService.updatePhone(id, phone);

    res.status(200).json({ token });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan verifikasi OTP untuk perubahan nomor telepon pengguna.
 * Token param dan kode OTP diambil dari request body.
 *
 * @param {Request} req - Request object dengan `token` dan `otp` di body
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const verifyUpdatePhone = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { token, otp }: { token: string; otp: string } = req.body;

    await UserService.verifyUpdatePhone(token, otp);

    res.status(200).json({
      title: 'Phone Number Changed Successfully',
      message:
        'Your phone number has been successfully updated. Your new phone number is now linked to your account and can be used to connect with other users.',
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
    const { email, type }: { email: string; type: 'email_otp' | 'phone_otp' } = req.body;

    await UserService.resend(email, type);

    res.status(200).json({
      title: 'Resend Code Successful',
      message: `We have sent a new verification code to the email address ${Mask.email(email)}, please check your email inbox.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan perubahan password pengguna.
 * Memvalidasi password lama dan memperbarui dengan password baru.
 *
 * @param {Request} req - Request object dengan `current_password` dan `new_password` di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id: string = req.user.id;
    const payload: { current_password: string; new_password: string } = req.body;

    await UserService.updatePassword(id, payload);

    res.status(200).json({
      title: 'Password Changed Successfully',
      message:
        'Your password has been successfully updated. Please use your new password the next time you log in to your account.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan perubahan pengaturan sembunyikan profil pengguna dari pencarian.
 *
 * @param {Request} req - Request object dengan `value` boolean di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updateHideProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.user.id;
    const { value }: { value: boolean } = req.body;

    await UserService.updateHideProfile(id, value);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan perubahan pengaturan pesan dibaca pengguna.
 *
 * @param {Request} req - Request object dengan `value` boolean di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updateReadReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.user.id;
    const { value }: { value: boolean } = req.body;

    await UserService.updateReadReceipt(id, value);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan perubahan pengaturan lihat story pengguna lain.
 *
 * @param {Request} req - Request object dengan `value` boolean di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updateStoryReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.user.id;
    const { value }: { value: boolean } = req.body;

    await UserService.updateStoryReceipt(id, value);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan perubahan pengaturan terakhir dilihat pengguna.
 *
 * @param {Request} req - Request object dengan `value` boolean di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const updateLastSeen = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.user.id;
    const { value }: { value: boolean } = req.body;

    await UserService.updateLastSeen(id, value);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan generate ulang PIN pengguna.
 * Mengembalikan PIN baru yang telah digenerate secara otomatis.
 *
 * @param {Request} req - Request object dengan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const cratePin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.user.id;

    const pin = await UserService.createPin(id);

    res.status(200).json({ pin });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan menghapus PIN pengguna.
 * Ketika pin tersebut tidak digunakan atau telah digunakan.
 *
 * @param {Request} req - Request object dengan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const deletePin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.user.id;

    await UserService.deletePin(id);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan penghapusan akun pengguna.
 * Memvalidasi password sebagai konfirmasi sebelum menghapus akun.
 *
 * @param {Request} req - Request object dengan `password` di body dan JWT payload di `req.user`
 * @param {Response} res - Response object
 * @param {NextFunction} next - Next function untuk error handling
 * @returns {Promise<void>}
 */
export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.user.id;

    const { password }: { password: string } = req.body;

    await UserService.deleteAccount(id, password);

    // Hapus Cookie autentikasi agar user benar-benar terlempar ke halaman Login
    res.clearCookie(env.AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'none',
      path: '/',
    });

    // Putus koneksi WebSocket secara paksa
    const activeSocket = WsManager.getConnection(id);

    if (activeSocket) {
      activeSocket.close(1000, 'Account deleted');
    }

    res.status(200).json({
      title: 'Account Deleted Successfully',
      message:
        'Your account has been successfully deleted. We are sorry to see you go, thank you for using iYou Messenger.',
    });
  } catch (err) {
    next(err);
  }
};
