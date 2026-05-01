import { v2 as cloudinary } from 'cloudinary';
import { getPool } from '@/lib/pg.js';
import ResponseError from '@/utils/response-error.js';

import * as User from '@/models/user.model.js';
import * as WsSender from '@/websocket/sender.ws.js';
import * as Message from '@/models/message.model.js';
import * as Conversation from '@/models/conversation.model.js';
import * as Generator from '@/helpers/generator.js';

import type {
  ConversationData,
  ConversationParticipantData,
  MessageData,
} from '@/@types/globals.js';

/**
 * Mengambil semua percakapan aktif milik pengguna.
 * Percakapan yang sudah di-soft-delete (deleted_at IS NOT NULL) tidak akan dimunculkan.
 *
 * @param {string} userId - ID pengguna
 * @returns {Promise<ReturnType<typeof Conversation.findAllActiveByUser>>} Daftar percakapan
 */
export const getConversations = async (
  userId: string,
  type: 'private' | 'group',
  is_archived: boolean,
): Promise<
  (ConversationData & {
    participant_id: string;
    role: ConversationParticipantData['role'];
    is_pinned: boolean;
    is_archived: boolean;
    is_muted: boolean;
    last_cleared_at: Date | null;
  })[]
> => {
  return await Conversation.findAllActiveByUser(userId, type, is_archived);
};

/**
 * Mengambil riwayat pesan dari sebuah percakapan.
 * Jika pengguna mencoba mengakses percakapan yang dia tidak ikuti,
 * kita kembalikan array kosong (silent fail) daripada memberikan error eksplisit,
 * untuk menyamarkan state keberadaan grup/chat tersebut dari pihak luar.
 *
 * @param {string} userId - ID pengguna
 * @param {string} conversationId - ID percakapan
 * @param {number} limit - Jumlah pesan
 * @param {number} offset - Offset pagination
 * @returns {Promise<MessageData[]>} Daftar pesan diurutkan dari terlama ke terbaru
 */
export const getMessages = async (
  userId: string,
  conversationId: string,
  limit: number,
  offset: number,
): Promise<MessageData[]> => {
  const participant = await Conversation.findParticipant(userId, conversationId);

  // Silent fail jika bukan anggota (agar eksistensi grup tidak bocor)
  if (!participant) {
    return [];
  }

  // Silent fail jika chat sudah di-clear / dihapus user
  // (Agar UI Frontend tetap bisa merender layar chat yang kosong)
  if (participant.deleted_at !== null) {
    return [];
  }

  const messages = await Message.findByConversationWithClear(
    conversationId,
    participant.last_cleared_at,
    limit,
    offset,
  );

  return messages.reverse();
};

/**
 * Mengambil daftar profil lengkap dari anggota sebuah percakapan.
 * Melakukan validasi untuk memastikan peminta adalah bagian dari grup tersebut.
 * Mengembalikan array kosong jika pengguna bukan anggota (silent fail).
 *
 * @param {string} userId - ID pengguna yang meminta data
 * @param {string} conversationId - ID percakapan/grup
 * @returns {Promise<any[]>} Daftar anggota beserta profilnya
 */
export const getParticipants = async (userId: string, conversationId: string): Promise<any[]> => {
  // Gunakan fungsi yang sudah Anda buat sebelumnya
  const participant = await Conversation.findParticipant(userId, conversationId);

  // Silent fail: Jika bukan member atau sudah keluar/di-kick
  if (!participant || participant.deleted_at !== null) {
    return [];
  }

  // Tarik data profil semua member aktif
  const participantsInfo = await Conversation.findParticipantsInfo(conversationId);

  return participantsInfo;
};

/**
 * Mengambil semua undangan grup yang belum direspons oleh user.
 * @param {string} userId - ID pengguna
 * @returns {Promise<any[]>} Daftar semua undangan group
 */
export const getPendingInvites = async (userId: string): Promise<any[]> => {
  return await Conversation.findPendingInvites(userId);
};

/**
 * Mengirim undangan grup.
 * Mengimplementasikan aturan: Jika pernah ditolak (rejected), admin tidak bisa mengundang lagi selamanya.
 * @param {string} adminId - ID admin pengirim
 * @param {string} conversationId - ID grup
 * @param {string} targetUserId - ID user yang diundang
 * @throws {ResponseError} 403 - Jika user sudah pernah menolak undangan ini
 * @throws {ResponseError} 409 - Jika undangan masih pending
 */
export const sendGroupInvite = async (
  adminId: string,
  conversationId: string,
  targetUserId: string,
): Promise<void> => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== 'group') {
    throw new ResponseError(404, 'Group Not Found', 'The group could not be found.');
  }

  // Validasi hak akses: Hanya admin yang bisa invite
  const adminParticipant = await Conversation.findParticipant(adminId, conversationId);

  if (!adminParticipant || adminParticipant.role !== 'admin') {
    throw new ResponseError(403, 'Access Denied', 'Only group administrators can send invites.');
  }

  // Cek Riwayat Undangan (Anti-Spam & Privacy)
  const history = await Conversation.findInviteHistory(conversationId, targetUserId);

  if (history) {
    if (history.status === 'pending') {
      throw new ResponseError(
        409,
        'Invite Pending',
        'Previous invitations are still awaiting response.',
      );
    }

    if (history.status === 'rejected') {
      throw new ResponseError(
        403,
        'Privacy Block',
        'This user has declined a previous group invitation. Use the PIN to join manually.',
      );
    }

    if (history.status === 'accepted') {
      throw new ResponseError(400, 'Already Member', 'This user is already a member of the group.');
    }
  }

  // Simpan Undangan Baru
  const inviteId = Generator.id();

  // Simpan invite ke database
  await Conversation.createGroupInvite({
    id: inviteId,
    conversation_id: conversationId,
    invited_by: adminId,
    invited_user_id: targetUserId,
  });

  // Ambil data admin untuk nama pengundang di notifikasi
  const inviter = await User.findById(adminId);

  // Broadcast ke target user secara real-time
  if (inviter) {
    WsSender.sendToUser(targetUserId, {
      event: 'group:invite_received',
      payload: {
        inviteId,
        conversationId,
        groupName: conversation.name || 'Unnamed Group',
        inviterUsername: inviter.username,
        inviterFullname: inviter.fullname,
      },
    });
  }
};

/**
 * Menerima undangan grup.
 * Mengubah status invite jadi 'accepted' dan memasukkan user ke conversation_participants.
 *
 * @param {string} userId - ID pengguna yang diundang
 * @param {string} inviteId - ID undangan group
 * @returns {Promise<void>}
 */
export const acceptGroupInvite = async (userId: string, inviteId: string): Promise<void> => {
  const invite = await Conversation.findInviteById(inviteId);

  if (!invite) {
    throw new ResponseError(404, 'Invite Not Found', 'The invitation could not be found.');
  }

  if (invite.invited_user_id !== userId) {
    throw new ResponseError(403, 'Access Denied', 'You are not authorized to accept this invite.');
  }

  if (invite.status !== 'pending') {
    throw new ResponseError(
      400,
      'Invalid Invite',
      'This invitation is no longer valid or has already been responded to.',
    );
  }

  // Cek dulu apakah dia sebelumnya pernah join dan leave (soft delete)
  const existingParticipant = await Conversation.findParticipant(userId, invite.conversation_id);

  if (existingParticipant) {
    await Conversation.resetDeletedAt(invite.conversation_id, userId);
  } else {
    const pool = getPool();

    const client = await pool.connect(); // Ambil client khusus

    try {
      await client.query('BEGIN'); // Mulai transaksi

      // Eksekusi query pertama
      await client.query(`UPDATE conversation_invites SET status = 'accepted' WHERE id = $1`, [
        inviteId,
      ]);

      // Eksekusi query kedua
      await client.query(
        `INSERT INTO conversation_participants (id, user_id, conversation_id, role, status) 
       VALUES ($1, $2, $3, 'member', 'active')`,
        [Generator.id(), userId, invite.conversation_id],
      );

      await client.query('COMMIT'); // Simpan permanen jika semua sukses
    } catch (error) {
      await client.query('ROLLBACK'); // Batalkan semua jika ada 1 yang gagal
      throw error;
    } finally {
      client.release(); // Kembalikan client ke pool
    }
  }

  // Broadcast ke seluruh anggota grup bahwa ada member baru
  // (Kecuali si user baru ini, karena UI-nya akan otomatis terupdate via route /group)
  const allParticipants = await Conversation.findAllParticipants(invite.conversation_id);
  const userIdsToNotify = allParticipants.map((p) => p.user_id).filter((id) => id !== userId); // Jangan kirim ke diri sendiri

  WsSender.sendToMany(userIdsToNotify, {
    event: 'group:member_added',
    payload: {
      conversationId: invite.conversation_id,
      addedBy: userId, // Dianggap gabung sendiri via accept
      newMemberId: userId,
    },
  });
};

/**
 * Menolak undangan grup.
 * Mengubah status invite jadi 'rejected' dan memasukkan user ke conversation_participants.
 * @param {string} userId - ID pengguna
 * @param {string} inviteId - ID undangan group
 * @returns {Promise<void>}
 */
export const rejectGroupInvite = async (userId: string, inviteId: string): Promise<void> => {
  const invite = await Conversation.findInviteById(inviteId);

  if (!invite || invite.invited_user_id !== userId || invite.status !== 'pending') {
    throw new ResponseError(400, 'Invalid Invite', 'This invitation cannot be rejected.');
  }

  await Conversation.updateInviteStatus(inviteId, 'rejected');
};

/**
 * Menangani bergabungnya pengguna kedalam grup dengan menggunakan PIN unik yang diberikan oleh admin.
 *
 * @param {string} userId - ID pengguna
 * @param {string} pin - PIN grup
 * @returns {Promise<void>}
 */
export const joinGroupByPin = async (userId: string, pin: string): Promise<string> => {
  const conversation = await Conversation.findByPin(pin);

  if (!conversation) {
    throw new ResponseError(
      404,
      'Invalid PIN',
      'The group could not be found or the PIN is incorrect.',
    );
  }

  const existingParticipant = await Conversation.findParticipant(userId, conversation.id);

  if (existingParticipant) {
    // Jika pernah keluar (soft deleted), reset saja
    if (existingParticipant.deleted_at !== null) {
      await Conversation.resetDeletedAt(conversation.id, userId);
      return conversation.id;
    }

    throw new ResponseError(409, 'Already Joined', 'You are already a member of this group.');
  }

  // Tambahkan user sebagai member
  await Conversation.addParticipant({
    id: Generator.id(),
    user_id: userId,
    conversation_id: conversation.id,
    role: 'member',
    status: 'active',
  });

  // Broadcast ke member lain
  const allParticipants = await Conversation.findAllParticipants(conversation.id);
  const userIdsToNotify = allParticipants.map((p) => p.user_id).filter((id) => id !== userId);

  WsSender.sendToMany(userIdsToNotify, {
    event: 'group:member_added',
    payload: { conversationId: conversation.id, addedBy: userId, newMemberId: userId },
  });

  return conversation.id;
};

/**
 * Mengubah preferensi sematan (pin) percakapan.
 * Idempotent. Jika chat tidak ditemukan, silent return.
 *
 * @param {string} userId - ID pengguna
 * @param {string} conversationId - ID percakapan
 * @param {boolean} value - True untuk pin, False untuk unpin
 */
export const pinConversation = async (
  userId: string,
  conversationId: string,
  value: boolean,
): Promise<void> => {
  const participant = await Conversation.findParticipant(userId, conversationId);
  if (!participant) return;

  await Conversation.updateParticipant(userId, conversationId, { is_pinned: value });
};

/**
 * Mengubah preferensi arsip (archive) percakapan.
 * Idempotent. Jika chat tidak ditemukan, silent return.
 *
 * @param {string} userId - ID pengguna
 * @param {string} conversationId - ID percakapan
 * @param {boolean} value - True untuk archive, False untuk unarchive
 */
export const archiveConversation = async (
  userId: string,
  conversationId: string,
  value: boolean,
): Promise<void> => {
  const participant = await Conversation.findParticipant(userId, conversationId);
  if (!participant) return;

  await Conversation.updateParticipant(userId, conversationId, { is_archived: value });
};

/**
 * Mengubah preferensi bisu (mute) percakapan.
 * Idempotent. Jika chat tidak ditemukan, silent return.
 *
 * @param {string} userId - ID pengguna
 * @param {string} conversationId - ID percakapan
 * @param {boolean} value - True untuk mute, False untuk unmute
 */
export const muteConversation = async (
  userId: string,
  conversationId: string,
  value: boolean,
): Promise<void> => {
  const participant = await Conversation.findParticipant(userId, conversationId);
  if (!participant) return;

  await Conversation.updateParticipant(userId, conversationId, { is_muted: value });
};

/**
 * Memperbarui foto profil (avatar) grup percakapan yang diintegrasikan dengan Cloudinary.
 * Hanya pengguna dengan role 'admin' di grup tersebut yang diizinkan.
 *
 * @param {string} adminId - ID pengguna yang merequest (harus ber-role admin)
 * @param {string} conversationId - ID percakapan grup
 * @param {Buffer} [fileBuffer] - Buffer file gambar dari Multer (opsional, wajib ada untuk update)
 * @returns {Promise<string>} URL gambar avatar grup yang baru
 * @throws {ResponseError} 404 - Jika grup tidak ditemukan
 * @throws {ResponseError} 403 - Jika pengguna bukan admin grup
 * @throws {ResponseError} 400 - Jika tidak ada gambar yang diunggah
 */
export const updateGroupAvatar = async (
  adminId: string,
  conversationId: string,
  fileBuffer?: Buffer,
): Promise<string> => {
  // Validasi eksistensi grup
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== 'group') {
    throw new ResponseError(404, 'Group Not Found', 'The group could not be found.');
  }

  // Validasi hak akses Admin
  const participant = await Conversation.findParticipant(adminId, conversationId);

  if (!participant || participant.role !== 'admin') {
    throw new ResponseError(
      403,
      'Access Denied',
      'You do not have the necessary privileges. Only group administrators can update the group avatar.',
    );
  }

  // Validasi keberadaan file gambar
  if (!fileBuffer) {
    throw new ResponseError(
      400,
      'No Image Provided',
      'Please upload an image file to update the group avatar.',
    );
  }

  // Upload buffer ke Cloudinary
  const avatarUrl = await new Promise<string>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: 'iyou-messenger/group-avatars',
          public_id: conversationId,
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

  // Update data di Database
  await Conversation.updateGroup(conversationId, { avatar_url: avatarUrl });

  // Broadcast event via WebSocket ke seluruh anggota grup
  // Kita manfaatkan fungsi findGroupInfoWithMembers yang sudah kita buat sebelumnya
  const groupInfo = await Conversation.findGroupInfoWithMembers(conversationId);

  if (groupInfo && groupInfo.members) {
    // Ambil ID semua member (termasuk admin) agar UI mereka otomatis terupdate
    const memberIds = groupInfo.members.map((m: any) => m.id);

    WsSender.sendToMany(memberIds, {
      event: 'group:update_avatar',
      payload: {
        conversationId,
        avatarUrl,
      },
    });
  }

  return avatarUrl;
};

/**
 * Mengambil informasi detail sebuah grup percakapan beserta daftar anggotanya.
 * Termasuk memvalidasi apakah user yang merequest adalah anggota aktif dari grup tersebut.
 * @param {string} userId - ID pengguna yang sedang login (requester)
 * @param {string} conversationId - ID percakapan grup
 * @returns {Promise<any>} Object detail grup yang dilengkapi dengan role dari current user
 * @throws {ResponseError} 404 - Jika grup tidak ditemukan
 * @throws {ResponseError} 403 - Jika pengguna bukan anggota aktif grup tersebut
 */
export const getGroupInfo = async (userId: string, conversationId: string): Promise<any> => {
  const groupInfo = await Conversation.findGroupInfoWithMembers(conversationId);

  // Validasi eksistensi grup
  if (!groupInfo) {
    throw new ResponseError(
      404,
      'Group Not Found',
      'The group could not be found or has been deleted.',
    );
  }

  // Validasi Otorisasi: Pastikan userId yang request ada di dalam array members
  const currentUserParticipant = groupInfo.members.find((m: any) => m.id === userId);

  if (!currentUserParticipant) {
    throw new ResponseError(
      403,
      'Access Denied',
      'You are not authorized to view this group info because you are not a participant.',
    );
  }

  // Inject currentUserRole agar UI Frontend mudah menentukan tombol (contoh: tombol Delete/Kick untuk admin)
  return {
    ...groupInfo,
    currentUserRole: currentUserParticipant.role,
  };
};

/**
 * Memperbarui informasi teks grup (nama dan deskripsi).
 * Hanya pengguna dengan role 'admin' di grup tersebut yang diizinkan.
 *
 * @param {string} adminId - ID pengguna yang merequest (harus ber-role admin)
 * @param {string} conversationId - ID percakapan grup
 * @param {object} data - Data nama dan deskripsi baru
 * @returns {Promise<void>}
 */
export const updateGroupInfo = async (
  adminId: string,
  conversationId: string,
  data: { name?: string; description?: string },
): Promise<void> => {
  // Validasi eksistensi grup
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== 'group') {
    throw new ResponseError(404, 'Group Not Found', 'The group could not be found.');
  }

  // Validasi hak akses Admin
  const participant = await Conversation.findParticipant(adminId, conversationId);

  if (!participant || participant.role !== 'admin') {
    throw new ResponseError(
      403,
      'Access Denied',
      'You do not have the necessary privileges. Only group administrators can update the group info.',
    );
  }

  // Update data di Database (memanggil model yang sudah kita buat sebelumnya)
  await Conversation.updateGroup(conversationId, data);

  // Broadcast event via WebSocket ke seluruh anggota grup
  const groupInfo = await Conversation.findGroupInfoWithMembers(conversationId);

  if (groupInfo && groupInfo.members) {
    const memberIds = groupInfo.members.map((m: any) => m.id);

    WsSender.sendToMany(memberIds, {
      event: 'group:update_info',
      payload: {
        conversationId,
        name: data.name ?? conversation.name,
        description: data.description ?? conversation.description,
      },
    });
  }
};

/**
 * Men-generate PIN baru untuk grup percakapan.
 * Hanya admin grup yang diizinkan untuk melakukan aksi ini.
 * PIN yang dihasilkan dijamin unik di seluruh tabel conversations.
 *
 * @param {string} adminId - ID pengguna yang me-request (harus ber-role admin)
 * @param {string} conversationId - ID percakapan grup
 * @returns {Promise<string>} PIN baru yang berhasil dibuat
 * @throws {ResponseError} 404 - Jika grup tidak ditemukan
 * @throws {ResponseError} 403 - Jika pengguna bukan admin dari grup tersebut
 */
export const generateGroupPin = async (
  adminId: string,
  conversationId: string,
): Promise<string> => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== 'group') {
    throw new ResponseError(404, 'Group Not Found', 'The group could not be found.');
  }

  const participant = await Conversation.findParticipant(adminId, conversationId);

  if (!participant || participant.role !== 'admin') {
    throw new ResponseError(
      403,
      'Access Denied',
      'You do not have the necessary privileges to generate a PIN. Only group administrators can perform this action.',
    );
  }

  let pin = Generator.pin();

  // Looping terus sampai dapat PIN yang 100% unik
  while (true) {
    const existingGroup = await Conversation.findByPin(pin);

    if (!existingGroup) break;

    pin = Generator.pin();
  }

  await Conversation.updatePin(conversationId, pin);

  return pin;
};

/**
 * Menghapus PIN dari grup percakapan (di-set menjadi null).
 * Mengakibatkan grup tidak bisa lagi diakses via link/PIN join.
 * Hanya admin grup yang diizinkan untuk melakukan aksi ini.
 *
 * @param {string} adminId - ID pengguna yang me-request (harus ber-role admin)
 * @param {string} conversationId - ID percakapan grup
 * @returns {Promise<void>}
 * @throws {ResponseError} 404 - Jika grup tidak ditemukan
 * @throws {ResponseError} 403 - Jika pengguna bukan admin
 */
export const removeGroupPin = async (adminId: string, conversationId: string): Promise<void> => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== 'group') {
    throw new ResponseError(404, 'Group Not Found', 'The group could not be found.');
  }

  const participant = await Conversation.findParticipant(adminId, conversationId);

  if (!participant || participant.role !== 'admin') {
    throw new ResponseError(
      403,
      'Access Denied',
      'You do not have the necessary privileges to remove the PIN. Only group administrators can perform this action.',
    );
  }

  await Conversation.updatePin(conversationId, null);
};

/**
 * Menghapus percakapan dari sisi pengguna (Soft Delete).
 * HANYA berlaku untuk percakapan tipe 'private'.
 * Pesan secara global tidak dihapus, hanya kolom deleted_at dan last_cleared_at
 * pada conversation_participants yang diupdate agar UI pengguna bersih.
 * Jika chat sudah terhapus, operasi akan silent return.
 *
 * @param {string} userId - ID pengguna
 * @param {string} conversationId - ID percakapan
 * @throws {ResponseError} Jika percakapan bukan tipe 'private'
 */
export const deleteConversation = async (userId: string, conversationId: string): Promise<void> => {
  // Ambil detail percakapan untuk memastikan tipenya
  const conversation = await Conversation.findById(conversationId);

  if (!conversation) {
    throw new ResponseError(404, 'Conversation Not Found', 'The conversation does not exist.');
  }

  // VALIDASI KRUSIAL: Tolak jika ini adalah Grup
  if (conversation.type === 'group') {
    throw new ResponseError(
      400,
      'Bad Request',
      'Group conversations cannot be deleted. Please use the Leave Group or Clear Chat options instead.',
    );
  }

  // Pastikan user adalah partisipan dari percakapan ini
  const participant = await Conversation.findParticipant(userId, conversationId);

  // Jika sudah tidak berpartisipasi atau sudah terhapus (deleted_at terisi), abaikan.
  if (!participant || participant.deleted_at !== null) return;

  const now = new Date();

  // Lakukan Soft Delete
  await Conversation.softDeleteParticipant(userId, conversationId, now);
};

/**
 * Membersihkan riwayat percakapan dari sisi pengguna (Clear Chat).
 * Berlaku untuk tipe 'private' maupun 'group'.
 * Pesan secara global tidak dihapus, hanya kolom last_cleared_at yang diupdate.
 *
 * @param {string} userId - ID pengguna
 * @param {string} conversationId - ID percakapan
 * @throws {ResponseError} Jika percakapan atau partisipan tidak ditemukan
 */
export const clearChat = async (userId: string, conversationId: string): Promise<void> => {
  // Pastikan user adalah partisipan aktif di percakapan ini
  const participant = await Conversation.findParticipant(userId, conversationId);

  if (!participant || participant.deleted_at !== null) {
    throw new ResponseError(
      404,
      'Not Found',
      'You are not an active participant in this conversation.',
    );
  }

  const now = new Date();

  // Update last_cleared_at
  await Conversation.clearConversationHistory(userId, conversationId, now);
};

/**
 * Membuat grup percakapan baru dengan dukungan unggah avatar opsional.
 * Pengguna yang membuat grup akan secara otomatis ditetapkan sebagai 'admin'.
 *
 * @param {string} creatorId - ID pengguna yang membuat grup
 * @param {string} name - Nama grup
 * @param {string} description - Deskripsi grup (opsional)
 * @param {Buffer} [fileBuffer] - Buffer file gambar dari Multer (opsional)
 * @returns {Promise<string>} ID percakapan grup yang baru dibuat
 */
export const createGroup = async (
  creatorId: string,
  name: string,
  description: string | null = null,
  fileBuffer?: Buffer,
): Promise<string> => {
  const groupId = Generator.id();

  let avatarUrl: string | null = null;

  // Jika user mengunggah foto saat membuat grup, proses ke Cloudinary
  if (fileBuffer) {
    avatarUrl = await new Promise<string>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: 'iyou-messenger/group-avatars',
            public_id: `group_avatar_${groupId}`,
            overwrite: true,
            transformation: [{ width: 400, height: 400, crop: 'fill' }],
          },
          (error, result) => {
            if (error || !result) return reject(error);
            resolve(result.secure_url);
          },
        )
        .end(fileBuffer);
    });
  }

  // Simpan ke database (Pastikan method createGroup di model menerima avatar_url)
  await Conversation.createGroup({
    id: groupId,
    name,
    description,
    avatar_url: avatarUrl,
  });

  // Tambahkan pembuat sebagai Admin pertama
  await Conversation.addParticipant({
    id: Generator.id(),
    user_id: creatorId,
    conversation_id: groupId,
    role: 'admin',
    status: 'active',
  });

  return groupId;
};

/**
 * Menambahkan anggota baru ke dalam grup percakapan.
 * CRITICAL ACCESS: Hanya pengguna dengan role 'admin' yang berhak menambahkan anggota.
 * Jika target user sudah berada di dalam grup, sistem akan melakukan silent return atau reset deleted_at.
 *
 * @param {string} adminId - ID pengguna yang mengeksekusi (wajib Admin)
 * @param {string} conversationId - ID percakapan grup
 * @param {string} targetUserId - ID pengguna yang akan dimasukkan ke grup
 * @throws {ResponseError} 403 - Jika eksekutor bukan admin
 */
export const addGroupMember = async (
  adminId: string,
  conversationId: string,
  targetUserId: string,
): Promise<void> => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== 'group') return;

  const participant = await Conversation.findParticipant(adminId, conversationId);

  if (!participant || participant.role !== 'admin') {
    throw new ResponseError(
      403,
      'Access Denied',
      'You do not have the necessary privileges to add members to this group. Only a group administrator can perform this action.',
    );
  }

  // Cek apakah target sudah berpartisipasi di grup ini
  const existingTarget = await Conversation.findParticipant(targetUserId, conversationId);
  if (existingTarget) {
    // Jika target pernah ada tapi history-nya dihapus (clear chat/leave), reset deleted_at nya.
    if (existingTarget.deleted_at !== null) {
      await Conversation.resetDeletedAt(conversationId, targetUserId);
      return;
    }
    // Jika masih aktif, silent return (idempotent)
    return;
  }

  // Tambahkan sebagai member biasa
  await Conversation.addParticipant({
    id: Generator.id(),
    user_id: targetUserId,
    conversation_id: conversationId,
    role: 'member',
    status: 'active',
  });

  // Broadcast notifikasi via WebSocket ke semua anggota (termasuk yang baru masuk)
  const allParticipants = await Conversation.findAllParticipants(conversationId);
  const userIdsToNotify = allParticipants.map((p) => p.user_id);

  WsSender.sendToMany(userIdsToNotify, {
    event: 'group:member_added',
    payload: { conversationId, addedBy: adminId, newMemberId: targetUserId },
  });
};

/**
 * Mengeluarkan (Kick) anggota dari grup percakapan.
 * CRITICAL ACCESS: Hanya admin yang dapat mengeluarkan anggota.
 * Jika target user sudah tidak ada di grup, silent return.
 *
 * @param {string} adminId - ID pengguna yang mengeksekusi (wajib Admin)
 * @param {string} conversationId - ID percakapan grup
 * @param {string} targetUserId - ID anggota yang akan dikeluarkan
 * @throws {ResponseError} 403 - Jika eksekutor bukan admin
 */
export const removeGroupMember = async (
  adminId: string,
  conversationId: string,
  targetUserId: string,
): Promise<void> => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== 'group') return;

  const participant = await Conversation.findParticipant(adminId, conversationId);

  if (!participant || participant.role !== 'admin') {
    throw new ResponseError(
      403,
      'Access Denied',
      'You do not have the necessary privileges to remove members from this group. Only a group administrator can perform this action.',
    );
  }

  // Admin tidak bisa menge-kick dirinya sendiri melalui endpoint ini.
  // Jika admin ingin keluar, harus menggunakan fungsi leaveGroup.
  if (adminId === targetUserId) return;

  const targetParticipant = await Conversation.findParticipant(targetUserId, conversationId);

  // Jika target tidak valid atau sudah keluar, silent return
  if (!targetParticipant || targetParticipant.deleted_at !== null) return;

  // Soft delete partisipasi (mirip logika leaveGroup)
  await Conversation.softDeleteParticipant(targetUserId, conversationId, new Date());

  // Tarik semua member yang tersisa untuk diberi tahu
  const allMembers = await Conversation.findAllParticipants(conversationId);
  const targetIds = allMembers.map((m) => m.user_id);

  // Kirim juga sinyal ke korban yang di-kick agar FE-nya otomatis ketendang/tertutup
  if (!targetIds.includes(targetUserId)) targetIds.push(targetUserId);

  WsSender.sendToMany(targetIds, {
    event: 'group:member_removed',
    payload: {
      conversationId,
      removedBy: adminId,
      removedMemberId: targetUserId,
    },
  });
};

/**
 * Keluar dari grup percakapan atas kemauan sendiri.
 * Logika: Menghapus (soft-delete global) data participant. Jika admin terakhir yang keluar,
 * sistem secara otomatis mencari member tertua (berdasarkan joined_at) untuk
 * dipromosikan menjadi admin baru.
 * Jika sudah bukan member, silent return.
 *
 * @param {string} userId - ID pengguna yang ingin keluar
 * @param {string} conversationId - ID percakapan grup
 */
export const leaveGroup = async (userId: string, conversationId: string): Promise<void> => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.type !== 'group') return;

  const participant = await Conversation.findParticipant(userId, conversationId);

  // Jika user sebenarnya bukan bagian dari grup, silent return
  if (!participant || participant.deleted_at !== null) return;

  // Jika yang keluar adalah admin, kita perlu promote admin baru
  if (participant.role === 'admin') {
    const oldestMember = await Conversation.findOldestMember(conversationId, userId);

    if (oldestMember) {
      await Conversation.promoteToAdmin(oldestMember.user_id, conversationId);
    } else {
      // Admin satu-satunya, hapus grup sekalian
      await Conversation.softDeleteParticipant(userId, conversationId, new Date());

      await Conversation.hardDeleteGroup(conversationId);

      return; // Tidak perlu broadcast member_left, grup sudah dihapus
    }
  }

  // Soft delete participation
  await Conversation.softDeleteParticipant(userId, conversationId, new Date());

  // Notifikasi via WebSocket ke sisa anggota grup
  const allMembers = await Conversation.findAllParticipants(conversationId);
  const targetIds = allMembers.map((m) => m.user_id);

  WsSender.sendToMany(targetIds, {
    event: 'group:member_left',
    payload: { conversationId, userId },
  });
};

/**
 * Menghapus grup percakapan secara permanen (Hard Delete).
 * Jika state percakapan tidak eksis, atau pengguna
 * bukan admin, kita kembalikan silent return tanpa melempar error
 * agar state internal dan hak akses tidak bocor.
 *
 * @param {string} adminId - ID pengguna yang mengeksekusi
 * @param {string} conversationId - ID percakapan grup
 */
export const deleteGroup = async (adminId: string, conversationId: string): Promise<void> => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== 'group') return;

  const participant = await Conversation.findParticipant(adminId, conversationId);

  if (!participant || participant.role !== 'admin') return;

  // Ambil daftar member SEBELUM delete — broadcast dulu agar semua dapat notif
  const allParticipants = await Conversation.findAllParticipants(conversationId);

  const userIdsToNotify = allParticipants.map((p) => p.user_id);

  // Hapus grup secara permanen
  await Conversation.hardDeleteGroup(conversationId);

  // Broadcast ke semua member, bahwa grup telah di hapus
  if (userIdsToNotify.length > 0) {
    WsSender.sendToMany(userIdsToNotify, {
      event: 'group:deleted',
      payload: { conversationId },
    });
  }
};
