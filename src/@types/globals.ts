import type { JwtPayload } from 'jsonwebtoken';

/**
 * Data lengkap pengguna sesuai struktur tabel users di database.
 * Field sensitif seperti password tidak boleh dikirim ke FE.
 */
export type UserData = {
  id: string;
  fullname: string | null;
  username: string;
  username_changed_at: Date | null;
  email: string;
  email_changed_at: Date | null;
  pin: string | null;
  phone: string | null;
  phone_changed_at: Date | null;
  about: string | null;
  password: string;
  avatar_url: string | null;
  is_verify: boolean;
  is_online: boolean;
  last_seen: Date | null;
  hide_profile: boolean;
  read_receipt: boolean;
  story_receipt: boolean;
  show_last_seen: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

/**
 * Data verifikasi sesuai struktur tabel verifications di database.
 * Digunakan untuk OTP email, OTP phone, dan param token perubahan data.
 */
export type VerificationData = {
  id: string;
  user_id: string;
  token: string;
  type: 'email_otp' | 'phone_otp' | 'param_token';
  new_value: string | null;
  limit_request: number;
  last_sent_at: Date;
  expired_at: Date;
  created_at: Date;
};

/**
 * Data relasi pertemanan sesuai struktur tabel friendships di database.
 * Method request memerlukan konfirmasi, method pin langsung accepted.
 */
export type FriendshipData = {
  id: string;
  requester_id: string;
  receiver_id: string;
  method: 'request' | 'pin';
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  updated_at: Date;
  created_at: Date;
};

/**
 * Data percakapan sesuai struktur tabel conversations di database.
 * Type 'private' untuk chat 1-1, 'group' untuk chat grup.
 * Kolom pin, name, dan description khusus untuk group chat.
 * Tidak ada deleted_at karena soft delete dilakukan per user melalui conversation_participants.
 * * Catatan Ekstraksi:
 * Field opsional 'last_message' dan 'unread_count' tidak ada di struktur fisik tabel awal,
 * melainkan di-inject secara dinamis melalui query JOIN (PostgreSQL) pada endpoint
 * getConversations untuk menghindari N+1 Query problem di sisi Frontend.
 */
export type ConversationData = {
  id: string;
  type: 'private' | 'group';
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  pin: string | null;
  created_at: Date;
  last_message?: {
    id: string;
    content: string;
    sender_id: string;
    created_at: Date;
  } | null;
  unread_count?: number;
};

/**
 * Data anggota percakapan sesuai struktur tabel conversation_participants.
 * Role admin hanya untuk group chat.
 * Status pending untuk anggota yang menunggu konfirmasi admin.
 * is_pinned    — pin chat di bagian atas list per user
 * is_archived  — arsip chat dari list utama per user
 * is_muted     — hide notifikasi secara permanen per user
 * last_cleared_at — timestamp hapus chat, digunakan untuk filter pesan lama
 * deleted_at   — soft delete per user, direset saat pesan baru masuk
 */
export type ConversationParticipantData = {
  id: string;
  user_id: string;
  conversation_id: string;
  role: 'peer' | 'admin' | 'member';
  status: 'active' | 'pending';
  is_pinned: boolean;
  is_archived: boolean;
  is_muted: boolean;
  joined_at: Date;
  last_cleared_at: Date | null;
  deleted_at: Date | null;
};

/**
 * Data undangan masuk group chat sesuai struktur tabel conversation_invites.
 * Dikirim oleh admin ke user tertentu secara langsung.
 */
export type ConversationInviteData = {
  id: string;
  conversation_id: string;
  invited_by: string;
  invited_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: Date;
};

/**
 * Data read receipt yang di-join saat query getMessages.
 * Hanya ada saat query menggunakan findByConversationWithClear.
 */
export type MessageReadSummary = {
  user_id: string;
  read_at: Date;
};

/**
 * Data pesan sesuai struktur tabel messages di database.
 * Soft delete via deleted_at berlaku global untuk semua participant.
 * Mendukung fitur balasan (reply_to_message_id) dan pengeditan (is_edited & updated_at).
 */
export type MessageData = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  reply_to_message_id: string | null;
  is_edited: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  reads?: MessageReadSummary[];
  reactions?: {
    id: string;
    user_id: string;
    reaction: string;
  }[];
};

/**
 * Data reaksi emoji pada pesan sesuai struktur tabel message_reactions.
 * Menggunakan pendekatan upsert di DB sehingga 1 user = 1 reaksi per pesan.
 */
export type MessageReactionData = {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: Date;
};

/**
 * Data status baca pesan sesuai struktur tabel message_reads di database.
 * Hanya dibuat jika read_receipt pengguna aktif.
 */
export type MessageReadData = {
  id: string;
  user_id: string;
  message_id: string;
  read_at: Date;
};

/**
 * Data story atau status pengguna sesuai struktur tabel stories di database.
 * Mendukung konten media atau teks dengan background color.
 * Memiliki batas waktu tayang selama 24 jam (expires_at).
 */
export type StoryData = {
  id: string;
  user_id: string;
  media_public_id: string | null;
  media_url: string | null;
  media_type: string | null;
  content_text: string | null;
  bg_color: string | null;
  expires_at: Date;
  created_at: Date;
};

/**
 * Data riwayat tampilan story sesuai struktur tabel story_views.
 * Mencatat daftar pengguna yang telah melihat story tertentu.
 */
export type StoryViewData = {
  id: string;
  story_id: string;
  viewer_id: string;
  created_at: Date;
};

/**
 * Payload JWT yang disimpan di cookie autentikasi.
 * Extends JwtPayload dari jsonwebtoken untuk field standar seperti iat dan exp.
 */
export type UserToken = JwtPayload & {
  id: string;
  username: string;
  email: string;
  phone: string | null;
};

/**
 * Extends Express Request interface untuk menyimpan data user dari JWT
 * dan memastikan req.params selalu bertipe Record<string, string>.
 *
 * - req.user   — payload JWT, diisi oleh middleware authorization
 * - req.params — override default Express v5 yang bertipe
 * Record<string, string | string[] | undefined>
 */
declare global {
  namespace Express {
    interface Request {
      user: UserToken;
      params: Record<string, string>;
    }
  }
}
