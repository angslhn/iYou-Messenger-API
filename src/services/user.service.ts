import bcrypt from 'bcryptjs';
import cloudinary from '@/lib/cloudinary.js';
import ResponseError from '@/utils/response-error.js';

import { env } from '@/config/env.js';
import { sendEmailAccountChanged, sendEmailVerifyCode } from '@/helpers/mailer.js';

import * as User from '@/models/user.model.js';
import * as Verification from '@/models/verification.model.js';
import * as Friendship from '@/models/friendship.model.js';
import * as Generator from '@/helpers/generator.js';
import * as Mask from '@/helpers/mask.js';
import * as WsSender from '@/websocket/sender.ws.js';

import type { UserData } from '@/@types/globals.js';

/**
 * Mengambil data profil pengguna berdasarkan ID dari JWT payload.
 * Mengembalikan data profil tanpa field sensitif seperti password dan deleted_at.
 *
 * @param {string} id - ID unik pengguna dari JWT payload
 * @returns {Promise<Omit<UserData, 'password' | 'deleted_at' | 'updated_at' | 'username_changed_at' | 'email_changed_at' | 'phone_changed_at' | 'is_verify'>>} Data profil pengguna yang aman
 * @throws {ResponseError} 404 - Jika user tidak ditemukan
 * @throws {ResponseError} 403 - Jika akun telah dihapus, redirect: 'register'
 */
export const getProfile = async (
  id: string,
): Promise<
  Omit<
    UserData,
    | 'password'
    | 'deleted_at'
    | 'updated_at'
    | 'username_changed_at'
    | 'email_changed_at'
    | 'phone_changed_at'
    | 'is_verify'
  >
> => {
  const user = await User.findById(id);

  // Memastikan data profil pengguna tersedia di database
  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again',
      'login',
    );
  }

  // Menolak akses jika akun pengguna telah berstatus dihapus (soft delete)
  if (user.deleted_at) {
    throw new ResponseError(
      403,
      'Account Has Been Deleted',
      'Your account has been deleted previously, if you want to use this platform again, please register again',
      'register',
    );
  }

  const {
    username,
    fullname,
    email,
    phone,
    about,
    avatar_url,
    pin,
    is_online,
    last_seen,
    story_receipt,
    show_last_seen,
    hide_profile,
    read_receipt,
    created_at,
  } = user;

  return {
    id: user.id,
    username,
    fullname,
    email,
    phone,
    about,
    avatar_url,
    pin,
    is_online,
    last_seen,
    story_receipt,
    show_last_seen,
    hide_profile,
    read_receipt,
    created_at,
  };
};

/**
 * Mengambil data profil publik pengguna lain berdasarkan ID.
 * Respect hide_profile — jika aktif, hanya teman yang bisa lihat.
 * Respect show_last_seen — jika false, last_seen dikembalikan null.
 *
 * @param {string} currentUserId - ID pengguna yang sedang login
 * @param {string} targetUserId - ID pengguna yang ingin dilihat profilnya
 * @returns {Promise<object>}
 * @throws {ResponseError} 404 - Jika user tidak ditemukan atau diblokir
 */
export const getPublicProfile = async (
  currentUserId: string,
  targetUserId: string,
): Promise<{
  id: string;
  fullname: string | null;
  username: string;
  about: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_online: boolean;
  last_seen: Date | null;
}> => {
  const target = await User.findPublicById(targetUserId);

  if (!target) {
    throw new ResponseError(
      404,
      'User Not Found',
      'The user profile you are looking for could not be found.',
    );
  }

  // Cek relasi — blocked di kedua arah
  const relation = await Friendship.findByUsers(currentUserId, targetUserId);

  if (relation?.status === 'blocked') {
    throw new ResponseError(
      404,
      'User Not Found',
      'The user profile you are looking for could not be found.',
    );
  }

  // Cek hide_profile — jika aktif, hanya teman yang bisa lihat
  if (target.hide_profile) {
    const isFriend = relation?.status === 'accepted';

    if (!isFriend) {
      throw new ResponseError(
        404,
        'User Not Found',
        'The user profile you are looking for could not be found.',
      );
    }
  }

  return {
    id: target.id,
    fullname: target.fullname,
    username: target.username,
    about: target.about,
    avatar_url: target.avatar_url,
    phone: target.phone,
    is_online: target.is_online,
    last_seen: target.show_last_seen ? target.last_seen : null,
  };
};

/**
 * Mencari pengguna berdasarkan username.
 * Mengecualikan pengguna yang sedang login dan field sensitif dari hasil pencarian.
 *
 * @param {string} userId - ID pengguna yang sedang login, dikecualikan dari hasil
 * @param {string} query - Kata kunci pencarian username minimal 2 karakter
 * @returns {Promise<Pick<UserData, 'id' | 'username' | 'fullname' | 'about'>[]>} Daftar pengguna yang cocok dengan query
 */
export const searchUser = async (
  userId: string,
  query: string,
): Promise<Pick<UserData, 'id' | 'username' | 'fullname' | 'avatar_url' | 'about'>[]> => {
  const user = await User.searchByQuery(query, userId);

  return user.map(({ id, username, fullname, avatar_url, about }) => ({
    id,
    username,
    fullname,
    avatar_url,
    about,
  }));
};

/**
 * Mencari pengguna berdasarkan PIN unik.
 * Mengecualikan pengguna yang sedang login, akun terhapus, dan pengguna yang memblokir/diblokir.
 *
 * @param {string} userId - ID pengguna yang sedang login, dikecualikan dari hasil
 * @param {string} userPin - PIN unik pengguna yang dicari
 * @returns {Promise<Pick<UserData, 'id' | 'username' | 'fullname' | 'avatar_url' | 'about'>>} Data pengguna yang ditemukan
 * @throws {ResponseError} 404 - Jika PIN tidak ditemukan, akun dihapus, PIN milik diri sendiri, atau salah satu pihak memblokir
 */
export const findUserByPin = async (
  userId: string,
  userPin: string,
): Promise<Pick<UserData, 'id' | 'username' | 'fullname' | 'avatar_url' | 'about'>> => {
  const user = await User.findByPin(userPin);

  // Memvalidasi ketersediaan pengguna, status akun, dan mencegah pengguna mencari PIN-nya sendiri
  if (!user || user.deleted_at || user.id === userId) {
    throw new ResponseError(
      404,
      'Account Unavailable',
      'No active account is associated with this PIN. Please verify the PIN and try again.',
    );
  }

  // Pengecekan blocked — kedua arah (A block B atau B block A)
  const relation = await Friendship.findByUsers(userId, user.id);

  if (relation?.status === 'blocked') {
    throw new ResponseError(
      404,
      'Account Unavailable',
      'No active account is associated with this PIN. Please verify the PIN and try again.',
    );
  }

  const { id, username, fullname, avatar_url, about } = user;

  return { id, username, fullname, avatar_url, about };
};

/**
 * Mencari pengguna berdasarkan nomor telepon.
 * Mengecualikan pengguna yang sedang login dan field sensitif dari hasil pencarian.
 *
 * @param {string} userId - ID pengguna yang sedang login, dikecualikan dari hasil
 * @param {string} userPhone - Nomor telepon pengguna yang dicari
 * @returns {Promise<Pick<UserData, 'id' | 'username' | 'fullname' | 'avatar_url' | 'about'>>} Data pengguna yang ditemukan
 * @throws {ResponseError} 404 - Jika nomor telepon tidak ditemukan, akun dihapus, atau nomor milik diri sendiri
 */
export const findUserByPhone = async (
  userId: string,
  userPhone: string,
): Promise<Pick<UserData, 'id' | 'username' | 'fullname' | 'avatar_url' | 'about'> | null> => {
  const user = await User.findByPhone(userPhone);

  // Memvalidasi ketersediaan pengguna, status akun, dan mencegah pengguna mencari nomor teleponnya sendiri
  if (!user || user.deleted_at || user.id === userId) {
    throw new ResponseError(
      404,
      'Account Unavailable',
      'We could not find an account associated with those details. Please verify the username or phone number and try again.',
    );
  }

  const isFriend = await Friendship.findByUsers(userId, user.id);

  const isFriendAccepted = isFriend?.status === 'accepted';

  if (user.hide_profile && !isFriendAccepted) {
    return null;
  }

  const { id, username, fullname, avatar_url, about } = user;

  return { id, username, fullname, avatar_url, about };
};

/**
 * Memperbarui foto profil pengguna yang diintegrasikan dengan Cloudinary sebagai penyimpannya.
 *
 * @param {string} userId - ID pengguna
 * @param {Buffer} [fileBuffer] - Buffer file gambar dari Multer (opsional, wajib ada untuk update)
 * @returns {Promise<string>} URL gambar yang baru
 */
export const updateAvatar = async (userId: string, fileBuffer?: Buffer): Promise<string> => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again.',
      'login',
    );
  }

  if (!fileBuffer) {
    throw new ResponseError(
      400,
      'No Image Provided',
      'Please upload an image file to update your avatar',
    );
  }

  // Upload buffer ke Cloudinary
  const avatarUrl = await new Promise<string>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: 'iyou-messenger/avatars',
          public_id: userId,
          overwrite: true,
          transformation: [{ width: 512, height: 512, crop: 'fill' }],
        },
        (error, result) => {
          if (error || !result) return reject(error);

          resolve(result.secure_url);
        },
      )
      .end(fileBuffer);
  });

  await User.updateById({ id: user.id, avatar_url: avatarUrl });

  // Mengambil daftar teman yang sudah accepted
  const friends = await Friendship.findAcceptedFriends(userId);

  // findAcceptedFriends sudah mengembalikan profil teman berkat JOIN
  const friendIds = friends.map((f) => f.id);

  // Broadcast event update_avatar ke semua teman
  WsSender.sendToMany(friendIds, {
    event: 'user:update_avatar',
    payload: { userId, avatarUrl },
  });

  return avatarUrl;
};

/**
 * Memperbarui data profil pengguna berdasarkan ID.
 * Minimal satu field harus disertakan dalam pembaruan.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {{ fullname?: string; about?: string }} rawData - Data profil yang ingin diperbarui
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika akun tidak ditemukan
 */
export const updateProfile = async (
  userId: string,
  rawData: { fullname?: string; about?: string },
): Promise<void> => {
  const user = await User.findById(userId);

  // Memastikan pengguna yang melakukan permintaan pembaruan profil benar-benar eksis
  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again.',
      'login',
    );
  }

  await User.updateById({ id: user.id, ...rawData });
};

/**
 * Memperbarui username pengguna berdasarkan ID.
 * Username hanya dapat diubah setiap 14 hari sekali.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {string} username - Username baru yang ingin digunakan
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika akun tidak ditemukan
 * @throws {ResponseError} 400 - Jika username baru diubah sebelum 14 hari
 * @throws {ResponseError} 409 - Jika username sudah digunakan oleh pengguna lain
 */
export const updateUsername = async (userId: string, username: string): Promise<void> => {
  const user = await User.findById(userId);

  // Failsafe untuk memastikan keberadaan pengguna di sistem
  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again.',
      'login',
    );
  }

  // Menerapkan batasan (cooldown) perubahan username: hanya diperbolehkan satu kali dalam 14 hari
  if (
    user.username_changed_at &&
    Date.now() - user.username_changed_at.getTime() < env.IDENTIFIER_CHANGE_COOLDOWN
  ) {
    throw new ResponseError(
      400,
      'Username Change Limit Reached',
      'You recently changed your username. Please wait some time from your last change before updating it again.',
    );
  }

  const checkUsername = await User.findByUsername(username);

  // Memastikan username baru bersifat unik dan belum diambil oleh pengguna lain
  if (checkUsername) {
    throw new ResponseError(
      409,
      'Username Has Been Used',
      'The username is already in use by another user, please use another username to save changes.',
    );
  }

  await User.updateById({ id: user.id, username, username_changed_at: new Date() });
};

/**
 * Memperbarui email pengguna dengan proses verifikasi OTP.
 * Mengirim notifikasi ke email lama dan kode OTP ke email baru.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {string} email - Alamat email baru yang ingin digunakan
 * @returns {Promise<string>} Token param untuk halaman verifikasi OTP
 * @throws {ResponseError} 404 - Jika akun tidak ditemukan
 * @throws {ResponseError} 400 - Jika email baru sama dengan email lama
 * @throws {ResponseError} 400 - Jika email belum dapat diubah karena interval 14 hari
 * @throws {ResponseError} 409 - Jika email sudah digunakan oleh pengguna lain
 */
export const updateEmail = async (userId: string, email: string): Promise<string> => {
  const user = await User.findById(userId);

  // Failsafe untuk memastikan keberadaan pengguna di sistem
  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again.',
      'login',
    );
  }

  // Menerapkan batasan (cooldown) perubahan email: hanya diperbolehkan satu kali dalam 14 hari
  if (
    user.email_changed_at &&
    Date.now() - user.email_changed_at.getTime() < env.IDENTIFIER_CHANGE_COOLDOWN
  ) {
    throw new ResponseError(
      400,
      'Email Change Limit Reached',
      'You recently updated your email address. Please wait some time before making another change.',
    );
  }

  // Mencegah pembaruan jika alamat email yang diajukan sama persis dengan yang sedang digunakan
  if (user.email === email) {
    throw new ResponseError(
      400,
      'Email Cannot Be the Same',
      'The new and old email addresses cannot be the same, please use another email address to save the changes.',
    );
  }

  const checkEmail = await User.findByEmail(email);

  // Memastikan email baru tidak bertabrakan dengan akun pengguna lain di database
  if (checkEmail) {
    throw new ResponseError(
      409,
      'Email Has Been Used',
      'The new email you want to use has already been used on another account, please use an email address that has never been registered.',
    );
  }

  const lastSeenAt = new Date();
  const expiredAt = new Date(Date.now() + env.IDENTIFIER_CHANGE_EXPIRES_IN);

  const otp = Generator.otp();
  const token = Generator.token();

  // Hapus riwayat token/OTP lama agar tidak terjadi duplikasi di database
  await Verification.deleteByUserIdAndType(user.id, 'param_token');
  await Verification.deleteByUserIdAndType(user.id, 'email_otp');

  // Membuat token parameter untuk mengamankan dan memvalidasi sesi halaman verifikasi perubahan email
  await Verification.create({
    id: Generator.id(),
    user_id: user.id,
    token,
    type: 'param_token',
    last_sent_at: lastSeenAt,
    expired_at: expiredAt,
  });

  // Membuat record kode OTP yang akan dikirimkan ke alamat email baru pengguna
  await Verification.create({
    id: Generator.id(),
    user_id: user.id,
    token: otp,
    new_value: email,
    type: 'email_otp',
    last_sent_at: lastSeenAt,
    expired_at: expiredAt,
  });

  await sendEmailAccountChanged(user.email, user.username, Mask.email(user.email));

  await sendEmailVerifyCode(user.email, user.username, otp);

  return token;
};

/**
 * Memverifikasi kode OTP untuk proses perubahan email pengguna.
 * Memvalidasi token param dan kode OTP, lalu memperbarui email pengguna.
 *
 * @param {string} token - Token param untuk identifikasi sesi perubahan email
 * @param {string} otp - Kode OTP 6 digit yang dikirim ke email baru
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika token param tidak ditemukan atau tipe tidak sesuai
 * @throws {ResponseError} 400 - Jika token param sudah expired
 * @throws {ResponseError} 404 - Jika kode OTP tidak ditemukan
 * @throws {ResponseError} 400 - Jika kode OTP sudah expired
 * @throws {ResponseError} 400 - Jika kode OTP tidak cocok
 */
export const verifyUpdateEmail = async (token: string, otp: string): Promise<void> => {
  const verificationToken = await Verification.findByToken(token);

  // Memvalidasi keabsahan token sesi verifikasi (param_token) untuk perubahan email
  if (!verificationToken || verificationToken.type !== 'param_token') {
    throw new ResponseError(
      404,
      'Verification Token Not Found',
      'User token verification for email change not found, please try the email change request process again.',
    );
  }

  // Memeriksa apakah token sesi verifikasi sudah melewati batas waktu kedaluwarsa
  if (Date.now() > verificationToken.expired_at.getTime()) {
    throw new ResponseError(
      400,
      'Verification Token Has Expired',
      'User token verification for email change has expired, please try processing the email change request again.',
    );
  }

  const verificationOtp = await Verification.findByUserId(verificationToken.user_id, 'email_otp');

  // Memastikan data OTP untuk sesi perubahan email ini tersedia di database
  if (!verificationOtp) {
    throw new ResponseError(
      404,
      'Verification Code Not Found',
      'User verification code for email change not found, please try processing email change request again.',
    );
  }

  // Memeriksa masa berlaku kode OTP (kadaluwarsa dalam 5 menit)
  if (Date.now() > verificationOtp.expired_at.getTime()) {
    throw new ResponseError(
      400,
      'Expired Verification Code',
      'User verification code for email change has expired, please try processing the email change request again.',
    );
  }

  // Memvalidasi kecocokan input OTP dari pengguna dengan data OTP yang tersimpan di sistem
  if (verificationOtp.token !== otp) {
    throw new ResponseError(
      400,
      "Verification Code Doesn't Match",
      'The verification code does not match, please match it with the verification code that has been sent to your email address.',
    );
  }

  await User.updateById({
    id: verificationToken.user_id,
    email: verificationOtp.new_value as string,
    email_changed_at: new Date(),
  });

  await Verification.deleteByUserIdAndType(verificationToken.user_id, verificationToken.type);

  await Verification.deleteByUserIdAndType(verificationOtp.user_id, verificationOtp.type);
};

/**
 * Memperbarui nomor telepon pengguna dengan proses verifikasi OTP melalui email.
 * Mengirim notifikasi perubahan dan kode OTP ke email aktif pengguna.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {string} phone - Nomor telepon baru yang ingin digunakan
 * @returns {Promise<string>} Token param untuk halaman verifikasi OTP
 * @throws {ResponseError} 404 - Jika akun tidak ditemukan
 * @throws {ResponseError} 400 - Jika nomor telepon baru sama dengan nomor lama
 * @throws {ResponseError} 400 - Jika nomor telepon belum dapat diubah karena interval 14 hari
 * @throws {ResponseError} 409 - Jika nomor telepon sudah digunakan oleh pengguna lain
 */
export const updatePhone = async (userId: string, phone: string): Promise<string> => {
  const user = await User.findById(userId);

  // Failsafe untuk memastikan keberadaan pengguna di sistem
  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again.',
      'login',
    );
  }

  // Menerapkan batasan (cooldown) perubahan nomor telepon: hanya diperbolehkan satu kali dalam 14 hari
  if (
    user.phone_changed_at &&
    Date.now() - user.phone_changed_at.getTime() < env.IDENTIFIER_CHANGE_COOLDOWN
  ) {
    throw new ResponseError(
      400,
      'Phone Number Change Limit Reached',
      'You recently changed your phone number. Please wait some time before updating it again.',
    );
  }

  // Mencegah pembaruan redundan jika nomor telepon tujuan sama persis dengan nomor saat ini
  if (user.phone === phone) {
    throw new ResponseError(
      400,
      'Phone Number Cannot Be the Same',
      'The new and old phone number cannot be the same, please use another phone number to save the changes.',
    );
  }

  const checkPhone = await User.findByPhone(phone);

  // Memastikan nomor telepon baru belum terdaftar atau digunakan oleh pengguna lain
  if (checkPhone) {
    throw new ResponseError(
      409,
      'Phone Number Has Been Used',
      'The new phone number you want to use has already been used on another account, please use an phone number that has never been registered.',
    );
  }

  const lastSeenAt = new Date();
  const expiredAt = new Date(Date.now() + env.IDENTIFIER_CHANGE_EXPIRES_IN);

  const otp = Generator.otp();
  const token = Generator.token();

  // Hapus riwayat token/OTP lama agar tidak terjadi duplikasi di database
  await Verification.deleteByUserIdAndType(user.id, 'param_token');
  await Verification.deleteByUserIdAndType(user.id, 'phone_otp');

  // Membuat token parameter khusus untuk mengamankan sesi halaman verifikasi nomor telepon
  await Verification.create({
    id: Generator.id(),
    user_id: user.id,
    token,
    type: 'param_token',
    last_sent_at: lastSeenAt,
    expired_at: expiredAt,
  });

  // Membuat record kode OTP terkait perubahan nomor telepon
  await Verification.create({
    id: Generator.id(),
    user_id: user.id,
    token: otp,
    new_value: phone,
    type: 'phone_otp',
    last_sent_at: lastSeenAt,
    expired_at: expiredAt,
  });

  await sendEmailAccountChanged(user.email, user.username, Mask.email(user.email));

  await sendEmailVerifyCode(user.email, user.username, otp);

  return token;
};

/**
 * Memverifikasi kode OTP untuk proses perubahan nomor telepon pengguna.
 * Memvalidasi token param dan kode OTP, lalu memperbarui nomor telepon pengguna.
 *
 * @param {string} token - Token param untuk identifikasi sesi perubahan nomor telepon
 * @param {string} otp - Kode OTP 6 digit yang dikirim ke email aktif pengguna
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika token param tidak ditemukan atau tipe tidak sesuai
 * @throws {ResponseError} 400 - Jika token param sudah expired
 * @throws {ResponseError} 404 - Jika kode OTP tidak ditemukan
 * @throws {ResponseError} 400 - Jika kode OTP sudah expired
 * @throws {ResponseError} 400 - Jika kode OTP tidak cocok
 */
export const verifyUpdatePhone = async (token: string, otp: string): Promise<void> => {
  const verificationToken = await Verification.findByToken(token);

  // Memvalidasi keberadaan dan tipe token sesi verifikasi (param_token)
  if (!verificationToken || verificationToken.type !== 'param_token') {
    throw new ResponseError(
      404,
      'Verification Token Not Found',
      'User token verification for phone number change not found, please try the phone number change request process again.',
    );
  }

  // Memeriksa status kedaluwarsa token sesi verifikasi
  if (Date.now() > verificationToken.expired_at.getTime()) {
    throw new ResponseError(
      400,
      'Verification Token Has Expired',
      'User token verification for phone number change has expired, please try processing the phone number change request again.',
    );
  }

  const verificationOtp = await Verification.findByUserId(verificationToken.user_id, 'phone_otp');

  // Memastikan eksistensi data OTP perubahan nomor telepon di database
  if (!verificationOtp) {
    throw new ResponseError(
      404,
      'Verification Code Not Found',
      'User verification code for phone number change not found, please try processing phone number change request again.',
    );
  }

  // Mengecek masa aktif (kadaluwarsa) dari kode OTP yang bersangkutan
  if (Date.now() > verificationOtp.expired_at.getTime()) {
    throw new ResponseError(
      400,
      'Expired Verification Code',
      'User verification code for phone number change has expired, please try processing the phone number change request again.',
    );
  }

  // Menguji kecocokan nilai OTP yang dimasukkan dengan yang di-generate sistem
  if (verificationOtp.token !== otp) {
    throw new ResponseError(
      400,
      "Verification Code Doesn't Match",
      'The verification code does not match, please match it with the verification code that has been sent to your email address.',
    );
  }

  await User.updateById({
    id: verificationToken.user_id,
    phone: verificationOtp.new_value as string,
    phone_changed_at: new Date(),
  });

  await Verification.deleteByUserIdAndType(verificationToken.user_id, verificationToken.type);

  await Verification.deleteByUserIdAndType(verificationOtp.user_id, verificationOtp.type);
};

/**
 * Memproses pengiriman ulang kode OTP verifikasi email pengguna.
 * Melakukan pengecekan cooldown 1 menit antar pengiriman, batas maksimal 3 kali pengiriman,
 * dan reset otomatis limit setelah 24 jam sebelum mengirim kode baru via email.
 *
 * @param {string} email - Alamat email pengguna yang meminta pengiriman ulang kode OTP
 * @param {'email_otp' | 'phone_otp'} type - Jenis otp yang meminta pengiriman ulang kode OTP
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika user tidak ditemukan
 * @throws {ResponseError} 404 - Jika data verifikasi tidak ditemukan
 * @throws {ResponseError} 429 - Jika request terlalu cepat (cooldown 1 menit)
 * @throws {ResponseError} 429 - Jika batas pengiriman habis dan belum melewati 24 jam
 */
export const resend = async (email: string, type: 'email_otp' | 'phone_otp'): Promise<void> => {
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

  const verification = await Verification.findByUserId(user.id, type);

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
    type,
    limit_request: limitRequest,
    last_sent_at: new Date(),
    expired_at: new Date(Date.now() + env.VERIFICATION_EXPIRES_IN),
  });

  await sendEmailVerifyCode(user.email, user.username, token);
};

/**
 * Memperbarui password pengguna berdasarkan ID.
 * Memvalidasi password lama sebelum menyimpan password baru yang telah di-hash.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {{ current_password: string; new_password: string }} rawData - Password lama dan password baru
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika akun tidak ditemukan
 * @throws {ResponseError} 400 - Jika password baru sama dengan password lama
 * @throws {ResponseError} 400 - Jika password lama tidak cocok
 */
export const updatePassword = async (
  userId: string,
  rawData: { current_password: string; new_password: string },
): Promise<void> => {
  const user = await User.findById(userId);

  // Failsafe untuk memastikan profil pengguna ditemukan
  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again.',
      'login',
    );
  }

  // Mencegah pengguna menyetel kata sandi baru yang persis sama dengan kata sandi saat ini
  if (rawData.current_password === rawData.new_password) {
    throw new ResponseError(
      400,
      'Password Cannot Be the Same',
      'The new password cannot be the same as the current password, please use a different password.',
    );
  }

  const checkPassword = await bcrypt.compare(rawData.current_password, user.password);

  // Memverifikasi kecocokan kata sandi lama sebelum mengizinkan proses pembaruan kata sandi
  if (!checkPassword) {
    throw new ResponseError(
      400,
      'Incorrect Current Password',
      'The current password you entered is incorrect, please make sure you enter the right password.',
    );
  }

  const password = await bcrypt.hash(rawData.new_password, 12);

  await User.updateById({ id: user.id, password });
};

/**
 * Memperbarui pengaturan terakhir dilihat pengguna berdasarkan ID.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {boolean} value - Nilai show_last_seen yang ingin digunakan
 * @returns {Promise<void>}
 */
export const updateLastSeen = async (userId: string, value: boolean): Promise<void> => {
  await User.updateById({ id: userId, show_last_seen: value });
};

/**
 * Memperbarui pengaturan menyembunyikan profile pengguna dari pencarian berdasarkan ID.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {boolean} value - Nilai hide profile yang ingin digunakan
 * @returns {Promise<void>}
 */
export const updateHideProfile = async (userId: string, value: boolean): Promise<void> => {
  await User.updateById({ id: userId, hide_profile: value });
};

/**
 * Memperbarui pengaturan pesan dibaca pengguna berdasarkan ID.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {boolean} value - Nilai read_receipt yang ingin digunakan
 * @returns {Promise<void>}
 */
export const updateReadReceipt = async (userId: string, value: boolean): Promise<void> => {
  await User.updateById({ id: userId, read_receipt: value });
};

/**
 * Memperbarui pengaturan lihat story pengguna lain berdasarkan ID.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {boolean} value - Nilai story_receipt yang ingin digunakan
 * @returns {Promise<void>}
 */
export const updateStoryReceipt = async (userId: string, value: boolean): Promise<void> => {
  await User.updateById({ id: userId, story_receipt: value });
};

/**
 * Memperbarui PIN pengguna dengan PIN baru yang digenerate secara otomatis.
 * Memastikan PIN baru tidak bentrok dengan PIN pengguna lain.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @returns {Promise<string>} PIN baru yang telah digenerate
 * @throws {ResponseError} 404 - Jika akun tidak ditemukan
 */
export const createPin = async (userId: string): Promise<string> => {
  const user = await User.findById(userId);

  // Failsafe pencarian pengguna di database
  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again.',
      'login',
    );
  }

  let pin = Generator.pin();

  // Menghasilkan PIN baru secara terus-menerus dan memvalidasinya
  // hingga ditemukan kombinasi PIN yang 100% unik di sistem
  while (true) {
    const userMatchedPin = await User.findByPin(pin);

    if (!userMatchedPin) {
      break;
    }

    pin = Generator.pin();
  }

  await User.updateById({ id: user.id, pin });

  return pin;
};

/**
 * Menghapus pin lama pengguna, ketika token tersebut tidak digunakan atau telah digunakan
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika akun tidak ditemukan
 */
export const deletePin = async (userId: string): Promise<void> => {
  const user = await User.findById(userId);

  // Failsafe pencarian pengguna di database
  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again.',
      'login',
    );
  }

  // Menghapus PIN pengguna
  await User.updateById({ id: user.id, pin: null });
};

/**
 * Menghapus akun pengguna secara soft delete berdasarkan ID.
 * Memvalidasi password sebelum menghapus akun dan membersihkan data verifikasi.
 *
 * @param {string} userId - ID pengguna yang sedang login dari JWT payload
 * @param {string} password - Password pengguna sebagai konfirmasi penghapusan akun
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika akun tidak ditemukan
 * @throws {ResponseError} 400 - Jika password konfirmasi tidak cocok
 */
export const deleteAccount = async (userId: string, password: string) => {
  const user = await User.findById(userId);

  // Failsafe untuk memastikan data akun memang masih eksis
  if (!user) {
    throw new ResponseError(
      404,
      'Profile Unavailable',
      'Your account profile data was not found, the user credentials are invalid and you must log in again.',
      'login',
    );
  }

  const checkPassword = await bcrypt.compare(password, user.password);

  // Meminta konfirmasi kata sandi sebagai lapis keamanan terakhir sebelum mengeksekusi penghapusan akun
  if (!checkPassword) {
    throw new ResponseError(
      400,
      'Incorrect Confirm Password',
      'The confirm password you entered is incorrect, please make sure you enter the right password.',
    );
  }

  // Menjalankan proses soft-delete: menandai akun sebagai dihapus (offline, deleted_at terisi)
  // tanpa benar-benar menghancurkan record dari tabel database
  await User.updateById({ id: user.id, is_online: false, deleted_at: new Date() });

  await Verification.deleteByUserId(user.id);
};
