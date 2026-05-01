import ResponseError from '@/utils/response-error.js';

import * as Story from '@/models/story.model.js';
import * as Friendship from '@/models/friendship.model.js';
import * as Generator from '@/helpers/generator.js';
import * as WsSender from '@/websocket/sender.ws.js';

import type { StoryGroup, StoryViewerData } from '@/models/story.model.js';

/**
 * Membuat story (status) baru untuk pengguna.
 * Story akan otomatis kedaluwarsa dalam 24 jam dari waktu pembuatan.
 * Menerima payload JSON murni setelah frontend melakukan direct upload ke Cloudinary.
 *
 * @param {string} userId - ID pengguna yang membuat story
 * @param {object} payload - Teks, warna background, dan data media dari Cloudinary
 * @returns {Promise<void>}
 * @throws {ResponseError} 400 - Jika story tidak memiliki konten media maupun teks
 */
export const createStory = async (
  userId: string,
  payload: {
    content_text?: string;
    bg_color?: string;
    media_url?: string;
    media_public_id?: string;
    media_type?: 'image' | 'video';
  },
): Promise<void> => {
  // Validasi Failsafe: Harus ada teks ATAU media
  if (!payload.media_url && !payload.content_text) {
    throw new ResponseError(400, 'Invalid Story', 'Story cannot be empty.');
  }

  const storyId = Generator.id();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  // Langsung simpan ke Database
  await Story.create({
    id: storyId,
    user_id: userId,
    media_public_id: payload.media_public_id || null,
    media_url: payload.media_url || null,
    media_type: payload.media_type || null,
    content_text: payload.content_text || null,
    bg_color: payload.bg_color || null,
    expires_at: expiresAt,
  });

  // Mempersiapkan notifikasi Real-Time (WebSocket) ke semua teman pengguna
  const friends = await Friendship.findAcceptedFriends(userId);

  const friendIds = friends.map((f) => f.id);

  // Mengirim ping (notifikasi ringan) agar UI frontend teman memunculkan
  // indikator "lingkaran status baru" pada foto profil pembuat story.
  WsSender.sendToMany(friendIds, {
    event: 'story:new',
    payload: { userId, storyId },
  });
};

/**
 * Mengambil daftar feed story yang masih aktif (belum kedaluwarsa).
 *
 * @param {string} userId - ID pengguna yang merequest feed
 * @returns {Promise<StoryGroup[]>} Daftar story aktif
 */
export const getFeed = async (userId: string): Promise<StoryGroup[]> => {
  return await Story.findActiveFeed(userId);
};

/**
 * Mengambil daftar teman yang melihat story dari pengguna.
 *
 * @param {string} storyId - ID story yang pengguna dicek pelihatnya
 * @returns {Promise<StoryViewerData[]>} Daftar semua teman yang telah melihat story dari pengguna
 */
export const getViewers = async (storyId: string): Promise<StoryViewerData[]> => {
  return await Story.getViewers(storyId);
};

/**
 * Mencatat bahwa pengguna telah melihat story tertentu.
 * Jika story sudah kedaluwarsa, proses pencatatan akan dibatalkan secara diam-diam (silent fail).
 *
 * @param {string} userId - ID pengguna yang melihat story
 * @param {string} storyId - ID story yang dilihat
 * @returns {Promise<void>}
 */
export const viewStory = async (userId: string, storyId: string): Promise<void> => {
  const story = await Story.findById(storyId);

  // Silent return jika story tidak eksis atau sudah melewati batas 24 jam
  if (!story || story.expires_at.getTime() < Date.now()) {
    return;
  }

  // Melakukan UPSERT ke tabel views
  await Story.viewStory(Generator.id(), storyId, userId);
};
