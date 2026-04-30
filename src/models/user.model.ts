import { getPool } from '@/lib/pg.js';

import type { UserData } from '@/@types/globals.js';

/**
 * Mencari data pengguna berdasarkan ID unik.
 * @param {string} id - ID unik pengguna dengan panjang 15 karakter
 * @returns {Promise<UserData | undefined>} Data pengguna jika ditemukan, undefined jika tidak
 */
export const findById = async (id: string): Promise<UserData | undefined> => {
  const pool = getPool();

  const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

  return res.rows[0];
};

/**
 * Mencari data pengguna berdasarkan ID untuk ditampilkan ke user lain.
 * Hanya mengembalikan field yang aman, tanpa field sensitif.
 *
 * @param {string} id - ID unik pengguna
 * @returns {Promise<UserData | undefined>}
 */
export const findPublicById = async (id: string): Promise<UserData | undefined> => {
  const pool = getPool();

  const res = await pool.query(`SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);

  return res.rows[0];
};

/**
 * Mencari banyak pengguna sekaligus berdasarkan array ID.
 * Menggunakan ANY($1) untuk menghindari N+1 query problem.
 *
 * @param {string[]} ids - Array ID pengguna
 * @returns {Promise<UserData[]>} Daftar pengguna yang ditemukan
 */
export const findByIds = async (ids: string[]): Promise<UserData[]> => {
  if (ids.length === 0) return [];

  const pool = getPool();

  const res = await pool.query(`SELECT * FROM users WHERE id = ANY($1) AND deleted_at IS NULL`, [
    ids,
  ]);

  return res.rows;
};

/**
 * Mencari data pengguna berdasarkan PIN unik.
 * @param {string} pin - PIN unik pengguna dengan panjang 8 karakter
 * @returns {Promise<UserData | undefined>} Data pengguna jika ditemukan, undefined jika tidak
 */
export const findByPin = async (pin: string): Promise<UserData | undefined> => {
  const pool = getPool();

  const res = await pool.query('SELECT * FROM users WHERE pin = $1', [pin]);

  return res.rows[0];
};

/**
 * Mencari data pengguna berdasarkan username.
 * @param {string} username - Username unik pengguna
 * @returns {Promise<UserData | undefined>} Data pengguna jika ditemukan, undefined jika tidak
 */
export const findByUsername = async (username: string): Promise<UserData | undefined> => {
  const pool = getPool();

  const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

  return res.rows[0];
};

/**
 * Mencari data pengguna berdasarkan alamat email.
 * @param {string} email - Alamat email unik pengguna
 * @returns {Promise<UserData | undefined>} Data pengguna jika ditemukan, undefined jika tidak
 */
export const findByEmail = async (email: string): Promise<UserData | undefined> => {
  const pool = getPool();

  const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

  return res.rows[0];
};

/**
 * Mencari data pengguna berdasarkan nomor phone.
 * @param {string} phone - Alamat phone unik pengguna
 * @returns {Promise<UserData | undefined>} Data pengguna jika ditemukan, undefined jika tidak
 */
export const findByPhone = async (phone: string): Promise<UserData | undefined> => {
  const pool = getPool();

  const res = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);

  return res.rows[0];
};

/**
 * Mencari data pengguna berdasarkan identifier yang dapat berupa username, email, atau nomor telepon.
 * Digunakan untuk proses autentikasi login tanpa membatasi jenis identifier yang digunakan.
 *
 * @param {string} identifier - Username, alamat email, atau nomor telepon pengguna
 * @returns {Promise<UserData | undefined>} Data pengguna jika ditemukan, undefined jika tidak
 */
export const findByIdentifier = async (identifier: string): Promise<UserData | undefined> => {
  const pool = getPool();

  const res = await pool.query(
    'SELECT * FROM users WHERE username = $1 OR email = $1 OR phone = $1 LIMIT 1',
    [identifier],
  );

  return res.rows[0];
};

/**
 * Mencari data pengguna berdasarkan query yang dapat berupa username.
 * Menggunakan ILIKE untuk pencarian username yang case-insensitive.
 *
 * @param {string} query - Kata kunci pencarian berupa username
 * @returns {Promise<UserData[]>} Daftar pengguna yang cocok dengan query, array kosong jika tidak ada
 */
export const searchByQuery = async (query: string, currentUserId: string): Promise<UserData[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT * FROM users 
     WHERE username ILIKE $1 
       AND deleted_at IS NULL
       AND id != $2
       AND id NOT IN (
         SELECT CASE 
           WHEN requester_id = $2 THEN receiver_id 
           ELSE requester_id 
         END
         FROM friendships
         WHERE (requester_id = $2 OR receiver_id = $2)
           AND status = 'blocked'
       )
       AND (
         hide_profile = FALSE
         OR id IN (
           SELECT CASE
             WHEN requester_id = $2 THEN receiver_id
             ELSE requester_id
           END
           FROM friendships
           WHERE (requester_id = $2 OR receiver_id = $2)
             AND status = 'accepted'
         )
       )
     LIMIT 20`,
    [`%${query}%`, currentUserId],
  );

  return res.rows;
};

/**
 * Menyimpan data pengguna baru ke database.
 * @param {Pick<UserData, 'id' | 'fullname' | 'username' | 'email' | 'password'>} data - Data minimal pengguna baru
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diinsert, null jika gagal
 */
export const create = async (
  data: Pick<UserData, 'id' | 'fullname' | 'username' | 'email' | 'password'>,
): Promise<number | null> => {
  const pool = getPool();

  const fields = Object.keys(data).join(', ');
  const placeholders = Object.keys(data)
    .map((_, index) => `$${index + 1}`)
    .join(', ');

  const res = await pool.query(
    `INSERT INTO users (${fields}) VALUES (${placeholders})`,
    Object.values(data),
  );

  return res.rowCount;
};

/**
 * Memperbarui data pengguna berdasarkan ID secara dinamis.
 * @param {Partial<UserData>} userData - Data pengguna yang ingin diperbarui, wajib menyertakan id
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diupdate, null jika gagal
 */
export const updateById = async (userData: Partial<UserData>): Promise<number | null> => {
  const pool = getPool();

  const { id, ...data } = userData;

  const placeholders = Object.keys(data)
    .map((field, index) => `${field} = $${index + 2}`)
    .join(', ');

  const res = await pool.query(`UPDATE users SET ${placeholders} WHERE id = $1`, [
    id,
    ...Object.values(data),
  ]);

  return res.rowCount;
};
