import * as Message from '@/models/message.model.js';
import * as MessageReaction from '@/models/message-reaction.model.js';
import * as Conversation from '@/models/conversation.model.js';
import * as WsSender from '@/websocket/sender.ws.js';
import * as Generator from '@/helpers/generator.js';

/**
 * Menghapus pesan secara global (Soft Delete).
 * Pesan tetap ada di database, namun kolom deleted_at akan terisi sehingga
 * di sisi client dapat ditampilkan sebagai "Pesan ini telah dihapus".
 * Jika pesan tidak ditemukan, sudah terhapus, atau pengguna
 * mencoba menghapus pesan milik orang lain, sistem akan melakukan silent return.
 *
 * @param {string} userId - ID pengguna yang mencoba menghapus pesan
 * @param {string} messageId - ID pesan yang akan dihapus
 * @returns {Promise<void>}
 */
export const deleteMessage = async (userId: string, messageId: string): Promise<void> => {
  const message = await Message.findById(messageId);

  // Silent return jika pesan tidak ada atau sudah terhapus sebelumnya
  if (!message || message.deleted_at !== null) {
    return;
  }

  // Silent return jika pengguna mencoba menghapus pesan yang BUKAN miliknya
  if (message.sender_id !== userId) {
    return;
  }

  // Lakukan soft delete global
  await Message.softDelete(messageId);

  // Broadcast penghapusan pesan ke seluruh partisipan grup/private chat
  const participants = await Conversation.findAllParticipants(message.conversation_id);
  const userIds = participants.map((p) => p.user_id);

  WsSender.sendToMany(userIds, {
    event: 'message:deleted',
    payload: { messageId, conversationId: message.conversation_id },
  });
};

/**
 * Mengedit konten pesan yang sudah terkirim.
 * Hanya pengirim asli yang berhak mengubah isi pesan.
 * Jika pelanggaran akses terjadi (pesan orang lain) atau pesan sudah dihapus, silent return.
 *
 * @param {string} userId - ID pengguna yang mencoba mengedit pesan
 * @param {string} messageId - ID pesan yang akan diedit
 * @param {string} newContent - Teks pesan yang baru
 * @returns {Promise<void>}
 */
export const editMessage = async (
  userId: string,
  messageId: string,
  newContent: string,
): Promise<void> => {
  const message = await Message.findById(messageId);

  // Silent return jika pesan tidak ada, sudah dihapus, atau BUKAN milik user
  if (!message || message.deleted_at !== null || message.sender_id !== userId) {
    return;
  }

  // Update konten pesan di database
  await Message.updateContent(messageId, newContent);

  // Broadcast perubahan konten pesan ke seluruh partisipan
  const participants = await Conversation.findAllParticipants(message.conversation_id);
  const userIds = participants.map((p) => p.user_id);

  WsSender.sendToMany(userIds, {
    event: 'message:edited',
    payload: { messageId, content: newContent, conversationId: message.conversation_id },
  });
};

/**
 * Memberikan atau mengubah reaksi (emoji) pada sebuah pesan.
 * Idempotent. Menggunakan metode UPSERT di DB sehingga
 * jika user memberikan reaksi baru, reaksi lama akan tertimpa secara otomatis.
 *
 * @param {string} userId - ID pengguna yang memberikan reaksi
 * @param {string} messageId - ID pesan yang diberi reaksi
 * @param {string} reaction - Emoji atau string reaksi (misal: '👍')
 * @returns {Promise<void>}
 */
export const reactToMessage = async (
  userId: string,
  messageId: string,
  reaction: string,
): Promise<void> => {
  const message = await Message.findById(messageId);

  // Jika pesan tidak ada atau sudah ditarik/dihapus, tidak bisa di-react
  if (!message || message.deleted_at !== null) return;

  // Validasi keamanan: Pastikan user yang memberi reaksi adalah bagian dari conversation tersebut
  const participant = await Conversation.findParticipant(userId, message.conversation_id);
  if (!participant || participant.deleted_at !== null) return;

  const reactionId = Generator.id();

  // Lakukan UPSERT reaksi di database
  if (reaction === '') {
    await MessageReaction.removeReaction(messageId, userId);
  } else {
    await MessageReaction.upsertReaction(reactionId, messageId, userId, reaction);
  }

  // Broadcast notifikasi reaksi ke seluruh partisipan grup/chat
  const participants = await Conversation.findAllParticipants(message.conversation_id);
  const userIds = participants.map((p) => p.user_id);

  WsSender.sendToMany(userIds, {
    event: 'message:react_updated',
    payload: { messageId, userId, reaction, conversationId: message.conversation_id },
  });
};
