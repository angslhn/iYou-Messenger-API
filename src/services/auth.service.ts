import bcrypt from 'bcryptjs';
import jsonwebtoken from 'jsonwebtoken';
import ResponseError from '@/utils/response-error.js';

import { env } from '@/config/env.js';
import { emailResetPassword, emailVerifyCode } from '@/helpers/mailer.js';

import * as Mask from '@/helpers/mask.js';
import * as Generator from '@/helpers/generator.js';

import * as User from '@/models/user.model.js';
import * as Verification from '@/models/verification.model.js';

import type { UserData } from '@/@types/globals.js';

/**
 * Memproses pendaftaran pengguna baru ke dalam sistem.
 * Melakukan pengecekan duplikasi email dan username, hashing password,
 * pembuatan akun, pengiriman token verifikasi email, dan notifikasi via email.
 *
 * @param {Pick<UserData, 'fullname' | 'username' | 'email' | 'password'>} rawData - Data mentah pendaftaran pengguna
 * @returns {Promise<void>}
 * @throws {ResponseError} 409 - Jika email atau username sudah terdaftar
 * @throws {ResponseError} 500 - Jika proses insert user atau verifikasi gagal
 */
export const register = async (
  rawData: Pick<UserData, 'fullname' | 'username' | 'email' | 'password'>,
): Promise<void> => {
  let user: UserData | undefined;

  user = await User.findByEmail(rawData.email);

  // Memastikan email yang didaftarkan belum digunakan oleh entitas lain di dalam sistem
  if (user) {
    throw new ResponseError(
      409,
      'Email Has Been Registered',
      'The email has been registered as a user, account registration is not processed',
      'login',
    );
  }

  user = await User.findByUsername(rawData.username);

  // Memastikan username bersifat unik dan tidak sedang dipakai oleh pengguna lain
  if (user) {
    throw new ResponseError(
      409,
      'Username Has Been Used',
      'The username has already been taken, please use a different username',
    );
  }

  const userId = Generator.id();
  const password = await bcrypt.hash(rawData.password, 12);

  const userResult = await User.create({
    id: userId,
    fullname: rawData.fullname,
    username: rawData.username,
    email: rawData.email,
    password,
  });

  // Validasi failsafe jika proses pembuatan entitas user ke database gagal dieksekusi
  if (!userResult) {
    throw new ResponseError(
      500,
      'Failed to Register User',
      'An error occurred while processing user registration, please try again later',
    );
  }

  const token = Generator.otp();

  const verificationId = Generator.id();

  const verificationResult = await Verification.create({
    id: verificationId,
    user_id: userId,
    token,
    type: 'email_otp',
    last_sent_at: new Date(),
    expired_at: new Date(Date.now() + env.VERIFICATION_EXPIRES_IN),
  });

  // Validasi failsafe jika sistem gagal membuat record token verifikasi di database
  if (!verificationResult) {
    throw new ResponseError(
      500,
      'Failed to Send Verification',
      'An error occurred with the service while sending verification, please try again later',
    );
  }

  await emailVerifyCode(rawData.email, rawData.username, token, 'register');
};

/**
 * Memproses verifikasi pengguna menggunakan otp.
 * Melakukan pengecekan keberadaan user, status verifikasi, kecocokan otp,
 * dan masa berlaku otp sebelum mengaktifkan akun pengguna.
 *
 * @param {{ email: string; otp: string }} rawData - email dan otp yang dikirim pengguna
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika user tidak ditemukan
 * @throws {ResponseError} 400 - Jika user sudah terverifikasi sebelumnya
 * @throws {ResponseError} 404 - Jika otp verifikasi tidak ditemukan
 * @throws {ResponseError} 400 - Jika otp sudah kadaluwarsa
 * @throws {ResponseError} 400 - Jika otp tidak cocok
 */
export const verify = async (rawData: { email: string; otp: string }): Promise<void> => {
  const user = await User.findByEmail(rawData.email);

  // Memastikan bahwa alamat email yang diminta untuk diverifikasi benar-benar terdaftar
  if (!user) {
    throw new ResponseError(
      404,
      'Account Unavailable',
      `User with email address ${rawData.email} is not found or has not registered on our platform`,
      'login',
    );
  }

  // Menghindari eksekusi verifikasi ulang jika akun pengguna sudah berstatus diverifikasi
  if (user.is_verify) {
    throw new ResponseError(
      400,
      'User Has Been Verified',
      'The verification process was cancelled, because the user had been previously verified on the platform',
      'login',
    );
  }

  const verification = await Verification.findByUserId(user.id, 'email_otp');

  // Memastikan data OTP untuk pengguna tersebut tersedia dan belum terhapus
  if (!verification) {
    throw new ResponseError(
      404,
      'Verification Code Not Found',
      'The verification process was cancelled, because the verification code could not be found on the platform',
    );
  }

  // Memvalidasi apakah waktu saat ini sudah melewati batas kadaluwarsa token (15 menit)
  if (Date.now() > verification.expired_at.getTime()) {
    throw new ResponseError(
      400,
      'Expired Verification Code',
      'The verification code you used has expired, please send a request to resend a new verification code',
    );
  }

  // Memvalidasi kecocokan kode OTP yang diinputkan pengguna dengan yang tersimpan di sistem
  if (verification.token !== rawData.otp) {
    throw new ResponseError(
      400,
      "Verification Code Doesn't Match",
      'The verification code does not match, please match it with the verification code that has been sent to your email address',
    );
  }

  await User.updateById({ id: user.id, is_verify: true });

  await Verification.deleteByUserIdAndType(user.id, 'email_otp');
};

/**
 * Memproses pengiriman ulang kode OTP verifikasi email pengguna.
 * Melakukan pengecekan cooldown 1 menit antar pengiriman, batas maksimal 3 kali pengiriman,
 * dan reset otomatis limit setelah 24 jam sebelum mengirim kode baru via email.
 *
 * @param {string} email - Alamat email pengguna yang meminta pengiriman ulang kode OTP
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika user tidak ditemukan
 * @throws {ResponseError} 400 - Jika user sudah terverifikasi sebelumnya
 * @throws {ResponseError} 404 - Jika data verifikasi tidak ditemukan
 * @throws {ResponseError} 429 - Jika request terlalu cepat (cooldown 1 menit)
 * @throws {ResponseError} 429 - Jika batas pengiriman habis dan belum melewati 24 jam
 */
export const resend = async (email: string): Promise<void> => {
  const user = await User.findByEmail(email);

  // Memastikan pengguna eksis di sistem sebelum memproses kirim ulang OTP
  if (!user) {
    throw new ResponseError(
      404,
      'Account Unavailable',
      `User with email address ${email} is not found or has not registered on our platform`,
      'login',
    );
  }

  // Mencegah pengiriman OTP jika akun pengguna tersebut sudah aktif secara penuh
  if (user.is_verify) {
    throw new ResponseError(
      400,
      'User Has Been Verified',
      'The verification process was cancelled, because the user had been previously verified on the platform',
      'login',
    );
  }

  const verification = await Verification.findByUserId(user.id, 'email_otp');

  // Mengharuskan pengguna memiliki record verifikasi awal untuk dapat melakukan pengiriman ulang
  if (!verification) {
    throw new ResponseError(
      404,
      'Verification Code Not Found',
      'The verification process was cancelled, because the verification code could not be found on the platform',
      'login',
    );
  }

  let limitRequest: number;

  const timeNow = Date.now();
  const lastSentAt = verification?.last_sent_at?.getTime() || null;

  // Menerapkan cooldown: Menolak permintaan jika pengiriman terakhir terjadi kurang dari 1 menit yang lalu
  if (lastSentAt && timeNow - lastSentAt < env.REQUEST_COOLDOWN) {
    throw new ResponseError(
      429,
      'Please Wait to Resend',
      'Please wait a moment to try again to resend the new verification code',
    );
  }

  // Logika Rate Limiter: Menangani kondisi saat batas pengiriman OTP (3 kali) sudah habis
  if (verification.limit_request === 0) {
    // Jika batas 3 kali habis dan belum lewat 24 jam sejak pengiriman terakhir, blokir permintaan
    if (lastSentAt && timeNow - lastSentAt < env.REQUEST_EMAIL_LIMIT_RESET_TIME) {
      throw new ResponseError(
        429,
        'Resend Attempts Has Reached the Limit',
        'The number of attempts to resend the verification code has reached the limit, please wait a moment to try again',
      );
    }

    // Jika sudah lewat 24 jam, reset limit kembali ke batas maksimal awal (3 kali)
    limitRequest = env.REQUEST_EMAIL_LIMIT - 1;
  } else {
    // Jika limit masih tersedia, kurangi sisa jatah pengiriman
    limitRequest = verification.limit_request - 1;
  }

  const token = Generator.otp();

  await Verification.updateById({
    id: verification.id,
    user_id: user.id,
    token,
    type: 'email_otp',
    limit_request: limitRequest,
    last_sent_at: new Date(),
    expired_at: new Date(Date.now() + env.VERIFICATION_EXPIRES_IN),
  });

  await emailVerifyCode(user.email, user.username, token, 'resend');
};

/**
 * Memproses autentikasi pengguna menggunakan identifier dan password.
 * Mendukung login via username, email, atau nomor telepon.
 * Menangani kasus akun terhapus, belum terverifikasi, dan pengiriman ulang OTP otomatis.
 *
 * @param {{ identifier: string; password: string }} rawData - Identifier dan password pengguna
 * @returns {Promise<string>} JWT token yang digunakan untuk autentikasi selanjutnya
 * @throws {ResponseError} 404 - Jika user tidak ditemukan
 * @throws {ResponseError} 403 - Jika akun telah dihapus, redirect: 'register'
 * @throws {ResponseError} 401 - Jika password tidak cocok
 * @throws {ResponseError} 403 - Jika akun belum terverifikasi, redirect: 'verify'
 * @throws {ResponseError} 403 - Jika limit OTP habis dan belum 24 jam, redirect: 'verify'
 */
export const login = async (rawData: { identifier: string; password: string }): Promise<string> => {
  const user = await User.findByIdentifier(rawData.identifier);

  // Memvalidasi ketersediaan identitas (email/username/telepon) di sistem
  if (!user) {
    throw new ResponseError(
      404,
      'Login Unsuccessful',
      "We couldn't find an account with those details. Please double-check your identity and password before trying again.",
    );
  }

  // Memblokir akses login secara penuh jika akun telah terhapus (soft-delete)
  if (user.deleted_at) {
    throw new ResponseError(
      403,
      'Account Has Been Deleted',
      'Your account has been deleted previously, if you want to use this platform again, please register again.',
    );
  }

  const isMatchPassword = await bcrypt.compare(rawData.password, user.password);

  // Memastikan otentikasi gagal jika komparasi hash password tidak sesuai
  if (!isMatchPassword) {
    throw new ResponseError(
      401,
      'The Password Is Incorrect',
      'The password you entered is incorrect, please ensure you enter the correct password.',
    );
  }

  // Menangani alur khusus bagi pengguna yang berhasil memasukkan kredensial
  // namun akunnya masih dalam status 'belum terverifikasi'
  if (!user.is_verify) {
    const verification = await Verification.findByUserId(user.id, 'email_otp');

    // Jika data verifikasi sebelumnya hilang/kadaluwarsa sepenuhnya,
    // buatkan OTP baru secara otomatis, kirim via email, lalu hentikan proses login
    if (!verification) {
      const id = Generator.id();

      const token = Generator.otp();

      await Verification.create({
        id,
        user_id: user.id,
        token,
        type: 'email_otp',
        last_sent_at: new Date(),
        expired_at: new Date(Date.now() + env.VERIFICATION_EXPIRES_IN),
      });

      await emailVerifyCode(user.email, user.username, token, 'register');

      throw new ResponseError(
        403,
        'Account Not Verified',
        'Your account has not been verified before, please complete the verification steps before using this platform.',
        'verify',
        user.email,
      );
    }

    // Mencegah spam OTP: Jika limit otomatis pengiriman OTP saat login sudah habis (0)
    // dan belum melewati batas 24 jam, blokir permintaan dan lempar error
    let limitRequest: number;

    const timeNow = Date.now();
    const lastSentAt = verification.last_sent_at.getTime();

    // Mencegah spam OTP: Logika Rate Limiter
    if (verification.limit_request === 0) {
      // Jika limit habis dan belum lewat 24 jam
      if (timeNow - lastSentAt < env.REQUEST_EMAIL_LIMIT_RESET_TIME) {
        throw new ResponseError(
          403,
          'Verification Code Limit Reached',
          'The verification code request limit has been reached, please wait a moment to try to verify the user again.',
          'verify',
          user.email,
        );
      }
      // Jika sudah lewat 24 jam, reset limit kembali penuh (lalu dikurangi 1 untuk pengiriman saat ini)
      limitRequest = env.REQUEST_EMAIL_LIMIT - 1;
    } else {
      // Jika masih ada sisa limit
      limitRequest = verification.limit_request - 1;
    }

    const token = Generator.otp();

    // Lakukan pembaruan token OTP pada record verifikasi
    await Verification.updateById({
      id: verification.id,
      user_id: user.id,
      token,
      type: 'email_otp',
      limit_request: limitRequest,
      last_sent_at: new Date(),
      expired_at: new Date(Date.now() + env.VERIFICATION_EXPIRES_IN),
    });

    await emailVerifyCode(user.email, user.username, token, 'register');

    // Lempar error 403 untuk me-redirect aplikasi client ke halaman verifikasi
    throw new ResponseError(
      403,
      'Account Not Verified',
      'Your account has not been verified before, please complete the verification steps before using this platform.',
      'verify',
      user.email,
    );
  }

  await User.updateById({ id: user.id, is_online: true });

  const { id, username, email, phone } = user;

  const token = jsonwebtoken.sign({ id, username, email, phone }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return token;
};

/**
 * Memproses permintaan reset password pengguna menggunakan identifier.
 * Mendukung identifier berupa email atau nomor telepon.
 * Menangani kasus akun terhapus, belum terverifikasi, cooldown pengiriman,
 * dan batas maksimal permintaan reset password sebelum mengirim token via email.
 *
 * @param {string} identifier - Email atau nomor telepon pengguna
 * @returns {Promise<{ type: 'email' | 'phone'; maskedContact: string }>} Tipe identifier yang digunakan untuk pengiriman token reset password
 * @throws {ResponseError} 404 - Jika user tidak ditemukan
 * @throws {ResponseError} 403 - Jika akun telah dihapus, redirect: 'register'
 * @throws {ResponseError} 403 - Jika akun belum terverifikasi, redirect: 'verify'
 * @throws {ResponseError} 429 - Jika request terlalu cepat (cooldown 1 menit)
 * @throws {ResponseError} 429 - Jika batas permintaan habis dan belum melewati 24 jam
 */
export const forgotPassword = async (
  identifier: string,
): Promise<{ type: 'email' | 'phone'; maskedContact: string }> => {
  const user = await User.findByIdentifier(identifier);

  // Memastikan identifier yang dicari merujuk pada pengguna yang valid
  if (!user) {
    throw new ResponseError(
      404,
      'Account Unavailable',
      'A user account with those credentials cannot be found or has never been registered on this platform.',
    );
  }

  // Mencegah proses pemulihan akun untuk pengguna yang status akunnya terhapus (soft-delete)
  if (user.deleted_at) {
    throw new ResponseError(
      403,
      'Account Has Been Deleted',
      'Your account has been deleted previously, if you want to use this platform again, please register again.',
      'login',
    );
  }

  // Jika akun belum terverifikasi sama sekali, pengguna dilarang mereset password.
  // Sistem akan memaksa pembuatan dan pengiriman ulang OTP verifikasi terlebih dahulu.
  if (!user.is_verify) {
    const verification = await Verification.findByUserId(user.id, 'email_otp');

    // Buat data verifikasi baru jika tidak ada history verifikasi sebelumnya
    if (!verification) {
      const id = Generator.id();

      const token = Generator.otp();

      await Verification.create({
        id,
        user_id: user.id,
        token,
        type: 'email_otp',
        last_sent_at: new Date(),
        expired_at: new Date(Date.now() + env.VERIFICATION_EXPIRES_IN),
      });

      await emailVerifyCode(user.email, user.username, token, 'register');

      throw new ResponseError(
        403,
        'Account Not Verified',
        'Your account has not been verified before, please complete the verification steps before using this platform.',
        'verify',
        user.email,
      );
    }

    // Blokir jika limit permintaan OTP verifikasi (dari flow reset password) habis dalam 24 jam
    if (
      verification.limit_request === 0 &&
      Date.now() - verification.last_sent_at.getTime() < env.REQUEST_EMAIL_LIMIT_RESET_TIME
    ) {
      throw new ResponseError(
        403,
        'Verification Code Limit Reached',
        'The verification code request limit has been reached, please wait a moment to try to verify the user again.',
      );
    }

    const token = Generator.otp();

    await Verification.updateById({
      id: verification.id,
      user_id: user.id,
      token,
      type: 'email_otp',
      limit_request: verification.limit_request - 1,
      last_sent_at: new Date(),
      expired_at: new Date(Date.now() + env.VERIFICATION_EXPIRES_IN),
    });

    await emailVerifyCode(user.email, user.username, token, 'register');

    // Redirect user ke halaman verifikasi akun
    throw new ResponseError(
      403,
      'Account Not Verified',
      'Your account has not been verified before, please complete the verification steps before using this platform.',
      'verify',
      user.email,
    );
  }

  const verification = await Verification.findByUserId(user.id, 'param_token');

  let token: string;

  // Logika pembatasan laju (rate limiting) khusus untuk alur token pemulihan (param_token)
  if (verification) {
    let limitRequest: number;

    const timeNow = Date.now();
    const lastSentAt = verification?.last_sent_at?.getTime() || null;

    // Cooldown 1 menit per permintaan reset password untuk mencegah spam
    if (lastSentAt && timeNow - lastSentAt < env.REQUEST_COOLDOWN) {
      throw new ResponseError(
        429,
        'Please Wait to Reset Password',
        'Please wait a moment to try resetting your password again to get a new password reset token.',
      );
    }

    // Penanganan saat limit habis
    if (verification.limit_request === 0) {
      if (lastSentAt && timeNow - lastSentAt < env.REQUEST_EMAIL_LIMIT_RESET_TIME) {
        throw new ResponseError(
          429,
          'Reset Password Attempts Has Reached the Limit',
          'The number of attempts to resend the password reset token has reached the limit, please wait a moment to try again.',
        );
      }
      // Reset limit jika sudah > 24 jam
      limitRequest = env.REQUEST_EMAIL_LIMIT - 1;
    } else {
      limitRequest = verification.limit_request - 1;
    }

    token = Generator.token();

    await Verification.updateById({
      id: verification.id,
      user_id: user.id,
      token,
      type: 'param_token',
      limit_request: limitRequest,
      last_sent_at: new Date(),
      expired_at: new Date(Date.now() + env.VERIFICATION_EXPIRES_IN),
    });
  } else {
    // Jika user belum pernah mereset password sebelumnya, buat record baru di tabel verifikasi
    const verificationId = Generator.id();

    token = Generator.token();

    await Verification.create({
      id: verificationId,
      user_id: user.id,
      token,
      type: 'param_token',
      last_sent_at: new Date(),
      expired_at: new Date(Date.now() + env.VERIFICATION_EXPIRES_IN),
    });
  }

  const isEmail = identifier.includes('@');

  // Menentukan metode pengiriman token (Email atau SMS) berdasarkan pola input identifier
  if (isEmail) {
    await emailResetPassword(user.email, user.username, token);
  } else {
    // await sendSmsResetPassword(user.email, token);
  }

  const maskedContact = isEmail ? Mask.email(user.email) : Mask.phone(user.phone ?? '');

  return { type: isEmail ? 'email' : 'phone', maskedContact };
};

/**
 * Memproses reset password pengguna menggunakan token yang dikirim via email atau SMS.
 * Melakukan validasi token, tipe verifikasi, masa berlaku token, dan kesamaan password baru
 * dengan password lama sebelum memperbarui password pengguna di database.
 *
 * @param {{ token: string; new_password: string }} rawData - Token reset password dan password baru
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika token tidak ditemukan, redirect: 'login'
 * @throws {ResponseError} 400 - Jika tipe token bukan 'param_token'
 * @throws {ResponseError} 400 - Jika token sudah kadaluwarsa
 * @throws {ResponseError} 404 - Jika user tidak ditemukan
 * @throws {ResponseError} 400 - Jika password baru sama dengan password lama
 */
export const resetPassword = async (rawData: {
  token: string;
  new_password: string;
}): Promise<void> => {
  const verification = await Verification.findByToken(rawData.token);

  // Validasi eksistensi token pemulihan di dalam database
  if (!verification) {
    throw new ResponseError(
      404,
      'Reset Password Token Not Found',
      'The password reset process was stopped because the associated token could not be found. Please submit a new request to receive a valid link.',
      'forgot_password',
    );
  }

  // Mengamankan jalur masuk: memastikan token yang digunakan benar-benar tipe pemulihan password,
  // bukan token verifikasi OTP pendaftaran
  if (verification.type !== 'param_token') {
    throw new ResponseError(
      400,
      'Invalid Verification Token',
      'The password reset token is invalid or has expired. Please initiate a new password reset request to obtain a valid security token.',
      'forgot_password',
    );
  }

  // Memvalidasi apakah batas waktu token (expired_at) belum terlewati (15 menit)
  if (Date.now() > verification.expired_at.getTime()) {
    throw new ResponseError(
      400,
      'Expired Reset Password Token',
      'The security token for this password reset has expired. Please initiate a new request to obtain a valid verification link.',
      'forgot_password',
    );
  }

  const user = await User.findById(verification.user_id);

  // Failsafe jika data akun pengguna sudah terhapus permanen dari sistem
  if (!user) {
    throw new ResponseError(
      404,
      'Account Unavailable',
      'A user account with those credentials cannot be found or has never been registered on this platform.',
    );
  }

  const isMatchPassword = await bcrypt.compare(rawData.new_password, user.password);

  // Pengecekan Keamanan: Melarang pengguna menyetel password yang persis sama dengan sebelumnya
  if (isMatchPassword) {
    throw new ResponseError(
      400,
      'New Password Required',
      'Make sure you create a different password than before, to maximize the security of your account.',
    );
  }

  const password = await bcrypt.hash(rawData.new_password, 12);

  await User.updateById({ id: user.id, password });

  await Verification.deleteByUserIdAndType(user.id, 'param_token');
};
