-- ============================================================
-- USERS
-- Menyimpan data utama pengguna termasuk kredensial,
-- preferensi, dan status akun.
-- ============================================================
CREATE TABLE users (
  id CHAR(15) NOT NULL PRIMARY KEY,
  fullname VARCHAR(60) DEFAULT NULL,
  username VARCHAR(25) NOT NULL UNIQUE,
  username_changed_at TIMESTAMP DEFAULT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  email_changed_at TIMESTAMP DEFAULT NULL,
  pin VARCHAR(8) UNIQUE DEFAULT NULL,
  phone VARCHAR(15) UNIQUE DEFAULT NULL,
  phone_changed_at TIMESTAMP DEFAULT NULL,
  about VARCHAR(100) DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255) DEFAULT NULL,
  is_verify BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP DEFAULT NULL,
  hide_profile BOOLEAN DEFAULT FALSE,
  read_receipt BOOLEAN DEFAULT TRUE,
  story_receipt BOOLEAN DEFAULT TRUE,
  show_last_seen BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP DEFAULT NULL
);

-- ============================================================
-- VERIFICATIONS
-- Menyimpan token OTP dan param token untuk proses verifikasi
-- email, perubahan email, perubahan nomor telepon, dan
-- reset password. Kolom new_value digunakan untuk menyimpan
-- nilai baru sementara sebelum diverifikasi.
-- ============================================================
CREATE TABLE verifications (
  id CHAR(15) NOT NULL PRIMARY KEY,
  user_id CHAR(15) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL, -- ('email_otp', 'phone_otp', 'param_token')
  new_value VARCHAR(255) DEFAULT NULL,
  limit_request SMALLINT DEFAULT 3,
  last_sent_at TIMESTAMP NOT NULL,
  expired_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- FRIENDSHIPS
-- Menyimpan relasi pertemanan antar pengguna.
-- Method 'request' memerlukan konfirmasi penerima,
-- sedangkan method 'pin' langsung accepted tanpa konfirmasi.
-- UNIQUE(requester_id, receiver_id) mencegah duplikat relasi.
-- ============================================================
CREATE TABLE friendships (
  id CHAR(15) NOT NULL PRIMARY KEY,
  requester_id CHAR(15) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id CHAR(15) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method VARCHAR(10) DEFAULT 'request', -- ('request', 'pin')
  status VARCHAR(10) DEFAULT 'pending', -- ('pending', 'accepted', 'rejected', 'blocked')
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CONVERSATIONS
-- Menyimpan data percakapan baik private maupun group.
-- Kolom pin khusus untuk group chat sebagai kode join.
-- Tidak ada deleted_at karena soft delete dilakukan
-- per user melalui conversation_participants.deleted_at.
-- ============================================================
CREATE TABLE conversations (
  id CHAR(15) NOT NULL PRIMARY KEY,
  type VARCHAR(10) DEFAULT 'private', -- ('private', 'group')
  avatar_url VARCHAR(255) DEFAULT NULL,
  name VARCHAR(50) DEFAULT NULL,
  description VARCHAR(200) DEFAULT NULL,
  pin VARCHAR(8) UNIQUE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CONVERSATION_PARTICIPANTS
-- Menyimpan daftar anggota di setiap percakapan beserta
-- preferensi personal per user.
-- is_pinned    — pin chat di bagian atas list
-- is_archived  — arsip chat dari list utama
-- is_muted     — hide notifikasi secara permanen
-- last_cleared_at — timestamp hapus chat, filter pesan lama
-- deleted_at   — soft delete per user, reset saat pesan baru masuk
-- ============================================================
CREATE TABLE conversation_participants (
  id CHAR(15) NOT NULL PRIMARY KEY,
  user_id CHAR(15) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id CHAR(15) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(10) DEFAULT 'peer', -- ('peer', 'admin', 'member')
  status VARCHAR(10) DEFAULT 'active', -- ('active', 'pending')
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_cleared_at TIMESTAMP DEFAULT NULL,
  deleted_at TIMESTAMP DEFAULT NULL
);

-- ============================================================
-- CONVERSATION_INVITES
-- Menyimpan undangan masuk group chat yang dikirim oleh admin.
-- Berbeda dengan join via PIN yang langsung masuk sebagai pending,
-- invite dikirim langsung ke user tertentu oleh admin.
-- ============================================================
CREATE TABLE conversation_invites (
  id CHAR(15) NOT NULL PRIMARY KEY,
  conversation_id CHAR(15) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  invited_by CHAR(15) NOT NULL REFERENCES users(id),
  invited_user_id CHAR(15) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(10) DEFAULT 'pending', -- ('pending', 'accepted', 'rejected')
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MESSAGES
-- Menyimpan semua pesan di setiap percakapan.
-- Mendukung Reply dan Edit. Soft delete via deleted_at 
-- berlaku global — semua participant tidak bisa lihat pesan.
-- ============================================================
CREATE TABLE messages (
  id CHAR(15) NOT NULL PRIMARY KEY,
  conversation_id CHAR(15) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id CHAR(15) NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  reply_to_message_id CHAR(15) REFERENCES messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP DEFAULT NULL
);

-- ============================================================
-- MESSAGE_REACTIONS
-- Menyimpan reaksi emoji pada pesan.
-- Menggunakan ON DELETE CASCADE agar jika pesan dihapus permanen,
-- reaksinya ikut hilang. UNIQUE untuk upsert 1 user = 1 reaksi.
-- ============================================================
CREATE TABLE message_reactions (
  id CHAR(15) NOT NULL PRIMARY KEY,
  message_id CHAR(15) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id CHAR(15) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(15) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

-- ============================================================
-- MESSAGE_READS
-- Menyimpan status baca pesan per user.
-- UNIQUE(user_id, message_id) mencegah duplikat read receipt.
-- Hanya dibuat jika read_receipt user aktif.
-- ============================================================
CREATE TABLE message_reads (
  id CHAR(15) NOT NULL PRIMARY KEY,
  user_id CHAR(15) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id CHAR(15) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, message_id)
);

-- ============================================================
-- STORIES
-- Menyimpan status/story pengguna.
-- Mendukung konten media (gambar/video) atau teks dengan background.
-- Memiliki batas waktu tayang selama 24 jam.
-- ============================================================
CREATE TABLE stories (
  id CHAR(15) NOT NULL PRIMARY KEY,
  user_id CHAR(15) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_public_id VARCHAR(255) DEFAULT NULL,
  media_url VARCHAR(255) DEFAULT NULL,
  media_type VARCHAR(10) DEFAULT NULL,
  content_text VARCHAR(700) DEFAULT NULL,
  bg_color VARCHAR(10) DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STORY_VIEWS
-- Mencatat daftar pengguna yang telah melihat sebuah story.
-- UNIQUE(story_id, viewer_id) mencegah duplikat view per user.
-- ============================================================
CREATE TABLE story_views (
  id CHAR(15) NOT NULL PRIMARY KEY,
  story_id CHAR(15) NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id CHAR(15) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(story_id, viewer_id)
);

-- ============================================================
-- INDEXES
-- Mempercepat query yang sering digunakan di aplikasi.
-- ============================================================

-- Pencarian user by username, phone, dan pin
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_pin ON users(pin);

-- Verifikasi by user_id
CREATE INDEX idx_verifications_user_id ON verifications(user_id);

-- Friendships by requester, receiver, dan status
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_receiver ON friendships(receiver_id);
CREATE INDEX idx_friendships_status ON friendships(status);

-- Participant by user dan conversation
CREATE INDEX idx_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);

-- Participant by deleted_at untuk filter conversation aktif
CREATE INDEX idx_participants_deleted ON conversation_participants(deleted_at);

-- Messages by conversation dan sender
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Reactions by message
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);

-- Message reads by message
CREATE INDEX idx_message_reads_message ON message_reads(message_id);

-- Stories by user dan expires_at untuk filter feed aktif
CREATE INDEX idx_stories_user_expires ON stories(user_id, expires_at);

-- Mencegah race condition (A->B dan B->A) tumpang tindih
CREATE UNIQUE INDEX unique_friendship_pair ON friendships (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id));

-- Composite index untuk CTE last_messages dan unread_counts di findAllActiveByUser.
-- Partial index (WHERE deleted_at IS NULL) memperkecil ukuran index karena
-- mayoritas query hanya butuh pesan yang belum dihapus.
CREATE INDEX idx_messages_conv_sender
  ON messages(conversation_id, sender_id)
  WHERE deleted_at IS NULL;

-- Composite index untuk lookup unread per user di CTE unread_counts.
-- Menggantikan idx_message_reads_message yang hanya single-column
-- dan tidak optimal untuk filter tambahan user_id.
CREATE INDEX idx_message_reads_user
  ON message_reads(user_id, message_id);

-- Composite index untuk filter utama conversation list per user.
-- Mencakup semua kolom yang dipakai di WHERE dan IS ARCHIVED filter
-- sekaligus, menghindari index scan terpisah lalu filter ulang.
CREATE INDEX idx_participants_user_status
  ON conversation_participants(user_id, status, deleted_at, is_archived);

-- ============================================================
-- TRIGGERS
-- Auto update kolom updated_at setiap kali row diubah.
-- Fungsi update_timestamp() dipakai bersama oleh semua trigger.
-- ============================================================

-- Fungsi trigger untuk auto update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk tabel users
CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Trigger untuk tabel friendships
CREATE TRIGGER friendships_updated_at
BEFORE UPDATE ON friendships
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Trigger untuk tabel messages
CREATE TRIGGER messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION update_timestamp();