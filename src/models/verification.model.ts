import { getPool } from '@/lib/pg.js';

import type { VerificationData } from '@/@types/globals.js';

/**
 * Mencari data verifikasi berdasarkan token unik.
 * @param {string} token - Token verifikasi dengan panjang 64 karakter
 * @returns {Promise<VerificationData | undefined>} Data verifikasi jika ditemukan, undefined jika tidak
 */
export const findByToken = async (token: string): Promise<VerificationData | undefined> => {
  const pool = getPool();

  const res = await pool.query('SELECT * FROM verifications WHERE token = $1', [token]);

  return res.rows[0];
};

/**
 * Mencari data verifikasi berdasarkan ID pengguna dan tipe verifikasi.
 * @param {string} userId - ID unik pengguna dengan panjang 15 karakter
 * @param {'email_otp' | 'phone_otp' | 'param_token'} type - Tipe verifikasi ('email_otp', 'phone_otp', 'param_token')
 * @returns {Promise<VerificationData | undefined>} Data verifikasi jika ditemukan, undefined jika tidak
 */
export const findByUserId = async (
  userId: string,
  type: 'email_otp' | 'phone_otp' | 'param_token',
): Promise<VerificationData | undefined> => {
  const pool = getPool();

  const res = await pool.query('SELECT * FROM verifications WHERE user_id = $1 AND type = $2', [
    userId,
    type,
  ]);

  return res.rows[0];
};

/**
 * Menyimpan data verifikasi baru ke database.
 * @param {Pick<VerificationData, 'id' | 'user_id' | 'token' | 'type' | 'last_sent_at' | 'expired_at'> & { new_value?: string }} data - Data verifikasi yang akan disimpan
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diinsert, null jika gagal
 */
export const create = async (
  data: Pick<
    VerificationData,
    'id' | 'user_id' | 'token' | 'type' | 'last_sent_at' | 'expired_at'
  > & { new_value?: string },
): Promise<number | null> => {
  const pool = getPool();

  const fields = Object.keys(data).join(', ');
  const placeholders = Object.keys(data)
    .map((_, index) => `$${index + 1}`)
    .join(', ');

  const res = await pool.query(
    `INSERT INTO verifications (${fields}) VALUES (${placeholders})`,
    Object.values(data),
  );

  return res.rowCount;
};

/**
 * Memperbarui data verification berdasarkan ID secara dinamis.
 * @param {Partial<VerificationData>} verificationData - Data verification yang ingin diperbarui, wajib menyertakan id
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diupdate, null jika gagal
 */
export const updateById = async (
  verificationData: Partial<VerificationData>,
): Promise<number | null> => {
  const pool = getPool();

  const { id, ...data } = verificationData;

  const placeholders = Object.keys(data)
    .map((field, index) => `${field} = $${index + 2}`)
    .join(', ');

  const res = await pool.query(`UPDATE verifications SET ${placeholders} WHERE id = $1`, [
    id,
    ...Object.values(data),
  ]);

  return res.rowCount;
};

/**
 * Mengurangi sisa batas pengiriman ulang verifikasi milik pengguna sebanyak 1.
 * Nilai minimum adalah 0, tidak akan menjadi negatif.
 * @param {string} userId - ID unik pengguna dengan panjang 15 karakter
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diupdate, null jika gagal
 */
export const decrementLimit = async (userId: string): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    'UPDATE verifications SET limit_request = GREATEST(0, limit_request - 1) WHERE user_id = $1',
    [userId],
  );

  return res.rowCount;
};

/**
 * Menghapus semua data verifikasi milik pengguna berdasarkan ID pengguna.
 * @param {string} userId - ID unik pengguna dengan panjang 15 karakter
 * @returns {Promise<number | null>} Jumlah baris yang berhasil dihapus, null jika gagal
 */
export const deleteByUserId = async (userId: string): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query('DELETE FROM verifications WHERE user_id = $1', [userId]);

  return res.rowCount;
};

/**
 * Menghapus data verifikasi milik pengguna berdasarkan ID pengguna dan tipe verifikasi.
 * Lebih spesifik dari deleteByUserId karena hanya menghapus tipe verifikasi tertentu.
 *
 * @param {string} userId - ID unik pengguna dengan panjang 15 karakter
 * @param {string} type - Tipe verifikasi yang ingin dihapus ('email_otp', 'phone_otp', 'param_token')
 * @returns {Promise<number | null>} Jumlah baris yang berhasil dihapus, null jika gagal
 */
export const deleteByUserIdAndType = async (
  userId: string,
  type: 'email_otp' | 'phone_otp' | 'param_token',
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query('DELETE FROM verifications WHERE user_id = $1 AND type = $2', [
    userId,
    type,
  ]);

  return res.rowCount;
};
