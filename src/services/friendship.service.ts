import ResponseError from '@/utils/response-error.js';

import * as Generator from '@/helpers/generator.js';
import * as User from '@/models/user.model.js';
import * as Friendship from '@/models/friendship.model.js';
import * as Conversation from '@/models/conversation.model.js';
import * as WsSender from '@/websocket/sender.ws.js';

import type { UserData } from '@/@types/globals.js';
import { getPool } from '@/lib/pg.js';

/**
 * Mengirim permintaan pertemanan ke user lain via username atau phone.
 * Cek blocked dulu sebelum apapun, lalu cek duplikat dan status existing friendship.
 * Setelah berhasil disimpan di DB, kirim notifikasi real-time ke penerima.
 *
 * @param {string} requesterId - ID pengguna yang mengirim request
 * @param {string} identifier - Username atau nomor telepon penerima
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - User tidak ditemukan
 * @throws {ResponseError} 400 - Tidak boleh kirim request ke diri sendiri
 * @throws {ResponseError} 403 - Salah satu pihak memblokir yang lain
 * @throws {ResponseError} 409 - Sudah berteman atau sudah ada request pending
 */
export const sendRequest = async (requesterId: string, identifier: string): Promise<void> => {
  let receiver: UserData | undefined;

  // Identifikasi target berdasarkan awalan input (+ untuk telepon, sisanya username)
  if (identifier.startsWith('+')) {
    receiver = await User.findByPhone(identifier);
  } else {
    receiver = await User.findByUsername(identifier);
  }

  // Validasi ketersediaan akun target
  if (!receiver || receiver.deleted_at) {
    throw new ResponseError(
      404,
      'Account Unavailable',
      'We could not find an account associated with those details.',
    );
  }

  // Mencegah kirim request ke diri sendiri
  if (receiver.id === requesterId) {
    throw new ResponseError(
      400,
      'Invalid Request',
      'You cannot send a friend request to yourself.',
    );
  }

  const existing = await Friendship.findByUsers(requesterId, receiver.id);

  // Evaluasi relasi yang sudah ada (jika ada)
  if (existing) {
    if (existing.status === 'blocked')
      throw new ResponseError(
        403,
        'Action Not Allowed',
        'You cannot send a friend request to this user.',
      );
    if (existing.status === 'accepted')
      throw new ResponseError(409, 'Already Friends', 'You are already friends with this user.');
    if (existing.status === 'pending')
      throw new ResponseError(
        409,
        'Request Already Sent',
        'A friend request has already been sent.',
      );
    if (existing.status === 'rejected')
      throw new ResponseError(
        403,
        'Request Not Delivered',
        'This user is currently not accepting new friend requests.',
      );
    return;
  }

  try {
    const friendshipId = Generator.id();

    // Simpan relasi baru ke database
    await Friendship.create({
      id: friendshipId,
      requester_id: requesterId,
      receiver_id: receiver.id,
      method: 'request',
    });

    // Ambil data pengirim untuk keperluan notifikasi UI penerima
    const requester = await User.findById(requesterId);

    // Broadcast event ke penerima secara Real-Time
    if (requester) {
      WsSender.sendToUser(receiver.id, {
        event: 'friend:request_received',
        payload: {
          friendshipId,
          requesterId,
          requesterUsername: requester.username,
          requesterFullname: requester.fullname || null,
          requesterAvatarUrl: requester.avatar_url || null,
        },
      });
    }
  } catch (error: any) {
    if (error.code === '23505')
      throw new ResponseError(
        409,
        'Already Processed',
        'A friend request is already being processed.',
      );
    // Lempar error lain (misal koneksi putus) ke error handler utama
    throw error;
  }
};

/**
 * Menambahkan teman via PIN — langsung accepted tanpa perlu konfirmasi.
 * Tetap cek blocked sebelum proses. Kirim notifikasi real-time ke penerima PIN.
 *
 * @param {string} requesterId - ID pengguna yang menambahkan
 * @param {string} pin - PIN unik target user
 * @returns {Promise<void>}
 * @throws {ResponseError} 404/400/403/409 - Validasi standar
 */
export const addFriendByPin = async (requesterId: string, pin: string): Promise<void> => {
  const receiver = await User.findByPin(pin);

  // Memvalidasi ketersediaan pengguna berdasarkan PIN unik
  if (!receiver || receiver.deleted_at) {
    throw new ResponseError(
      404,
      'Account Unavailable',
      'No active account is associated with this PIN.',
    );
  }

  // Mencegah pengguna menambahkan dirinya sendiri
  if (receiver.id === requesterId) {
    throw new ResponseError(400, 'Invalid Request', 'You cannot add yourself as a friend.');
  }

  const existing = await Friendship.findByUsers(requesterId, receiver.id);

  let friendshipId = existing?.id || Generator.id();

  // Validasi di luar transaksi agar lebih cepat ditolak jika gagal
  if (existing) {
    if (existing.status === 'blocked')
      throw new ResponseError(403, 'Action Not Allowed', 'You cannot add this user.');
    if (existing.status === 'accepted')
      throw new ResponseError(409, 'Already Friends', 'You are already friends with this user.');
  }

  // --- Mulai Transaction ---
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (existing) {
      // Update status jadi accepted
      await client.query(
        `UPDATE friendships SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [friendshipId],
      );
    } else {
      // Buat pertemanan baru
      await client.query(
        `INSERT INTO friendships (id, requester_id, receiver_id, method, status) 
         VALUES ($1, $2, $3, 'pin', 'accepted')`,
        [friendshipId, requesterId, receiver.id],
      );
    }

    // Hanguskan PIN
    await client.query(`UPDATE users SET pin = NULL, updated_at = NOW() WHERE id = $1`, [
      receiver.id,
    ]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error; // Wajib dilempar agar broadcast WebSocket di bawah tidak dieksekusi
  } finally {
    client.release();
  }

  // Broadcast WebSocket (Tetap sama seperti sebelumnya)
  const requester = await User.findById(requesterId);

  // Broadcast ke keduanya
  if (requester && receiver) {
    // 1. Broadcast ke penerima (B) bahwa dia mendapat teman baru via PIN
    WsSender.sendToUser(receiver.id, {
      event: 'friend:new_friend',
      payload: {
        friendshipId,
        friendId: requester.id,
        friendUsername: requester.username,
        friendFullname: requester.fullname,
        friendAvatarUrl: requester.avatar_url,
      },
    });

    // 2. Broadcast ke PENGIRIM (A) agar layar "My Friends"-nya langsung bertambah
    WsSender.sendToUser(requesterId, {
      event: 'friend:new_friend',
      payload: {
        friendshipId,
        friendId: receiver.id,
        friendUsername: receiver.username,
        friendFullname: receiver.fullname,
        friendAvatarUrl: receiver.avatar_url,
      },
    });
  }
};

/**
 * Menerima permintaan pertemanan.
 * Hanya receiver yang boleh accept. Setelah di-accept, kirim notif ke requester.
 *
 * @param {string} userId - ID pengguna yang menerima (harus receiver)
 * @param {string} friendshipId - ID friendship yang akan di-accept
 * @returns {Promise<void>}
 * @throws {ResponseError} 404/403/400 - Validasi standar
 */
export const acceptRequest = async (userId: string, friendshipId: string): Promise<void> => {
  const friendship = await Friendship.findById(friendshipId);

  if (!friendship)
    throw new ResponseError(404, 'Friend Request Unavailable', 'Friend request not found.');

  if (friendship.receiver_id !== userId)
    throw new ResponseError(403, 'Action Not Allowed', 'Not authorized.');

  if (friendship.status !== 'pending')
    throw new ResponseError(400, 'Invalid Request Status', 'No longer pending.');

  // Update status di database menjadi accepted
  await Friendship.updateStatus(friendshipId, 'accepted');

  // Ambil profil user yang meng-accept (B) dan yang mengirim request (A)
  const receiver = await User.findById(userId); // B
  const requester = await User.findById(friendship.requester_id); // A

  if (receiver && requester) {
    // 1. Beritahu pengirim asli (A) bahwa permintaannya telah diterima
    WsSender.sendToUser(friendship.requester_id, {
      event: 'friend:request_accepted',
      payload: {
        friendshipId,
        receiverId: receiver.id,
        receiverUsername: receiver.username,
        receiverFullname: receiver.fullname,
      },
    });

    // 2. Beritahu pengirim asli (A) untuk memasukkan (B) ke list temannya
    WsSender.sendToUser(friendship.requester_id, {
      event: 'friend:new_friend',
      payload: {
        friendshipId,
        friendId: receiver.id,
        friendUsername: receiver.username,
        friendFullname: receiver.fullname,
        friendAvatarUrl: receiver.avatar_url,
      },
    });

    // 3. Beritahu penerima (B) untuk memasukkan (A) ke list temannya
    WsSender.sendToUser(userId, {
      event: 'friend:new_friend',
      payload: {
        friendshipId,
        friendId: requester.id,
        friendUsername: requester.username,
        friendFullname: requester.fullname,
        friendAvatarUrl: requester.avatar_url,
      },
    });
  }
};

/**
 * Menolak permintaan pertemanan.
 * Hanya receiver yang boleh reject.
 *
 * @param {string} userId - ID pengguna yang menolak (harus receiver)
 * @param {string} friendshipId - ID friendship yang akan di-reject
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Friendship tidak ditemukan
 * @throws {ResponseError} 403 - User bukan receiver dari request ini
 * @throws {ResponseError} 400 - Status bukan pending
 */
export const rejectRequest = async (userId: string, friendshipId: string): Promise<void> => {
  const friendship = await Friendship.findById(friendshipId);

  // Memastikan ID relasi pertemanan valid dan ada di database
  if (!friendship) {
    throw new ResponseError(
      404,
      'Friend Request Unavailable',
      'The friend request you are trying to reject could not be found.',
    );
  }

  // Validasi Otorisasi: Hanya pengguna yang menjadi target (receiver) yang berhak menolak permintaan
  if (friendship.receiver_id !== userId) {
    throw new ResponseError(
      403,
      'Action Not Allowed',
      'You are not authorized to reject this friend request.',
    );
  }

  // Memastikan bahwa permintaan tersebut belum direspons sebelumnya (harus berstatus pending)
  if (friendship.status !== 'pending') {
    throw new ResponseError(
      400,
      'Invalid Request Status',
      'This friend request cannot be rejected because it is no longer pending.',
    );
  }

  await Friendship.updateStatus(friendshipId, 'rejected');
};

/**
 * Menghapus pertemanan (unfriend).
 * Kedua pihak boleh unfriend — cek apakah userId terlibat di friendship ini.
 *
 * @param {string} userId - ID pengguna yang ingin unfriend
 * @param {string} friendshipId - ID friendship yang akan dihapus
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Friendship tidak ditemukan
 * @throws {ResponseError} 403 - User tidak terlibat di friendship ini
 * @throws {ResponseError} 400 - Status bukan accepted
 */
export const unfriend = async (userId: string, friendshipId: string): Promise<void> => {
  const friendship = await Friendship.findById(friendshipId);

  // Memastikan ID relasi pertemanan valid dan eksis
  if (!friendship) {
    throw new ResponseError(
      404,
      'Friendship Unavailable',
      'The friendship you are trying to remove could not be found.',
    );
  }

  // Validasi Kepemilikan: Memastikan bahwa pengguna yang mencoba melakukan aksi 'unfriend'
  // adalah salah satu pihak (entah requester atau receiver) dalam relasi tersebut.
  const isInvolved = friendship.requester_id === userId || friendship.receiver_id === userId;

  if (!isInvolved) {
    throw new ResponseError(
      403,
      'Action Not Allowed',
      'You are not authorized to remove this friendship.',
    );
  }

  // Memastikan bahwa aksi pemutusan pertemanan hanya bisa dilakukan jika status saat ini adalah 'accepted'
  if (friendship.status !== 'accepted') {
    throw new ResponseError(
      400,
      'Invalid Friendship Status',
      'You can only unfriend someone you are currently friends with.',
    );
  }

  // Melakukan hard delete pada relasi pertemanan sehingga kedua pihak kembali menjadi orang asing
  await Friendship.remove(friendshipId);
};

/**
 * Memblokir user lain.
 * Kedua pihak boleh block — jika ada relasi sebelumnya (pending/accepted/rejected),
 * status diupdate jadi blocked. Jika belum ada relasi, buat baru dengan status blocked.
 * Blocker selalu jadi requester agar arah blokir jelas.
 *
 * @param {string} blockerId - ID pengguna yang memblokir
 * @param {string} targetUserId - ID pengguna yang diblokir
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Target user tidak ditemukan
 * @throws {ResponseError} 400 - Tidak boleh blokir diri sendiri
 * @throws {ResponseError} 409 - Sudah diblokir sebelumnya
 */
export const blockUser = async (blockerId: string, targetUserId: string): Promise<void> => {
  const target = await User.findById(targetUserId);

  // Memastikan pengguna yang akan diblokir benar-benar eksis dan tidak dalam keadaan terhapus
  if (!target || target.deleted_at) {
    throw new ResponseError(
      404,
      'Action Failed',
      'We were unable to process your request as the target account could not be found or has been deactivated.',
    );
  }

  // Mencegah pengguna secara tidak sengaja memblokir dirinya sendiri
  if (target.id === blockerId) {
    throw new ResponseError(400, 'Invalid Request', 'You cannot block yourself.');
  }

  const existing = await Friendship.findByUsers(blockerId, targetUserId);

  // Menangani transisi status blokir jika sebelumnya sudah ada interaksi (relasi)
  if (existing) {
    // Mencegah eksekusi berulang jika target sudah dalam status diblokir
    if (existing.status === 'blocked') {
      throw new ResponseError(409, 'User Already Blocked', 'You have already blocked this user.');
    }

    if (existing.requester_id !== blockerId) {
      // Flip arah: hapus lama + insert baru dengan status blocked dalam 1 transaksi
      await Friendship.replaceWithStatus(existing.id, {
        id: Generator.id(),
        requester_id: blockerId,
        receiver_id: targetUserId,
        method: 'request',
        status: 'blocked',
      });

      return;
    }

    // Blocker sudah jadi requester, cukup update status
    await Friendship.updateStatus(existing.id, 'blocked');

    // Tutup private conversation jika ada
    const privateConv = await Conversation.findPrivateByUsers(blockerId, targetUserId);

    if (privateConv) {
      const now = new Date();
      await Conversation.softDeleteParticipant(blockerId, privateConv.id, now);
      await Conversation.softDeleteParticipant(targetUserId, privateConv.id, now);
    }

    return;
  }

  // Belum ada relasi sama sekali — langsung create dengan status blocked
  await Friendship.create({
    id: Generator.id(),
    requester_id: blockerId,
    receiver_id: targetUserId,
    method: 'request',
    status: 'blocked',
  });

  // Tutup private conversation jika ada
  const privateConv = await Conversation.findPrivateByUsers(blockerId, targetUserId);

  if (privateConv) {
    const now = new Date();
    await Conversation.softDeleteParticipant(blockerId, privateConv.id, now);
    await Conversation.softDeleteParticipant(targetUserId, privateConv.id, now);
  }
};

/**
 * Membuka blokir user.
 * Hanya blocker yang bisa unblock — dicek dari requester_id saat status blocked.
 * Setelah unblock, relasi dihapus sepenuhnya (hard delete) agar bisa mulai fresh.
 *
 * @param {string} userId - ID pengguna yang ingin unblock
 * @param {string} friendshipId - ID friendship dengan status blocked
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Friendship tidak ditemukan
 * @throws {ResponseError} 400 - Status bukan blocked
 * @throws {ResponseError} 403 - User bukan yang memblokir
 */
export const unblockUser = async (userId: string, friendshipId: string): Promise<void> => {
  const friendship = await Friendship.findById(friendshipId);

  // Memastikan bahwa data relasi blokir memang terdaftar di database
  if (!friendship) {
    throw new ResponseError(
      404,
      'Blocked Relation Unavailable',
      'The blocked relation you are trying to remove could not be found.',
    );
  }

  // Memastikan aksi unblock hanya diterapkan pada relasi yang saat ini berstatus 'blocked'
  if (friendship.status !== 'blocked') {
    throw new ResponseError(400, 'Invalid Status', 'This relation is not blocked.');
  }

  // Validasi Hak Akses Kritis: Hanya pengguna yang mengambil inisiatif untuk memblokir
  // (tercatat sebagai requester_id) yang diberikan izin sistem untuk membuka blokir.
  if (friendship.requester_id !== userId) {
    throw new ResponseError(
      403,
      'Action Not Allowed',
      'You are not authorized to unblock this user.',
    );
  }

  // Melakukan hard delete agar setelah di-unblock, kedua pihak tidak memiliki sisa state (mulai dari awal)
  await Friendship.remove(friendshipId);
};

/**
 * Mengambil semua teman yang sudah accepted milik user.
 * Mengembalikan data profil teman beserta ID pertemanan.
 *
 * @param {string} userId - ID pengguna
 * @returns {Promise<(Pick<UserData, 'id' | 'avatar_url' | 'username' | 'fullname' | 'about' | 'is_online' | 'last_seen'> & { friendshipId: string })[]>}
 */
export const getFriends = async (
  userId: string,
): Promise<
  {
    friendshipId: string;
    user: Pick<
      UserData,
      'id' | 'avatar_url' | 'username' | 'fullname' | 'about' | 'is_online' | 'last_seen'
    >;
  }[]
> => {
  const friends = await Friendship.findAcceptedFriends(userId);

  if (friends.length === 0) return [];

  return friends.map(
    ({
      friendship_id,
      id,
      avatar_url,
      username,
      fullname,
      about,
      is_online,
      last_seen,
      show_last_seen,
    }) => ({
      friendshipId: friendship_id,
      user: {
        id,
        avatar_url,
        username,
        fullname,
        about,
        is_online: is_online ?? false,
        last_seen: show_last_seen ? (last_seen ?? null) : null,
      },
    }),
  );
};

/**
 * Mengambil semua permintaan pertemanan yang masuk dan belum direspons.
 * Mengembalikan data profil pengirim beserta friendship ID untuk action accept/reject.
 *
 * @param {string} userId - ID pengguna penerima
 * @returns {Promise<{ friendshipId: string; user: Pick<UserData, 'id' | 'avatar_url' | 'username' | 'fullname' | 'about'> }[]>}
 */
export const getPendingRequests = async (
  userId: string,
): Promise<
  {
    friendshipId: string;
    user: Pick<UserData, 'id' | 'avatar_url' | 'username' | 'fullname' | 'about'>;
  }[]
> => {
  // Langsung mendapatkan data gabungan (Profile + Friendship ID)
  const requests = await Friendship.findPendingRequests(userId);

  if (requests.length === 0) return [];

  // Tidak perlu Map dan findByIds lagi, cukup return datanya
  return requests.map((req) => ({
    friendshipId: req.friendship_id,
    user: {
      id: req.id,
      avatar_url: req.avatar_url,
      username: req.username,
      fullname: req.fullname,
      about: req.about,
    },
  }));
};

/**
 * Mengambil daftar pengguna yang diblokir oleh user saat ini.
 * Mengembalikan data profil target beserta friendship ID untuk action unblock.
 *
 * @param {string} userId - ID pengguna yang melakukan blokir (blocker)
 * @returns {Promise<{ friendshipId: string; user: Pick<UserData, 'id' | 'avatar_url' | 'username' | 'fullname' | 'about'> }[]>}
 */
export const getBlockedUsers = async (
  userId: string,
): Promise<
  {
    friendshipId: string;
    user: Pick<UserData, 'id' | 'avatar_url' | 'username' | 'fullname' | 'about'>;
  }[]
> => {
  // Langsung mendapatkan data gabungan target yang diblokir
  const blockedList = await Friendship.findBlockedUsers(userId);

  if (blockedList.length === 0) return [];

  return blockedList.map((b) => ({
    friendshipId: b.friendship_id,
    user: {
      id: b.id,
      avatar_url: b.avatar_url,
      username: b.username,
      fullname: b.fullname,
      about: b.about,
    },
  }));
};
