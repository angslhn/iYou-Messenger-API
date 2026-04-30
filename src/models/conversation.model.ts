import { getPool } from '@/lib/pg.js';

import type { ConversationData, ConversationParticipantData } from '@/@types/globals.js';

/**
 * Mencari conversation private yang sudah ada antara dua pengguna.
 * Menggunakan JOIN ke conversation_participants untuk memastikan
 * kedua user ada di conversation yang sama dan bertipe private.
 *
 * FIXED: Hapus AND c.deleted_at IS NULL — kolom ini tidak ada di tabel conversations.
 * Soft delete dilakukan per user melalui conversation_participants.deleted_at.
 *
 * @param {string} userIdA - ID pengguna pertama
 * @param {string} userIdB - ID pengguna kedua
 * @returns {Promise<ConversationData | undefined>} Data conversation jika ditemukan
 */
export const findPrivateByUsers = async (
  userIdA: string,
  userIdB: string,
): Promise<ConversationData | undefined> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT c.* FROM conversations c
     JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
     WHERE c.type = 'private'
     LIMIT 1`,
    [userIdA, userIdB],
  );

  return res.rows[0];
};

/**
 * Mencari conversation berdasarkan ID.
 *
 * FIXED: Hapus AND deleted_at IS NULL — kolom ini tidak ada di tabel conversations.
 *
 * @param {string} id - ID conversation
 * @returns {Promise<ConversationData | undefined>} Data conversation jika ditemukan
 */
export const findById = async (id: string): Promise<ConversationData | undefined> => {
  const pool = getPool();

  const res = await pool.query(`SELECT * FROM conversations WHERE id = $1`, [id]);

  return res.rows[0];
};

/**
 * Mengambil detail profil semua anggota aktif dalam sebuah percakapan.
 * Melakukan resolusi nama (fallback ke username jika fullname kosong).
 *
 * @param {string} conversationId - ID percakapan
 * @returns {Promise<any[]>} Daftar partisipan dengan data profil (user_id, username, fullname, avatar_url, role)
 */
export const findParticipantsInfo = async (conversationId: string): Promise<any[]> => {
  const pool = getPool();

  const query = `
    SELECT 
      u.id AS user_id,
      u.username,
      u.fullname,
      u.avatar_url,
      cp.role
    FROM conversation_participants cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.conversation_id = $1 
      AND cp.status = 'active'
      AND cp.deleted_at IS NULL
    ORDER BY 
      -- Urutkan Admin di atas, lalu urutkan berdasarkan abjad nama
      CASE WHEN cp.role = 'admin' THEN 1 ELSE 2 END ASC, 
      u.username ASC
  `;

  const res = await pool.query(query, [conversationId]);
  return res.rows;
};

/**
 * Mengambil semua conversation aktif milik seorang pengguna.
 * Menggunakan CTE untuk menghindari correlated subquery O(N) pada messages.
 * Setiap agregasi (last_message, unread_count) dihitung sekali, bukan per-row.
 *
 * @param {string} userId - ID pengguna
 * @param {'private' | 'group'} type - Tipe conversation
 * @param {boolean} isArchived - Filter arsip
 * @returns {Promise<any[]>} Daftar semua percakapan sesuai permintaan dari private atau group
 */
export const findAllActiveByUser = async (
  userId: string,
  type: 'private' | 'group',
  isArchived: boolean,
): Promise<any> => {
  const pool = getPool();

  const dataQuery = pool.query(
    `WITH

    -- 1. Conversation aktif milik user (base filter, dipakai di semua CTE)
    my_conversations AS (
      SELECT
        cp.conversation_id,
        cp.id AS participant_id,
        cp.role,
        cp.is_pinned,
        cp.is_archived,
        cp.is_muted,
        cp.last_cleared_at
      FROM conversation_participants cp
      WHERE cp.user_id = $1
        AND cp.deleted_at IS NULL
        AND cp.status = 'active'
    ),

    -- 2. Pesan terakhir per conversation — dihitung SEKALI, bukan per-row
    last_messages AS (
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id,
        m.id,
        m.content,
        m.sender_id,
        m.created_at
      FROM messages m
      JOIN my_conversations mc ON mc.conversation_id = m.conversation_id
      WHERE m.deleted_at IS NULL
        AND (
          mc.last_cleared_at IS NULL
          OR m.created_at > mc.last_cleared_at
        )
      ORDER BY m.conversation_id, m.created_at DESC
    ),

    -- 3. Unread count per conversation — dihitung SEKALI, bukan per-row
    unread_counts AS (
      SELECT
        m.conversation_id,
        COUNT(m.id)::int AS unread_count
      FROM messages m
      JOIN my_conversations mc ON mc.conversation_id = m.conversation_id
      LEFT JOIN message_reads mr
        ON mr.message_id = m.id
       AND mr.user_id = $1
      WHERE m.sender_id != $1
        AND m.deleted_at IS NULL
        AND mr.id IS NULL
        AND (
          mc.last_cleared_at IS NULL
          OR m.created_at > mc.last_cleared_at
        )
      GROUP BY m.conversation_id
    )

    SELECT
      c.id,
      c.type,
      c.created_at,

      -- Nama & Avatar: dinamis antara private dan group
      CASE WHEN c.type = 'private'
      THEN COALESCE(u.fullname, u.username)
      ELSE c.name
      END AS name,

      -- Deskripsi grup
      CASE WHEN c.type = 'group'
        THEN c.description
        ELSE NULL
      END AS description,

      CASE WHEN c.type = 'private'
        THEN u.avatar_url
        ELSE c.avatar_url
      END AS avatar_url,

      -- Status online & last seen hanya untuk private
      CASE WHEN c.type = 'private'
        THEN u.is_online
        ELSE NULL
      END AS is_online,

      CASE WHEN c.type = 'private' AND u.show_last_seen = TRUE
        THEN u.last_seen
        ELSE NULL
      END AS last_seen,

      mc.participant_id,
      mc.role,
      mc.is_pinned,
      mc.is_archived,
      mc.is_muted,
      mc.last_cleared_at,
      u.id AS target_user_id,

      -- Last message dari CTE, bukan subquery ulang
      CASE WHEN lm.id IS NOT NULL
        THEN json_build_object(
          'id', lm.id,
          'content', lm.content,
          'sender_id', lm.sender_id,
          'created_at', lm.created_at
        )
        ELSE NULL
      END AS last_message,

      -- Unread count dari CTE, default 0 jika tidak ada
      COALESCE(uc.unread_count, 0) AS unread_count

    FROM conversations c
    JOIN my_conversations mc ON mc.conversation_id = c.id

    -- Resolusi lawan bicara untuk private (tetap pakai LEFT JOIN, sudah optimal)
    LEFT JOIN conversation_participants cp2
      ON  c.type = 'private'
      AND cp2.conversation_id = c.id
      AND cp2.user_id != $1
    LEFT JOIN users u ON cp2.user_id = u.id

    -- Join hasil CTE agregasi
    LEFT JOIN last_messages lm ON lm.conversation_id = c.id
    LEFT JOIN unread_counts uc ON uc.conversation_id = c.id

    WHERE c.type = $2
      AND mc.is_archived = $3

    -- ORDER BY pakai kolom CTE — tidak ada subquery tersembunyi lagi
    ORDER BY
      mc.is_pinned DESC,
      COALESCE(lm.created_at, c.created_at) DESC`,
    [userId, type, isArchived],
  );

  const countQuery = pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE cp.is_archived = false)::int AS total_active,
       COUNT(*) FILTER (WHERE cp.is_pinned = true AND cp.is_archived = false)::int AS total_pinned,
       COUNT(*) FILTER (WHERE cp.is_archived = true)::int AS total_archived
     FROM conversation_participants cp
     JOIN conversations c ON c.id = cp.conversation_id
     WHERE cp.user_id = $1
       AND cp.deleted_at IS NULL
       AND cp.status  = 'active'
       AND c.type = $2`,
    [userId, type],
  );

  // Jalankan Bersamaan (Super Cepat)
  const [dataRes, countRes] = await Promise.all([dataQuery, countQuery]);

  const meta = countRes.rows[0] ?? {
    total_active: 0,
    total_pinned: 0,
    total_archived: 0,
  };

  return {
    conversations: dataRes.rows,
    meta: {
      totalCount: meta.total_active,
      pinnedCount: meta.total_pinned,
      archivedCount: meta.total_archived,
    },
  };
};

/**
 * Mengambil daftar undangan grup yang masih pending untuk seorang user.
 * Melakukan JOIN untuk mendapatkan nama grup dan data admin yang mengundang.
 * @param {string} userId - ID pengguna
 * @returns {Promise<any[]>} Daftar undangan grup
 */
export const findPendingInvites = async (userId: string): Promise<any[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT 
       ci.id AS invite_id,
       c.id AS conversation_id,
       c.name AS group_name,
       u.id AS inviter_id,
       u.username AS inviter_username,
       u.fullname AS inviter_fullname,
       ci.created_at
     FROM conversation_invites ci
     JOIN conversations c ON c.id = ci.conversation_id
     JOIN users u ON u.id = ci.invited_by
     WHERE ci.invited_user_id = $1 
       AND ci.status = 'pending'
     ORDER BY ci.created_at DESC`,
    [userId],
  );

  return res.rows;
};

/**
 * Mengambil jumlah undangan grup yang masuk (pending) untuk seorang pengguna.
 *
 * @param {string} userId - ID pengguna diundang
 * @returns {Promise<number>} Jumlah permintaan
 */
export const countPendingInvites = async (userId: string): Promise<number> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT COUNT(id) AS count FROM conversation_invites WHERE invited_user_id = $1 AND status = 'pending'`,
    [userId],
  );

  return parseInt(res.rows[0]?.count ?? '0');
};

/**
 * Mencari data spesifik undangan berdasarkan ID.
 * @param {string} inviteId - ID invite group
 * @returns {Promise<any>} Data undangan group
 */
export const findInviteById = async (inviteId: string): Promise<any> => {
  const pool = getPool();

  const res = await pool.query(`SELECT * FROM conversation_invites WHERE id = $1`, [inviteId]);

  return res.rows[0];
};

/**
 * Mengubah status undangan (accepted / rejected).
 * @param {string} inviteId - ID invite group
 * @param {'accepted' | 'rejected'} status - Status group
 * @returns {Promise<number | null>}
 */
export const updateInviteStatus = async (
  inviteId: string,
  status: 'accepted' | 'rejected',
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`UPDATE conversation_invites SET status = $1 WHERE id = $2`, [
    status,
    inviteId,
  ]);

  return res.rowCount;
};

/**
 * Memperbarui informasi profil grup.
 * @param {string} id - ID percakapan grup
 * @param {object} data - Object berisi field yang ingin diubah (name, description, avatar_url)
 * @returns {Promise<void>}
 */
export const updateGroup = async (
  id: string,
  data: { name?: string; description?: string; avatar_url?: string },
): Promise<void> => {
  const pool = getPool();
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }

  values.push(id);
  const query = `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${idx} AND type = 'group'`;

  await pool.query(query, values);
};

/**
 * Mencari riwayat undangan antara grup tertentu dan pengguna tertentu.
 * Digunakan untuk mengecek status terakhir (pending/accepted/rejected).
 * * @param {string} conversationId - ID grup
 * @param {string} userId - ID pengguna yang diundang
 * @returns {Promise<any | undefined>} Data undangan terakhir jika ada
 */
export const findInviteHistory = async (
  conversationId: string,
  userId: string,
): Promise<any | undefined> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT * FROM conversation_invites 
     WHERE conversation_id = $1 AND invited_user_id = $2 
     ORDER BY created_at DESC LIMIT 1`,
    [conversationId, userId],
  );

  return res.rows[0];
};

/**
 * Menyimpan data undangan grup baru.
 * * @param {object} data - Data minimal untuk record undangan
 * @returns {Promise<number | null>}
 */
export const createGroupInvite = async (data: {
  id: string;
  conversation_id: string;
  invited_by: string;
  invited_user_id: string;
}): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO conversation_invites (id, conversation_id, invited_by, invited_user_id, status) 
     VALUES ($1, $2, $3, $4, 'pending')`,
    [data.id, data.conversation_id, data.invited_by, data.invited_user_id],
  );

  return res.rowCount;
};

/**
 * Mencari grup percakapan berdasarkan PIN unik.
 * Digunakan untuk memastikan PIN yang di-generate benar-benar unik dan belum dipakai grup lain.
 *
 * @param {string} pin - PIN unik grup dengan panjang 8 karakter
 * @returns {Promise<ConversationData | undefined>} Data percakapan jika ditemukan
 */
export const findByPin = async (pin: string): Promise<ConversationData | undefined> => {
  const pool = getPool();

  const res = await pool.query(`SELECT * FROM conversations WHERE pin = $1 AND type = 'group'`, [
    pin,
  ]);

  return res.rows[0];
};

/**
 * Memperbarui nilai PIN dari sebuah grup percakapan.
 *
 * @param {string} id - ID percakapan grup
 * @param {string | null} pin - PIN baru (atau null untuk menghapus PIN)
 * @returns {Promise<number | null>} Jumlah baris yang di-update
 */
export const updatePin = async (id: string, pin: string | null): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`UPDATE conversations SET pin = $1 WHERE id = $2`, [pin, id]);

  return res.rowCount;
};

/**
 * Mengambil detail profil grup beserta seluruh daftar anggotanya yang aktif.
 * Menggabungkan (JOIN) tabel conversation_participants dengan tabel users untuk
 * mendapatkan profil lengkap seperti username, fullname, dan status online.
 * @param {string} conversationId - ID dari grup percakapan
 * @returns {Promise<any | null>} Mengembalikan object berisi detail grup dan array members, atau null jika grup tidak ditemukan
 */
export const findGroupInfoWithMembers = async (conversationId: string): Promise<any | null> => {
  const pool = getPool();

  // Ambil detail inti dari grup
  const groupRes = await pool.query(
    `SELECT id, avatar_url, name, description, pin, created_at 
     FROM conversations 
     WHERE id = $1 AND type = 'group'`,
    [conversationId],
  );

  const group = groupRes.rows[0];

  // Jika bukan grup atau tidak ditemukan, langsung return null
  if (!group) return null;

  // Ambil daftar anggota yang berstatus 'active' dan tidak soft-deleted
  const membersRes = await pool.query(
    `SELECT 
       cp.user_id AS id,
       cp.role,
       u.username,
       u.fullname,
       u.avatar_url,
       u.is_online,
       u.last_seen,
       u.show_last_seen
     FROM conversation_participants cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.conversation_id = $1 
       AND cp.deleted_at IS NULL
       AND cp.status = 'active'
     ORDER BY cp.role ASC, u.fullname ASC`, // Urutkan: Admin di atas, lalu alfabetis
    [conversationId],
  );

  // Gabungkan dan kembalikan datanya
  return {
    ...group,
    members: membersRes.rows.map((m) => ({
      id: m.id,
      username: m.username,
      fullname: m.fullname,
      avatar_url: m.avatar_url,
      role: m.role,
      is_online: m.is_online,
      // Format last_seen menjadi null jika user mengaktifkan hide last seen (show_last_seen = false)
      last_seen: m.show_last_seen ? m.last_seen : null,
    })),
  };
};

/**
 * Menyimpan conversation baru ke database.
 *
 * @param {Pick<ConversationData, 'id' | 'type'>} data - Data conversation baru
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diinsert, null jika gagal
 */
export const create = async (
  data: Pick<ConversationData, 'id' | 'type'>,
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`INSERT INTO conversations (id, type) VALUES ($1, $2)`, [
    data.id,
    data.type,
  ]);

  return res.rowCount;
};

/**
 * Membuat group conversation baru dengan nama, deskripsi, dan avatar.
 *
 * @param {Pick<ConversationData, 'id' | 'name' | 'description' | 'avatar_url'>} data
 * @returns {Promise<number | null>}
 */
export const createGroup = async (data: {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
}): Promise<number | null> => {
  const pool = getPool();

  const query = `
    INSERT INTO conversations (id, type, name, description, avatar_url) 
    VALUES ($1, 'group', $2, $3, $4)
  `;

  const res = await pool.query(query, [data.id, data.name, data.description, data.avatar_url]);

  return res.rowCount;
};

/**
 * Hard delete conversation berdasarkan ID.
 * Digunakan khusus untuk deleteGroup — menghapus conversation grup secara permanen
 * beserta semua participant dan pesan (via CASCADE jika ada, atau manual).
 * Berbeda dengan soft delete per user di conversation_participants.
 *
 * @param {string} id - ID conversation yang akan dihapus permanen
 * @returns {Promise<number | null>}
 */
export const hardDeleteById = async (id: string): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`DELETE FROM conversations WHERE id = $1`, [id]);

  return res.rowCount;
};

/**
 * Menambahkan participant baru ke dalam conversation.
 *
 * @param {Pick<ConversationParticipantData, 'id' | 'user_id' | 'conversation_id' | 'role' | 'status'>} data
 * @returns {Promise<number | null>}
 */
export const addParticipant = async (
  data: Pick<ConversationParticipantData, 'id' | 'user_id' | 'conversation_id' | 'role' | 'status'>,
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO conversation_participants (id, user_id, conversation_id, role, status) 
     VALUES ($1, $2, $3, $4, $5)`,
    [data.id, data.user_id, data.conversation_id, data.role, data.status],
  );

  return res.rowCount;
};

/**
 * Mencari data participant berdasarkan userId dan conversationId.
 * Digunakan untuk cek apakah user adalah member conversation,
 * role-nya apa (peer/admin/member), dan status-nya.
 *
 * @param {string} userId - ID pengguna
 * @param {string} conversationId - ID conversation
 * @returns {Promise<ConversationParticipantData | undefined>}
 */
export const findParticipant = async (
  userId: string,
  conversationId: string,
): Promise<ConversationParticipantData | undefined> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT * FROM conversation_participants 
     WHERE user_id = $1 AND conversation_id = $2
     LIMIT 1`,
    [userId, conversationId],
  );

  return res.rows[0];
};

/**
 * Mengambil semua participant aktif dalam sebuah conversation.
 * Digunakan untuk broadcast WS event ke semua member
 * (misalnya group:deleted, group:member_left).
 * Hanya mengambil participant dengan deleted_at IS NULL.
 *
 * @param {string} conversationId - ID conversation
 * @returns {Promise<ConversationParticipantData[]>}
 */
export const findAllParticipants = async (
  conversationId: string,
): Promise<ConversationParticipantData[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT * FROM conversation_participants 
     WHERE conversation_id = $1
       AND deleted_at IS NULL
       AND status = 'active'`,
    [conversationId],
  );

  return res.rows;
};

/**
 * Mengambil semua participant dalam sebuah conversation, termasuk yang sudah soft-deleted.
 * Digunakan untuk reset deleted_at saat ada pesan baru masuk ke grup.
 *
 * @param {string} conversationId
 * @returns {Promise<ConversationParticipantData[]>}
 */
export const findAllParticipantsIncludeDeleted = async (
  conversationId: string,
): Promise<ConversationParticipantData[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT * FROM conversation_participants WHERE conversation_id = $1`,
    [conversationId],
  );

  return res.rows;
};

/**
 * Mengambil member tertua aktif dalam sebuah conversation group berdasarkan joined_at.
 * Hanya mengambil participant dengan status 'active' dan deleted_at IS NULL.
 * Digunakan saat admin terakhir keluar — member ini akan dipromote jadi admin baru
 * regardless of their current role ('member' atau 'peer').
 *
 * @param {string} conversationId - ID conversation grup
 * @param {string} excludeUserId - ID pengguna yang dikecualikan (biasanya admin yang keluar)
 * @returns {Promise<ConversationParticipantData | undefined>} Participant tertua jika ada, undefined jika grup kosong
 */
export const findOldestMember = async (
  conversationId: string,
  excludeUserId: string,
): Promise<ConversationParticipantData | undefined> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT * FROM conversation_participants
     WHERE conversation_id = $1
       AND user_id != $2
       AND deleted_at IS NULL
       AND status = 'active'
     ORDER BY joined_at ASC
     LIMIT 1`,
    [conversationId, excludeUserId],
  );

  return res.rows[0];
};

/**
 * Update kolom-kolom tertentu di conversation_participants secara dinamis.
 * Digunakan untuk toggle is_pinned, is_archived, is_muted,
 * serta set deleted_at dan last_cleared_at.
 *
 * @param {string} userId - ID pengguna
 * @param {string} conversationId - ID conversation
 * @param {Partial<Pick<ConversationParticipantData, 'is_pinned' | 'is_archived' | 'is_muted' | 'deleted_at' | 'last_cleared_at' | 'role'>>} data
 * @returns {Promise<number | null>}
 */
export const updateParticipant = async (
  userId: string,
  conversationId: string,
  data: Partial<
    Pick<
      ConversationParticipantData,
      'is_pinned' | 'is_archived' | 'is_muted' | 'deleted_at' | 'last_cleared_at' | 'role'
    >
  >,
): Promise<number | null> => {
  const pool = getPool();

  const entries = Object.entries(data);

  if (entries.length === 0) return null;

  const placeholders = entries.map(([key], index) => `${key} = $${index + 3}`).join(', ');
  const values = entries.map(([, val]) => val);

  // Hanya update participant yang masih aktif
  const res = await pool.query(
    `UPDATE conversation_participants 
   SET ${placeholders}
   WHERE user_id = $1 AND conversation_id = $2 AND deleted_at IS NULL`,
    [userId, conversationId, ...values],
  );

  return res.rowCount;
};

/**
 * Merubah role pengguna menjadi 'admin' didalam grup percakapan
 *
 * @param {string} userId - ID conversation
 * @param {string} conversationId - ID conversation
 * @returns {Promise<number | null>}
 */
export const promoteToAdmin = async (
  userId: string,
  conversationId: string,
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `UPDATE conversation_participants 
     SET role = 'admin'
     WHERE user_id = $1 AND conversation_id = $2`,
    [userId, conversationId],
  );

  return res.rowCount;
};

/**
 * Hard delete semua participant dalam sebuah conversation.
 * Dipanggil sebelum hardDeleteById saat admin menghapus grup.
 *
 * @param {string} conversationId - ID conversation
 * @returns {Promise<number | null>}
 */
export const deleteAllParticipants = async (conversationId: string): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`DELETE FROM conversation_participants WHERE conversation_id = $1`, [
    conversationId,
  ]);

  return res.rowCount;
};

/**
 * Hard delete semua pesan dalam sebuah conversation.
 * Dipanggil sebelum hardDeleteById saat admin menghapus grup.
 *
 * @param {string} conversationId - ID conversation
 * @returns {Promise<number | null>}
 */
export const deleteAllMessages = async (conversationId: string): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`DELETE FROM messages WHERE conversation_id = $1`, [conversationId]);

  return res.rowCount;
};

/**
 * Mereset kolom deleted_at participant menjadi NULL berdasarkan conversationId dan userId.
 * Dipanggil saat ada pesan baru masuk ke conversation yang sebelumnya sudah dihapus oleh user.
 * Chat akan muncul kembali di list dengan hanya menampilkan pesan setelah last_cleared_at.
 *
 * @param {string} conversationId - ID conversation
 * @param {string} userId - ID pengguna
 * @returns {Promise<number | null>}
 */
export const resetDeletedAt = async (
  conversationId: string,
  userId: string,
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `UPDATE conversation_participants 
     SET deleted_at = NULL 
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId],
  );

  return res.rowCount;
};

/**
 * Soft delete conversation per user — set deleted_at dan last_cleared_at.
 * Menggunakan query terpisah karena updateParticipant memfilter deleted_at IS NULL.
 *
 * @param {string} userId
 * @param {string} conversationId
 * @param {Date} now
 */
export const softDeleteParticipant = async (
  userId: string,
  conversationId: string,
  now: Date,
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `UPDATE conversation_participants
     SET deleted_at = $3, last_cleared_at = $3
     WHERE user_id = $1 AND conversation_id = $2`,
    [userId, conversationId, now],
  );

  return res.rowCount;
};

/**
 * Membersihkan riwayat obrolan (Clear Chat) untuk pengguna tertentu.
 * Hanya mengupdate last_cleared_at agar pesan yang masuk sebelum waktu ini tidak ditampilkan ke user.
 *
 * @param {string} userId - ID pengguna
 * @param {string} conversationId - ID percakapan
 * @param {Date} now - Waktu saat di-clear
 * @returns {Promise<number | null>} Jumlah baris yang diupdate
 */
export const clearConversationHistory = async (
  userId: string,
  conversationId: string,
  now: Date,
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `UPDATE conversation_participants
     SET last_cleared_at = $3
     WHERE user_id = $1 AND conversation_id = $2 AND deleted_at IS NULL`,
    [userId, conversationId, now],
  );

  return res.rowCount;
};

/**
 * Hard delete grup secara atomic dalam satu database transaction.
 * Menghapus semua pesan, participant, dan conversation sekaligus.
 * Jika salah satu langkah gagal, seluruh operasi di-rollback.
 *
 * @param {string} conversationId - ID conversation grup yang akan dihapus
 * @returns {Promise<void>}
 */
export async function hardDeleteGroup(conversationId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`DELETE FROM messages WHERE conversation_id = $1`, [conversationId]);

    await client.query(`DELETE FROM conversation_participants WHERE conversation_id = $1`, [
      conversationId,
    ]);

    await client.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
