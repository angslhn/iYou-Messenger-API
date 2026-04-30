import { getPool } from '@/lib/pg.js';

import type { FriendshipData } from '@/@types/globals.js';

/**
 * Data profil pengguna yang digabungkan dengan ID pertemanan.
 * Digunakan sebagai return type untuk query JOIN pertemanan.
 */
export type FriendProfileData = {
  friendship_id: string;
  id: string;
  username: string;
  fullname: string | null;
  avatar_url: string | null;
  about: string | null;
  is_online?: boolean;
  last_seen?: Date | null;
  show_last_seen?: boolean;
};

/**
 * Mencari relasi pertemanan berdasarkan ID.
 * Digunakan untuk accept, reject, unfriend, block, dan unblock.
 *
 * @param {string} id - ID friendship
 * @returns {Promise<FriendshipData | undefined>} Data friendship jika ditemukan
 */
export const findById = async (id: string): Promise<FriendshipData | undefined> => {
  const pool = getPool();

  const res = await pool.query(`SELECT * FROM friendships WHERE id = $1`, [id]);

  return res.rows[0];
};

/**
 * Mencari relasi pertemanan antara dua pengguna.
 * Mengecek kedua arah (A→B atau B→A) karena friendship bisa dimulai dari siapa saja.
 *
 * @param {string} userIdA - ID pengguna pertama
 * @param {string} userIdB - ID pengguna kedua
 * @returns {Promise<FriendshipData | undefined>} Data friendship jika ditemukan
 */
export const findByUsers = async (
  userIdA: string,
  userIdB: string,
): Promise<FriendshipData | undefined> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT * FROM friendships 
     WHERE (requester_id = $1 AND receiver_id = $2)
     OR (requester_id = $2 AND receiver_id = $1)
     LIMIT 1`,
    [userIdA, userIdB],
  );

  return res.rows[0];
};

/**
 * Mengambil semua relasi pertemanan yang sudah accepted milik seorang pengguna.
 * Menggunakan JOIN dengan CASE untuk mengambil profil teman yang relevan.
 * Digunakan untuk notifikasi online/offline ke semua teman via WebSocket.
 *
 * @param {string} userId - ID pengguna
 * @returns {Promise<FriendProfileData[]>} Daftar profil teman yang sudah accepted
 */
export const findAcceptedFriends = async (userId: string): Promise<FriendProfileData[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT 
       f.id AS friendship_id, 
       u.id, u.username, u.fullname, u.avatar_url, u.about, 
       u.is_online, u.last_seen, u.show_last_seen
     FROM friendships f
     JOIN users u ON u.id = CASE 
       WHEN f.requester_id = $1 THEN f.receiver_id 
       ELSE f.requester_id 
     END
     WHERE (f.requester_id = $1 OR f.receiver_id = $1)
       AND f.status = 'accepted'
       AND u.deleted_at IS NULL`,
    [userId],
  );

  return res.rows;
};

/**
 * Mengambil semua permintaan pertemanan yang masuk (pending) untuk seorang pengguna.
 * Memanfaatkan JOIN untuk mengambil data profil requester.
 * Digunakan untuk menampilkan daftar friend request di FE.
 *
 * @param {string} userId - ID pengguna penerima (receiver)
 * @returns {Promise<FriendProfileData[]>} Daftar profil user yang mengirim request
 */
export const findPendingRequests = async (userId: string): Promise<FriendProfileData[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT 
       f.id AS friendship_id, 
       u.id, u.username, u.fullname, u.avatar_url, u.about
     FROM friendships f
     JOIN users u ON f.requester_id = u.id
     WHERE f.receiver_id = $1 
       AND f.status = 'pending' 
       AND u.deleted_at IS NULL`,
    [userId],
  );

  return res.rows;
};

/**
 * Mengambil jumlah permintaan pertemanan yang masuk (pending) untuk seorang pengguna.
 *
 * @param {string} userId - ID pengguna penerima (receiver)
 * @returns {Promise<number>} Jumlah permintaan
 */
export const countPendingRequests = async (userId: string): Promise<number> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT COUNT(id) AS count FROM friendships WHERE receiver_id = $1 AND status = 'pending'`,
    [userId],
  );

  return parseInt(res.rows[0]?.count ?? '0');
};

/**
 * Mengambil semua daftar pengguna yang diblokir oleh user saat ini.
 * Memanfaatkan JOIN untuk langsung mengambil data profil target dalam satu query.
 * * @param {string} userId - ID pengguna yang melakukan blokir (requester)
 * @returns {Promise<FriendProfileData[]>} Daftar profil user yang diblokir
 */
export const findBlockedUsers = async (userId: string): Promise<FriendProfileData[]> => {
  const pool = getPool();

  const res = await pool.query(
    `SELECT 
       f.id AS friendship_id, 
       u.id, u.username, u.fullname, u.avatar_url, u.about 
     FROM friendships f
     JOIN users u ON f.receiver_id = u.id
     WHERE f.requester_id = $1 
       AND f.status = 'blocked' 
       AND u.deleted_at IS NULL`,
    [userId],
  );

  return res.rows;
};

/**
 * Menyimpan relasi pertemanan baru ke database.
 *
 * @param {Pick<FriendshipData, 'id' | 'requester_id' | 'receiver_id' | 'method'>} data - Data friendship baru
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diinsert, null jika gagal
 */
export const create = async (
  data: Pick<FriendshipData, 'id' | 'requester_id' | 'receiver_id' | 'method'> & {
    status?: FriendshipData['status'];
  },
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO friendships (id, requester_id, receiver_id, method, status) 
     VALUES ($1, $2, $3, $4, $5)`,
    [data.id, data.requester_id, data.receiver_id, data.method, data.status ?? 'pending'],
  );

  return res.rowCount;
};

/**
 * Menghapus relasi lama dan membuat relasi baru dengan status tertentu dalam satu transaksi logis.
 * Digunakan khusus untuk blockUser saat perlu flip arah requester.
 *
 * @param {string} oldId - ID friendship lama yang akan dihapus
 * @param {Pick<FriendshipData, 'id' | 'requester_id' | 'receiver_id' | 'method'> & { status: FriendshipData['status'] }} data
 * @returns {Promise<number | null>}
 */
export const replaceWithStatus = async (
  oldId: string,
  data: Pick<FriendshipData, 'id' | 'requester_id' | 'receiver_id' | 'method'> & {
    status: FriendshipData['status'];
  },
): Promise<number | null> => {
  const pool = getPool();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`DELETE FROM friendships WHERE id = $1`, [oldId]);

    const res = await client.query(
      `INSERT INTO friendships (id, requester_id, receiver_id, method, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [data.id, data.requester_id, data.receiver_id, data.method, data.status],
    );

    await client.query('COMMIT');

    return res.rowCount;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Memperbarui status relasi pertemanan berdasarkan ID.
 * Digunakan untuk accept, reject, atau block pertemanan.
 *
 * @param {string} id - ID friendship yang akan diupdate
 * @param {FriendshipData['status']} status - Status baru friendship
 * @returns {Promise<number | null>} Jumlah baris yang berhasil diupdate, null jika gagal
 */
export const updateStatus = async (
  id: string,
  status: FriendshipData['status'],
): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`UPDATE friendships SET status = $1 WHERE id = $2`, [status, id]);

  return res.rowCount;
};

/**
 * Menghapus relasi pertemanan berdasarkan ID.
 * Hard delete karena tidak ada soft delete untuk friendship.
 * Digunakan untuk unfriend dan unblock.
 *
 * @param {string} id - ID friendship yang akan dihapus
 * @returns {Promise<number | null>} Jumlah baris yang berhasil dihapus, null jika gagal
 */
export const remove = async (id: string): Promise<number | null> => {
  const pool = getPool();

  const res = await pool.query(`DELETE FROM friendships WHERE id = $1`, [id]);

  return res.rowCount;
};
