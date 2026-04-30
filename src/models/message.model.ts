import { getPool } from '@/lib/pg.js';

import type { MessageData } from '@/@types/globals.js';

/**
 * Menyimpan pesan baru ke database.
 * Mendukung fitur reply dengan parameter opsional reply_to_message_id.
 *
 * @param {Pick<MessageData, 'id' | 'conversation_id' | 'sender_id' | 'content' | 'reply_to_message_id'>} data - Data pesan baru
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diinsert, null jika gagal
 */
export const create = async (
  data: Pick<
    MessageData,
    'id' | 'conversation_id' | 'sender_id' | 'content' | 'reply_to_message_id'
  >,
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO messages (id, conversation_id, sender_id, content, reply_to_message_id) 
     VALUES ($1, $2, $3, $4, $5)`,
    [data.id, data.conversation_id, data.sender_id, data.content, data.reply_to_message_id],
  );

  return res.rowCount;
};

/**
 * Mengambil semua pesan dalam sebuah conversation tanpa filter last_cleared_at.
 * Digunakan di handler WebSocket saat kirim pesan baru.
 * Mengurutkan dari yang terlama ke terbaru.
 *
 * @param {string} conversationId - ID conversation
 * @param {number} limit - Jumlah pesan yang diambil (default 50)
 * @param {number} offset - Offset untuk pagination (default 0)
 * @returns {Promise<MessageData[]>} Daftar pesan
 */
export const findByConversation = async (
  conversationId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<MessageData[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT * FROM messages 
     WHERE conversation_id = $1
       AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset],
  );

  return res.rows;
};

/**
 * Mengambil pesan dalam sebuah conversation dengan filter last_cleared_at per user.
 * Beserta agregasi status baca (reads) dan reaksi emoji (reactions).
 */
export const findByConversationWithClear = async (
  conversationId: string,
  lastClearedAt: Date | null,
  limit: number = 50,
  offset: number = 0,
): Promise<any[]> => {
  // Gunakan any[] sementara atau sesuaikan tipenya nanti
  const pool = getPool();

  // Menggunakan Subquery SELECT untuk menghindari Cartesian Product
  // akibat JOIN ke dua tabel one-to-many (reads & reactions) sekaligus.
  let query = `
    SELECT 
      m.*,
      (
        SELECT COALESCE(
          json_agg(json_build_object('user_id', mr.user_id, 'read_at', mr.read_at)), 
          '[]'
        ) 
        FROM message_reads mr WHERE mr.message_id = m.id
      ) AS reads,
      (
        SELECT COALESCE(
          json_agg(json_build_object('id', reac.id, 'user_id', reac.user_id, 'reaction', reac.reaction)), 
          '[]'
        ) 
        FROM message_reactions reac WHERE reac.message_id = m.id
      ) AS reactions
    FROM messages m
    WHERE m.conversation_id = $1
      AND m.deleted_at IS NULL
  `;

  const params: (string | Date | number)[] = [conversationId];

  if (lastClearedAt) {
    query += ` AND m.created_at > $2`;
    params.push(lastClearedAt);
  }

  query += `
    ORDER BY m.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  params.push(limit, offset);

  const res = await pool.query(query, params);

  return res.rows;
};

/**
 * Mencari pesan berdasarkan ID.
 * Hanya mengembalikan pesan yang belum di-soft delete.
 *
 * @param {string} id - ID pesan
 * @returns {Promise<MessageData | undefined>} Data pesan jika ditemukan
 */
export const findById = async (id: string): Promise<MessageData | undefined> => {
  const pool = getPool();

  const res = await pool.query(`SELECT * FROM messages WHERE id = $1 AND deleted_at IS NULL`, [id]);

  return res.rows[0];
};

/**
 * Soft delete pesan berdasarkan ID.
 * Kolom deleted_at diset ke NOW(), pesan tetap ada di DB
 * tapi tidak ditampilkan ke semua participant (global delete).
 * Mirip WhatsApp "pesan ini telah dihapus".
 *
 * @param {string} id - ID pesan yang akan dihapus
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diupdate, null jika gagal
 */
export const softDelete = async (id: string): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`UPDATE messages SET deleted_at = NOW() WHERE id = $1`, [id]);

  return res.rowCount;
};

/**
 * Memperbarui konten pesan (Edit Pesan).
 * Mengubah flag is_edited menjadi TRUE.
 *
 * @param {string} id - ID pesan yang diedit
 * @param {string} content - Konten teks yang baru
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diupdate
 */
export const updateContent = async (id: string, content: string): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `UPDATE messages 
     SET content = $1, is_edited = TRUE, updated_at = NOW() 
     WHERE id = $2`,
    [content, id],
  );

  return res.rowCount;
};

/**
 * Mengambil semua pesan yang belum dibaca oleh user dalam sebuah conversation.
 * Digunakan saat user pertama kali login untuk fetch unread messages.
 * Mengecualikan pesan yang dikirim oleh user sendiri.
 *
 * @param {string} conversationId - ID conversation
 * @param {string} userId - ID pengguna
 * @returns {Promise<MessageData[]>} Daftar pesan yang belum dibaca
 */
export const findUnreadByConversation = async (
  conversationId: string,
  userId: string,
): Promise<MessageData[]> => {
  const pool = getPool();

  // Ambil pesan yang belum ada di message_reads untuk user ini
  const res = await pool.query(
    `SELECT m.* FROM messages m
     LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = $2
     WHERE m.conversation_id = $1
       AND m.deleted_at IS NULL
       AND m.sender_id != $2
       AND mr.id IS NULL
     ORDER BY m.created_at ASC`,
    [conversationId, userId],
  );

  return res.rows;
};
