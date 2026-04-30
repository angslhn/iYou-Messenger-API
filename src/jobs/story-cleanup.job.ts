import cron from 'node-cron';
import cloudinary from '@/lib/cloudinary.js';

import * as Story from '@/models/story.model.js';

/**
 * Pekerjaan latar belakang (Background Job) untuk membersihkan Story yang sudah kedaluwarsa.
 * Berjalan secara otomatis setiap 1 jam sekali.
 */
export const startStoryCleanupJob = () => {
  // Format Cron: '0 * * * *' artinya berjalan tepat di menit ke-0 setiap jam
  // (misal: 12:00, 13:00, 14:00, dst)
  cron.schedule('0 * * * *', async () => {
    console.info('[CRON] Starting expired stories cleanup process');

    try {
      // 1. Cari semua story yang jamnya sudah lewat dari sekarang
      const expiredStories = await Story.findExpired();

      if (expiredStories.length === 0) {
        console.info('[CRON] No expired stories found');
        return;
      }

      // 2. Loop dan hapus file fisiknya dari Cloudinary (jika ada)
      for (const story of expiredStories) {
        if (story.media_public_id) {
          try {
            // Cloudinary API untuk menghapus file berdasarkan public_id
            await cloudinary.uploader.destroy(story.media_public_id);
            console.info(`[CLOUDINARY] Deleted file ${story.media_public_id}`);
          } catch (cloudErr) {
            console.error(`[CLOUDINARY] Failed to delete ${story.media_public_id}`, cloudErr);
            // Tetap lanjut ke file berikutnya meskipun 1 gagal
          }
        }
      }

      // 3. Hapus baris datanya dari database PostgreSQL
      const rowCount = await Story.deleteExpired();

      console.info(`[CRON] Successfully deleted ${rowCount} expired stories from Database`);
    } catch (err) {
      console.error('[CRON] Failed to run story cleanup job:', err);
    }
  });
};
