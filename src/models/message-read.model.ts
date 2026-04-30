import { getPool } from '@/lib/pg.js';

import type { MessageReadData } from '@/@types/globals.js';

/**
 * Mencari read receipt berdasarkan userId dan messageId.
 * Digunakan untuk mengecek apakah pesan sudah pernah dibaca sebelumnya.
 *
 * @param {string} userId - ID pengguna yang membaca
 * @param {string} messageId - ID pesan yang dibaca
 * @returns {Promise<MessageReadData | undefined>} Data read receipt jika ditemukan
 */
export const findByUserAndMessage = async (
  userId: string,
  messageId: string,
): Promise<MessageReadData | undefined> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT * FROM message_reads WHERE user_id = $1 AND message_id = $2`,
    [userId, messageId],
  );

  return res.rows[0];
};

/**
 * Menyimpan read receipt baru ke database.
 *
 * @param {Pick<MessageReadData, 'id' | 'user_id' | 'message_id'>} data - Data read receipt baru
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diinsert, null jika gagal
 */
export const create = async (
  data: Pick<MessageReadData, 'id' | 'user_id' | 'message_id'>,
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO message_reads (id, user_id, message_id) VALUES ($1, $2, $3)`,
    [data.id, data.user_id, data.message_id],
  );

  return res.rowCount;
};

/**
 * Mengambil semua read receipt untuk sebuah pesan.
 * Digunakan untuk menampilkan siapa saja yang sudah membaca pesan di group chat.
 *
 * @param {string} messageId - ID pesan
 * @returns {Promise<MessageReadData[]>} Daftar read receipt
 */
export const findByMessage = async (messageId: string): Promise<MessageReadData[]> => {
  const pool = getPool();

  const res = await pool.query(`SELECT * FROM message_reads WHERE message_id = $1`, [messageId]);

  return res.rows;
};
