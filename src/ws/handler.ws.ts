import * as WsManager from '@/lib/ws.js';
import * as WsSender from '@/ws/sender.ws.js';
import * as Generator from '@/helpers/generator.js';
import * as RateLimiter from '@/ws/rate-limiter.ws.js';

import * as User from '@/models/user.model.js';
import * as Friendship from '@/models/friendship.model.js';
import * as Conversation from '@/models/conversation.model.js';
import * as Message from '@/models/message.model.js';
import * as MessageRead from '@/models/message-read.model.js';
import * as MessageReaction from '@/models/message-reaction.model.js';

import * as ConversationService from '@/services/conversation.service.js';

import type WebSocket from 'ws';

/**
 * Tipe data untuk semua event yang dikirim dari client ke server.
 */
type IncomingEvent =
  | { event: 'ping'; payload?: any }
  | {
      event: 'message:send';
      payload: {
        receiverId?: string;
        conversationId?: string;
        content: string;
        replyToMessageId?: string;
      };
    }
  | { event: 'message:read'; payload: { messageId: string; senderId: string } }
  | { event: 'message:edit'; payload: { messageId: string; content: string } }
  | { event: 'message:react'; payload: { messageId: string; reaction: string } }
  | { event: 'message:delete'; payload: { messageId: string } }
  | { event: 'typing:start'; payload: { conversationId?: string; receiverId?: string } }
  | { event: 'typing:stop'; payload: { conversationId?: string; receiverId?: string } }
  | { event: 'group:delete'; payload: { conversationId: string } }
  | { event: 'group:leave'; payload: { conversationId: string } };

/**
 * Entry point utama untuk memproses semua event masuk dari client.
 * Menerima raw message dari WebSocket, parse JSON, lalu routing ke handler yang sesuai.
 *
 * @param {string} userId - ID pengguna yang mengirim event
 * @param {WebSocket.RawData} rawData - Raw data yang diterima dari client
 */
export const handleMessage = async (userId: string, rawData: WebSocket.RawData): Promise<void> => {
  if (rawData.toString().length > 10240) {
    // Tolak jika lebih dari 10kb
    WsSender.sendError(userId, 'Payload too large, maximum permitted size exceeded.');
    return;
  }

  let parsed: IncomingEvent;

  try {
    // Parse JSON dari raw data WebSocket
    parsed = JSON.parse(rawData.toString());
  } catch {
    // Kirim error jika data bukan JSON valid
    WsSender.sendError(userId, 'Invalid message format, must be a valid JSON.');
    return;
  }

  // Validasi struktur event — harus ada field event dan payload
  if (!parsed.event || (parsed.event !== 'ping' && !parsed.payload)) {
    WsSender.sendError(userId, 'Invalid event structure, must have event and payload.');
    return;
  }

  // Cek rate limit SEBELUM routing ke handler
  if (RateLimiter.isRateLimited(userId, parsed.event)) {
    WsSender.sendError(
      userId,
      `Rate limit exceeded for event "${parsed.event}", please slow down.`,
    );
    return;
  }

  switch (parsed.event) {
    case 'ping':
      WsSender.sendToUser(userId, {
        event: 'pong',
        payload: { timestamp: new Date() },
      });
      break;
    case 'message:send':
      await handleSendMessage(userId, parsed.payload);
      break;
    case 'message:read':
      await handleReadMessage(userId, parsed.payload);
      break;
    case 'message:edit':
      await handleEditMessage(userId, parsed.payload);
      break;
    case 'message:react':
      await handleReactMessage(userId, parsed.payload);
      break;
    case 'message:delete':
      await handleDeleteMessage(userId, parsed.payload);
      break;
    case 'typing:start':
      await handleTyping(userId, parsed.payload, 'start');
      break;
    case 'typing:stop':
      await handleTyping(userId, parsed.payload, 'stop');
      break;
    case 'group:delete':
      try {
        await ConversationService.deleteGroup(userId, parsed.payload.conversationId);
      } catch (err) {
        WsSender.sendError(userId, 'Failed to delete group, please try again.');
        console.error('[WS] group:delete error', err);
      }
      break;
    case 'group:leave':
      try {
        await ConversationService.leaveGroup(userId, parsed.payload.conversationId);
      } catch (err) {
        WsSender.sendError(userId, 'Failed to leave group, please try again.');
        console.error('[WS] group:leave error', err);
      }
      break;
    default:
      WsSender.sendError(userId, 'Unknown event');
  }
};

/**
 * Menangani event pengiriman pesan baru dari client.
 * Mendukung pengiriman pesan teks standar maupun balasan (reply) ke pesan spesifik.
 * Memvalidasi status pertemanan, membuat conversation private jika belum ada,
 * menyimpan pesan ke database, lalu meneruskan pesan ke penerima jika online.
 *
 * Jika penerima sebelumnya telah menghapus percakapan (clear chat),
 * kolom deleted_at akan direset sehingga percakapan muncul kembali di list chat
 * dengan hanya menampilkan pesan baru ini.
 *
 * @param {string} senderId - ID pengguna pengirim pesan
 * @param {{ receiverId: string; content: string; replyToMessageId?: string }} payload - Data pesan yang dikirim beserta referensi reply (opsional)
 * @returns {Promise<void>}
 */
const handleSendMessage = async (
  senderId: string,
  payload: {
    receiverId?: string;
    conversationId?: string;
    content: string;
    replyToMessageId?: string;
  },
): Promise<void> => {
  const { receiverId, conversationId, content, replyToMessageId } = payload;

  if (!content || !content.trim()) {
    WsSender.sendError(senderId, 'Message content cannot be empty.');
    return;
  }

  if (content.trim().length > 2000) {
    WsSender.sendError(senderId, 'Message content is too long, maximum 2000 characters.');
    return;
  }

  let targetConversationId: string;

  // ==========================================
  // SKENARIO 1: PRIVATE CHAT (Pakai receiverId)
  // ==========================================
  if (receiverId) {
    const friendship = await Friendship.findByUsers(senderId, receiverId);

    if (!friendship || friendship.status !== 'accepted') {
      WsSender.sendError(senderId, 'You cannot send messages to this user.');
      return;
    }

    let conversation = await Conversation.findPrivateByUsers(senderId, receiverId);

    if (!conversation) {
      targetConversationId = Generator.id();

      await Conversation.create({ id: targetConversationId, type: 'private' });

      await Conversation.addParticipant({
        id: Generator.id(),
        user_id: senderId,
        conversation_id: targetConversationId,
        role: 'peer',
        status: 'active',
      });

      await Conversation.addParticipant({
        id: Generator.id(),
        user_id: receiverId,
        conversation_id: targetConversationId,
        role: 'peer',
        status: 'active',
      });
    } else {
      targetConversationId = conversation.id;
      await Conversation.resetDeletedAt(targetConversationId, receiverId);
      await Conversation.resetDeletedAt(targetConversationId, senderId);
    }
  }
  // ==========================================
  // SKENARIO 2: GROUP CHAT (Pakai conversationId)
  // ==========================================
  else if (conversationId) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      WsSender.sendError(senderId, 'Conversation not found.');
      return;
    }

    // Jika private chat, tetap harus cek friendship
    if (conversation.type === 'private') {
      const otherParticipant = await Conversation.findAllParticipants(conversationId);
      const otherId = otherParticipant.find((p) => p.user_id !== senderId)?.user_id;

      if (otherId) {
        const friendship = await Friendship.findByUsers(senderId, otherId);
        if (!friendship || friendship.status !== 'accepted') {
          WsSender.sendError(senderId, 'You cannot send messages to this user.');
          return;
        }
      }
    }

    const participant = await Conversation.findParticipant(senderId, conversationId);

    // Pengecekan participant.status yang bukan 'active'
    if (!participant || participant.deleted_at !== null || participant.status !== 'active') {
      WsSender.sendError(senderId, 'You are not an active member of this conversation.');
      return;
    }

    targetConversationId = conversationId;

    // Reset deleted_at untuk SEMUA participant grup yang sebelumnya clear chat
    // agar pesan baru ini muncul di list chat mereka kembali
    const allParticipants = await Conversation.findAllParticipantsIncludeDeleted(conversationId);

    await Promise.all(
      allParticipants
        .filter((p) => p.deleted_at !== null)
        .map((p) => Conversation.resetDeletedAt(conversationId, p.user_id)),
    );
  } else {
    WsSender.sendError(
      senderId,
      'Invalid payload: must provide either receiverId or conversationId.',
    );
    return;
  }

  const messageId = Generator.id();
  const createdAt = new Date();

  if (replyToMessageId) {
    const replyTarget = await Message.findById(replyToMessageId);

    if (!replyTarget || replyTarget.conversation_id !== targetConversationId) {
      WsSender.sendError(senderId, 'Invalid reply target message.');
      return;
    }
  }

  // Simpan ke DB
  await Message.create({
    id: messageId,
    conversation_id: targetConversationId,
    sender_id: senderId,
    content: content.trim(),
    reply_to_message_id: replyToMessageId || null,
  });

  const messageData = {
    id: messageId,
    conversationId: targetConversationId,
    senderId,
    content: content.trim(),
    replyToMessageId: replyToMessageId || null,
    createdAt,
  };

  // Konfirmasi ke pengirim
  WsSender.sendToUser(senderId, { event: 'message:receive', payload: messageData });

  // Broadcast ke penerima (Private vs Group)
  if (receiverId) {
    WsSender.sendToUser(receiverId, { event: 'message:receive', payload: messageData });
  } else if (conversationId) {
    // Ambil semua member grup dan broadcast (kecuali pengirim)
    const participants = await Conversation.findAllParticipants(conversationId);
    const targetUserIds = participants.map((p) => p.user_id).filter((id) => id !== senderId);

    WsSender.sendToMany(targetUserIds, { event: 'message:receive', payload: messageData });
  }
};

/**
 * Menangani permintaan pembaruan (edit) konten pesan dari client.
 * Memvalidasi apakah pesan tersebut eksis, belum dihapus, dan apakah pengguna
 * yang meminta adalah pengirim aslinya. Jika valid, sistem akan memperbarui
 * teks di database, menandai pesan sebagai telah diedit, lalu melakukan broadcast
 * event 'message:edited' ke seluruh partisipan di dalam obrolan tersebut.
 *
 * @param {string} userId - ID pengguna yang meminta pengeditan pesan (harus pengirim asli).
 * @param {Object} payload - Data yang dikirim dari client.
 * @param {string} payload.messageId - ID unik dari pesan yang akan diedit.
 * @param {string} payload.content - Teks konten pesan yang baru (tidak boleh kosong).
 * @returns {Promise<void>}
 */
const handleEditMessage = async (
  userId: string,
  payload: { messageId: string; content: string },
): Promise<void> => {
  const { messageId, content } = payload;

  if (!content || !content.trim()) {
    WsSender.sendError(userId, 'Edited message content cannot be empty.');
    return;
  }

  const message = await Message.findById(messageId);

  // Validasi: Pesan ada, milik sendiri, dan belum dihapus
  if (!message || message.sender_id !== userId || message.deleted_at !== null) {
    WsSender.sendError(userId, 'Cannot edit this message.');
    return;
  }

  // Update data pesan di database
  await Message.updateContent(messageId, content.trim());

  // Broadcast ke semua member di conversation tersebut
  const participants = await Conversation.findAllParticipants(message.conversation_id);
  const targetUserIds = participants.map((p) => p.user_id);

  WsSender.sendToMany(targetUserIds, {
    event: 'message:edited',
    payload: {
      messageId,
      content: content.trim(),
      conversationId: message.conversation_id,
    },
  });
};

/**
 * Menangani permintaan penghapusan pesan (Soft Delete) dari client.
 * Memvalidasi apakah pengguna adalah pengirim asli, mengubah status `deleted_at`
 * di database, lalu melakukan broadcast event 'message:deleted' ke seluruh
 * partisipan dalam obrolan tersebut.
 *
 * @param {string} userId - ID pengguna yang meminta penghapusan (harus pengirim asli).
 * @param {Object} payload - Data yang dikirim dari client.
 * @param {string} payload.messageId - ID unik dari pesan yang akan dihapus.
 * @returns {Promise<void>}
 */
const handleDeleteMessage = async (
  userId: string,
  payload: { messageId: string },
): Promise<void> => {
  const { messageId } = payload;

  const message = await Message.findById(messageId);

  // Validasi: Pesan ada dan yang menghapus adalah pengirim aslinya
  if (!message || message.sender_id !== userId || message.deleted_at !== null) {
    WsSender.sendError(userId, 'Cannot delete this message.');
    return;
  }

  // Update DB (Soft delete)
  await Message.softDelete(messageId);

  // Broadcast ke semua member di conversation tersebut (termasuk yang menghapus)
  const participants = await Conversation.findAllParticipants(message.conversation_id);
  const targetUserIds = participants.map((p) => p.user_id);

  WsSender.sendToMany(targetUserIds, {
    event: 'message:deleted',
    payload: { messageId, conversationId: message.conversation_id },
  });
};

/**
 * Menangani pemberian, pembaruan, atau pencabutan reaksi emoji pada sebuah pesan.
 * Memvalidasi keanggotaan aktif pengguna di obrolan, melakukan operasi UPSERT
 * ke tabel reaksi, lalu melakukan broadcast event 'message:reaction_updated'
 * ke seluruh partisipan dalam obrolan tersebut.
 *
 * @param {string} userId - ID pengguna yang memberikan atau mengubah reaksi.
 * @param {Object} payload - Data yang dikirim dari client.
 * @param {string} payload.messageId - ID unik dari pesan yang diberi reaksi.
 * @param {string} payload.reaction - Karakter emoji (contoh: "👍"). Kirim string kosong ("") untuk mencabut/menghapus reaksi.
 * @returns {Promise<void>}
 */
const handleReactMessage = async (
  userId: string,
  payload: { messageId: string; reaction: string },
): Promise<void> => {
  const { messageId, reaction } = payload;

  const message = await Message.findById(messageId);

  if (!message) return;

  // Check if the user is an active participant in the conversation
  const participant = await Conversation.findParticipant(userId, message.conversation_id);

  if (!participant || participant.status !== 'active') {
    WsSender.sendError(userId, 'You cannot react to this message.');
    return;
  }

  // Handle Unreact vs Upsert
  if (reaction === '') {
    // You'll need to create this method in your MessageReaction model
    await MessageReaction.removeReaction(messageId, userId);
  } else {
    // Insert or update the reaction
    await MessageReaction.upsertReaction(Generator.id(), messageId, userId, reaction);
  }

  // Broadcast to all participants (including the sender to update their UI)
  const participants = await Conversation.findAllParticipants(message.conversation_id);
  const targetUserIds = participants.map((p) => p.user_id);

  WsSender.sendToMany(targetUserIds, {
    event: 'message:react_updated',
    payload: {
      messageId,
      conversationId: message.conversation_id,
      userId,
      reaction, // The empty string "" will be broadcasted, telling clients to remove the emoji
    },
  });
};

/**
 * Menangani event ketika pengguna membaca sebuah pesan (Read Receipt).
 * Memvalidasi pengaturan privasi pengguna (read_receipt), memastikan tidak ada
 * laporan baca yang ganda (duplikasi), menyimpan status baca ke database,
 * lalu mengirimkan notifikasi kepada pengirim asli pesan tersebut.
 *
 * @param {string} userId - ID pengguna yang membaca pesan (penerima).
 * @param {Object} payload - Data yang dikirim dari client.
 * @param {string} payload.messageId - ID unik dari pesan yang baru saja dibaca.
 * @param {string} payload.senderId - ID pengguna pengirim pesan (target notifikasi).
 * @returns {Promise<void>}
 */
const handleReadMessage = async (
  userId: string,
  payload: { messageId: string; senderId: string },
): Promise<void> => {
  const { messageId, senderId } = payload;

  // Cek read_receipt user — jika false, skip semua proses
  // Pesan tetap tampil tapi tidak ada centang biru ke pengirim
  const user = await User.findById(userId);

  if (!user || !user.read_receipt) {
    return;
  }

  const readAt = new Date();

  // Simpan read receipt ke DB
  try {
    await MessageRead.create({ id: Generator.id(), user_id: userId, message_id: messageId });
  } catch (err: any) {
    if (err.code === '23505') return;
    throw err;
  }

  // Notifikasi pengirim bahwa pesannya sudah dibaca — centang biru
  WsSender.sendToUser(senderId, {
    event: 'message:read',
    payload: { messageId, readerId: userId, readAt },
  });
};

/**
 * Menangani event typing start dan stop dari client.
 * Langsung forward ke penerima tanpa menyimpan ke DB.
 *
 * @param {string} userId - ID pengguna yang sedang mengetik
 * @param {{ conversationId: string; receiverId: string }} payload - Data conversation
 * @param {'start' | 'stop'} type - Jenis event typing
 */
const handleTyping = async (
  userId: string,
  payload: { conversationId?: string; receiverId?: string },
  type: 'start' | 'stop',
): Promise<void> => {
  const { conversationId, receiverId } = payload;
  const eventName = type === 'start' ? 'typing:start' : 'typing:stop';

  if (receiverId) {
    // Private Chat: Cek apakah diblokir/tidak berteman
    const friendship = await Friendship.findByUsers(userId, receiverId);

    if (!friendship || friendship.status !== 'accepted') return; // Silent fail jika diblokir

    const conversation = await Conversation.findPrivateByUsers(userId, receiverId);
    const resolvedConversationId = conversationId || conversation?.id || '';

    WsSender.sendToUser(receiverId, {
      event: eventName,
      payload: { conversationId: resolvedConversationId, userId },
    });
  } else if (conversationId) {
    // Group Chat: Cek apakah masih member, lalu broadcast ke semua KECUALI yang ngetik
    const participant = await Conversation.findParticipant(userId, conversationId);

    if (!participant || participant.deleted_at !== null) return;

    const participants = await Conversation.findAllParticipants(conversationId);
    const targetUserIds = participants.map((p) => p.user_id).filter((id) => id !== userId);

    WsSender.sendToMany(targetUserIds, {
      event: eventName,
      payload: { conversationId, userId },
    });
  }
};

/**
 * Menangani event disconnect dari client.
 * Menghapus koneksi dari manager, update status offline di DB,
 * dan notifikasi teman-teman yang online.
 *
 * @param {string} userId - ID pengguna yang disconnect
 */
export const handleDisconnect = async (userId: string): Promise<void> => {
  // Hapus koneksi dari manager
  WsManager.removeConnection(userId);

  const lastSeen = new Date();

  // Ambil data user sekalian untuk mengecek preferensi
  const user = await User.findById(userId);

  if (!user) return; // Failsafe

  // Update status offline dan last_seen di DB
  await User.updateById({
    id: userId,
    is_online: false,
    last_seen: lastSeen,
  });

  // Ambil semua teman yang accepted untuk dinotifikasi
  const friends = await Friendship.findAcceptedFriends(userId);

  if (friends.length === 0) return; // Jika tidak punya teman, hentikan proses

  // Evaluasi payload yang akan dikirim berdasarkan pengaturan user
  const payloadLastSeen = user.show_last_seen ? lastSeen : null;

  // OPTIMASI: Gunakan sendToMany agar broadcast lebih efisien
  const targetFriendIds = friends.map((friend) => friend.id);

  WsSender.sendToMany(targetFriendIds, {
    event: 'user:offline',
    payload: { userId, lastSeen: payloadLastSeen },
  });
};

/**
 * Menangani event connect dari client baru.
 * Update status online di DB dan notifikasi teman-teman yang online.
 *
 * @param {string} userId - ID pengguna yang baru connect
 */
export const handleConnect = async (userId: string): Promise<void> => {
  // Update status online di DB
  await User.updateById({ id: userId, is_online: true });

  // Ambil semua teman yang accepted
  const friends = await Friendship.findAcceptedFriends(userId);

  if (friends.length === 0) return; // Jika tidak punya teman, hentikan proses

  // OPTIMASI: Gunakan sendToMany
  const targetFriendIds = friends.map((friend) => friend.id);

  WsSender.sendToMany(targetFriendIds, {
    event: 'user:online',
    payload: { userId },
  });
};
