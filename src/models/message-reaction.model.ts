import { getPool } from '@/lib/pg.js';

/**
 * Menyimpan atau memperbarui reaksi (emoji) dari pengguna pada sebuah pesan.
 * Menggunakan pendekatan UPSERT (Insert on Conflict Update) karena
 * satu pengguna hanya boleh memberikan maksimal satu reaksi per pesan.
 *
 * @param {string} id - ID unik untuk reaksi (dihasilkan oleh Generator)
 * @param {string} messageId - ID pesan yang diberikan reaksi
 * @param {string} userId - ID pengguna yang memberikan reaksi
 * @param {string} reaction - Karakter emoji reaksi (contoh: "👍")
 * @returns {Promise<number>} Jumlah baris yang terpengaruh (1 jika sukses)
 */
export const upsertReaction = async (
  id: string,
  messageId: string,
  userId: string,
  reaction: string,
): Promise<number> => {
  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO message_reactions (id, message_id, user_id, reaction) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (message_id, user_id) 
     DO UPDATE SET reaction = EXCLUDED.reaction, created_at = NOW()`,
    [id, messageId, userId, reaction],
  );

  return res.rowCount ?? 0;
};

/**
 * Menghapus reaksi pengguna dari sebuah pesan secara permanen (Hard Delete).
 * Digunakan ketika pengguna melakukan aksi "unreact" (mengeklik emoji yang sama dua kali).
 *
 * @param {string} messageId - ID pesan yang reaksinya akan dicabut
 * @param {string} userId - ID pengguna yang mencabut reaksinya
 * @returns {Promise<number>} Jumlah baris yang berhasil dihapus (biasanya 1 jika sukses, 0 jika tidak ada)
 */
export const removeReaction = async (messageId: string, userId: string): Promise<number> => {
  const pool = getPool();

  const res = await pool.query(
    `DELETE FROM message_reactions 
     WHERE message_id = $1 AND user_id = $2`,
    [messageId, userId],
  );

  return res.rowCount ?? 0;
};

/**
 * (Opsional) Mengambil semua reaksi dari sebuah pesan.
 * Berguna jika suatu saat Anda butuh endpoint REST API khusus untuk menarik daftar reaksi.
 *
 * @param {string} messageId - ID pesan
 * @returns {Promise<Array<{ id: string, user_id: string, reaction: string }>>} Daftar reaksi
 */
export const getReactionsByMessage = async (
  messageId: string,
): Promise<{ id: string; user_id: string; reaction: string }[]> => {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT id, user_id, reaction 
     FROM message_reactions 
     WHERE message_id = $1 
     ORDER BY created_at ASC`,
    [messageId],
  );

  return rows;
};
