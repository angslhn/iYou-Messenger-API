/**
 * Rate limiter untuk WebSocket events.
 * Menggunakan in-memory Map dengan sliding window per user per event.
 * Tidak memerlukan dependency tambahan — murni Node.js built-in.
 *
 * Strategi: Fixed Window Counter
 * - Setiap user punya counter terpisah per event type
 * - Counter direset setiap windowMs
 * - Jika counter melebihi max, event ditolak
 */

/** Konfigurasi limit per event */
type RateLimitConfig = {
  max: number; // Maksimal request dalam satu window
  windowMs: number; // Durasi window dalam milidetik
};

/** State tracking per user per event */
type RateLimitEntry = {
  count: number;
  resetAt: number;
};

/**
 * Konfigurasi limit per event type.
 * Disesuaikan dengan beban operasi masing-masing event:
 * - message:send  → berat (DB write + broadcast) → limit ketat
 * - typing        → ringan (broadcast only) → limit longgar
 * - message:read  → medium (DB write) → limit sedang
 * - group actions → jarang dipanggil → limit sedang
 */
const RATE_LIMIT_CONFIG: Partial<Record<string, RateLimitConfig>> = {
  'message:send': { max: 5, windowMs: 1000 }, // 5 pesan/detik
  'message:read': { max: 10, windowMs: 1000 }, // 10 read receipt/detik
  'typing:start': { max: 2, windowMs: 1000 }, // 2x/detik (debounce di FE)
  'typing:stop': { max: 2, windowMs: 1000 }, // 2x/detik
  'group:delete': { max: 3, windowMs: 60000 }, // 3x/menit
  'group:leave': { max: 3, windowMs: 60000 }, // 3x/menit
};

/**
 * Map untuk menyimpan state rate limit.
 * Key format: `${userId}:${eventName}`
 * Contoh: `123456789012345:message:send`
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Mengecek apakah request dari user untuk event tertentu melebihi batas.
 * Mengembalikan false jika event tidak ada di config (tidak di-limit).
 *
 * @param {string} userId - ID pengguna
 * @param {string} event - Nama event WebSocket
 * @returns {boolean} true jika rate limited (harus ditolak), false jika masih boleh
 */
export const isRateLimited = (userId: string, event: string): boolean => {
  const config = RATE_LIMIT_CONFIG[event];

  // Event tidak ada di config → tidak di-limit, langsung lolos
  if (!config) return false;

  const key = `${userId}:${event}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Belum ada entry atau window sudah expired → reset counter
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return false;
  }

  // Masih dalam window — cek apakah sudah melebihi batas
  if (entry.count >= config.max) {
    return true; // Rate limited!
  }

  // Masih dalam batas → increment counter
  entry.count++;
  return false;
};

/**
 * Membersihkan entry yang sudah expired dari Map.
 * Dijalankan secara berkala untuk mencegah memory leak.
 * Dipanggil otomatis setiap 5 menit oleh startRateLimiterCleanup().
 */
const cleanupExpiredEntries = (): void => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.info(`[WS-LIMITER] Cleaned ${cleaned} expired rate limit entries`);
  }
};

/**
 * Memulai interval cleanup untuk mencegah memory leak pada rateLimitStore.
 * Harus dipanggil sekali saat aplikasi start.
 * Berjalan setiap 5 menit di background.
 */
export const startRateLimiterCleanup = (): void => {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
  console.info('[WS-LIMITER] Rate limiter cleanup job started');
};
