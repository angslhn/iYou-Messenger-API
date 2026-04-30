import { getPool } from '@/lib/pg.js';

import type { StoryData } from '@/@types/globals.js';

export type StoryItem = {
  id: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  content_text: string | null;
  bg_color: string | null;
  is_seen: boolean;
  created_at: Date;
};

export type StoryGroup = {
  user_id: string;
  username: string;
  fullname: string | null;
  avatar_url: string | null;
  stories: StoryItem[];
};

export type StoryViewerData = {
  id: string;
  username: string;
  fullname: string | null;
  avatar_url: string | null;
  viewed_at: Date;
};

/**
 * Menyimpan data story (status) baru ke database.
 *
 * @param {Pick<StoryData, 'id' | 'user_id' | 'media_public_id' |'media_url' | 'media_type' | 'content_text' | 'bg_color' | 'expires_at'>} data - Data story baru
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diinsert, null jika gagal
 */
export const create = async (
  data: Pick<
    StoryData,
    | 'id'
    | 'user_id'
    | 'media_public_id'
    | 'media_url'
    | 'media_type'
    | 'content_text'
    | 'bg_color'
    | 'expires_at'
  >,
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO stories (id, user_id, media_public_id, media_url, media_type, content_text, bg_color, expires_at) 
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      data.id,
      data.user_id,
      data.media_public_id,
      data.media_url,
      data.media_type,
      data.content_text,
      data.bg_color,
      data.expires_at,
    ],
  );

  return res.rowCount;
};

/**
 * Mengambil daftar story yang masih aktif (belum 24 jam).
 * Menampilkan story milik pengguna sendiri DAN story milik teman
 * yang status pertemanannya sudah 'accepted'.
 *
 * @param {string} userId - ID pengguna yang meminta feed
 * @returns {Promise<StoryGroup[]>} Daftar story yang sudah dikelompokkan
 */
export const findActiveFeed = async (userId: string): Promise<StoryGroup[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT 
       s.id as story_id, 
       s.media_url, 
       s.media_type, 
       s.content_text, 
       s.bg_color, 
       s.created_at,
       u.id as user_id, 
       u.username, 
       u.fullname, 
       u.avatar_url,
       CASE WHEN v.viewer_id IS NOT NULL THEN true ELSE false END as is_seen
     FROM stories s
     JOIN users u ON s.user_id = u.id
     LEFT JOIN story_views v ON s.id = v.story_id AND v.viewer_id = $1
     WHERE (
       s.user_id = $1 OR 
       s.user_id IN (
         -- Subquery mencari ID teman yang sudah 'accepted'
         SELECT CASE 
           WHEN requester_id = $1 THEN receiver_id 
           ELSE requester_id 
         END
         FROM friendships
         WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted'
       )
     )
     AND s.expires_at > NOW()
     ORDER BY s.created_at ASC`,
    [userId],
  );

  const groupedObj: Record<string, StoryGroup> = {};

  res.rows.forEach((row) => {
    if (!groupedObj[row.user_id]) {
      groupedObj[row.user_id] = {
        user_id: row.user_id,
        username: row.username,
        fullname: row.fullname,
        avatar_url: row.avatar_url,
        stories: [],
      };
    }

    groupedObj[row.user_id]?.stories.push({
      id: row.story_id,
      media_url: row.media_url,
      media_type: row.media_type,
      content_text: row.content_text,
      bg_color: row.bg_color,
      created_at: row.created_at,
      is_seen: row.is_seen,
    });
  });

  // Pisahkan My Story ke urutan pertama
  const allGroups = Object.values(groupedObj);
  return allGroups.sort((a, b) => {
    if (a.user_id === userId) return -1;
    if (b.user_id === userId) return 1;
    return 0;
  });
};

/**
 * Mencari story berdasarkan ID uniknya.
 *
 * @param {string} id - ID story
 * @returns {Promise<StoryData | undefined>} Data story jika ditemukan
 */
export const findById = async (id: string): Promise<StoryData | undefined> => {
  const pool = getPool();

  const res = await pool.query(`SELECT * FROM stories WHERE id = $1`, [id]);

  return res.rows[0];
};

/**
 * Menyimpan atau mengabaikan (UPSERT) rekam jejak pengguna yang melihat story.
 * Memastikan bahwa satu pengguna hanya dihitung satu kali (1 view) per story.
 *
 * @param {string} id - ID unik untuk tabel story_views
 * @param {string} storyId - ID story yang dilihat
 * @param {string} viewerId - ID pengguna yang melihat story
 * @returns {Promise<void>}
 */
export const viewStory = async (id: string, storyId: string, viewerId: string): Promise<void> => {
  const pool = getPool();

  await pool.query(
    `INSERT INTO story_views (id, story_id, viewer_id) 
     VALUES ($1, $2, $3)
     ON CONFLICT (story_id, viewer_id) DO NOTHING`,
    [id, storyId, viewerId],
  );
};

/**
 * Mengambil daftar pengguna yang telah melihat sebuah story.
 * HANYA menampilkan pengguna yang mengatur story_receipt = true.
 *
 * @param {string} storyId - ID Story
 * @returns {Promise<StoryViewerData[]>}
 */
export const getViewers = async (storyId: string): Promise<StoryViewerData[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT 
       u.id, 
       u.username, 
       u.fullname, 
       u.avatar_url, 
       v.created_at as viewed_at
     FROM story_views v
     JOIN users u ON v.viewer_id = u.id
     WHERE v.story_id = $1 
     AND u.story_receipt = true
     ORDER BY v.created_at DESC`,
    [storyId],
  );

  return res.rows;
};

/**
 * Mengambil semua story yang sudah kedaluwarsa.
 * Digunakan oleh cron job untuk cleanup berkala.
 *
 * @returns {Promise<Pick<StoryData, 'id' | 'media_public_id'>[]>}
 */
export const findExpired = async (): Promise<Pick<StoryData, 'id' | 'media_public_id'>[]> => {
  const pool = getPool();

  const res = await pool.query(`SELECT id, media_public_id FROM stories WHERE expires_at <= NOW()`);

  return res.rows;
};

/**
 * Menghapus semua story yang sudah kedaluwarsa secara hard delete.
 *
 * @returns {Promise<number | null>}
 */
export const deleteExpired = async (): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`DELETE FROM stories WHERE expires_at <= NOW()`);

  return res.rowCount;
};
