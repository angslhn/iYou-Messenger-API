import { WebSocket } from 'ws';

import * as WsManager from '@/lib/ws.js';

/**
 * Tipe data untuk semua event yang dikirim dari server ke client.
 * Setiap event memiliki nama dan payload yang spesifik.
 * Pendekatan union type ini memastikan Type-Safety yang ketat saat melakukan broadcast.
 */
export type WsEvent =
  | { event: 'pong'; payload: { timestamp: Date } }
  | {
      event: 'message:receive';
      payload: {
        id: string;
        conversationId: string;
        senderId: string;
        content: string;
        replyToMessageId: string | null;
        createdAt: Date;
      };
    }
  | { event: 'message:read'; payload: { messageId: string; readerId: string; readAt: Date } }
  | { event: 'message:deleted'; payload: { messageId: string; conversationId: string } }
  | {
      event: 'message:edited';
      payload: { messageId: string; content: string; conversationId: string };
    }
  | {
      event: 'message:react_updated';
      payload: { messageId: string; userId: string; reaction: string; conversationId: string };
    }
  | { event: 'user:online'; payload: { userId: string } }
  | { event: 'user:offline'; payload: { userId: string; lastSeen: Date | null } }
  | { event: 'user:update_avatar'; payload: { userId: string; avatarUrl: string } }
  | { event: 'typing:start'; payload: { conversationId: string; userId: string } }
  | { event: 'typing:stop'; payload: { conversationId: string; userId: string } }
  | {
      event: 'group:update_avatar';
      payload: {
        conversationId?: string;
        avatarUrl: string;
      };
    }
  | {
      event: 'group:update_info';
      payload: {
        conversationId: string;
        name: string | null;
        description: string | null;
      };
    }
  | { event: 'group:deleted'; payload: { conversationId: string } }
  | { event: 'group:member_left'; payload: { conversationId: string; userId: string } }
  | {
      event: 'group:member_added';
      payload: { conversationId: string; addedBy: string; newMemberId: string };
    }
  | {
      event: 'group:member_removed';
      payload: { conversationId: string; removedBy: string; removedMemberId: string };
    }
  | {
      event: 'group:invite_received';
      payload: {
        inviteId: string;
        conversationId: string;
        groupName: string;
        inviterUsername: string;
        inviterFullname: string | null;
      };
    }
  | {
      event: 'friend:request_received';
      payload: {
        friendshipId: string;
        requesterId: string;
        requesterUsername: string;
        requesterFullname: string | null;
        requesterAvatarUrl: string | null;
      };
    }
  | {
      event: 'friend:request_accepted';
      payload: {
        friendshipId: string;
        receiverId: string;
        receiverUsername: string;
        receiverFullname: string | null;
      };
    }
  | {
      event: 'friend:new_friend';
      payload: {
        friendshipId: string;
        friendId: string;
        friendUsername: string;
        friendFullname: string | null;
        friendAvatarUrl: string | null;
      };
    }
  | { event: 'story:new'; payload: { userId: string; storyId: string } }
  | { event: 'error'; payload: { message: string } };

/**
 * Mengirim event ke satu user berdasarkan userId.
 * Hanya mengirim jika user sedang terkoneksi dan socket dalam kondisi OPEN.
 *
 * @param {string} userId - ID pengguna tujuan
 * @param {WsEvent} data - Event dan payload yang akan dikirim
 * @returns {boolean} true jika berhasil dikirim, false jika user offline atau socket tidak OPEN
 */
export const sendToUser = (userId: string, data: WsEvent): boolean => {
  const socket = WsManager.getConnection(userId);

  // Cek user terkoneksi dan socket dalam kondisi OPEN
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify(data));

  return true;
};

/**
 * Mengirim event ke banyak user sekaligus.
 * User yang offline atau socket tidak OPEN akan dilewati secara diam-diam (silent fail).
 *
 * @param {string[]} userIds - Array ID pengguna tujuan
 * @param {WsEvent} data - Event dan payload yang akan dikirim
 */
export const sendToMany = (userIds: string[], data: WsEvent): void => {
  // Lakukan iterasi ke seluruh array ID dan manfaatkan validasi dari fungsi sendToUser
  for (const userId of userIds) {
    sendToUser(userId, data);
  }
};

/**
 * Mengirim pesan error ke client.
 * Digunakan ketika terjadi kesalahan saat memproses event dari client (misal: payload tidak valid).
 *
 * @param {string} userId - ID pengguna tujuan
 * @param {string} message - Pesan error yang akan dikirim
 */
export const sendError = (userId: string, message: string): void => {
  sendToUser(userId, { event: 'error', payload: { message } });
};
