import type WebSocket from 'ws';

/**
 * Manager untuk mengelola koneksi WebSocket yang aktif.
 * Menggunakan Map dengan userId sebagai key dan WebSocket instance sebagai value.
 * Satu user hanya bisa memiliki satu koneksi aktif pada satu waktu.
 */

// Map untuk menyimpan semua koneksi WebSocket aktif
// Key: userId (string), Value: WebSocket instance
const connections = new Map<string, WebSocket>();

/**
 * Menambahkan koneksi WebSocket baru ke dalam manager.
 * Jika user sudah memiliki koneksi aktif, koneksi lama akan ditutup terlebih dahulu.
 *
 * @param {string} userId - ID unik pengguna
 * @param {WebSocket} socket - Instance WebSocket yang aktif
 */
export const addConnection = (userId: string, socket: WebSocket): void => {
  const existingSocket = connections.get(userId);

  // Tutup koneksi lama jika user sudah terkoneksi sebelumnya (misal buka tab baru)
  if (existingSocket) {
    existingSocket.close();
  }

  connections.set(userId, socket);
};

/**
 * Menghapus koneksi WebSocket dari manager berdasarkan userId.
 *
 * @param {string} userId - ID unik pengguna yang disconnect
 */
export const removeConnection = (userId: string): void => {
  connections.delete(userId);
};

/**
 * Mengambil koneksi WebSocket aktif berdasarkan userId.
 *
 * @param {string} userId - ID unik pengguna
 * @returns {WebSocket | undefined} WebSocket instance jika ditemukan, undefined jika tidak
 */
export const getConnection = (userId: string): WebSocket | undefined => {
  return connections.get(userId);
};

/**
 * Mengecek apakah user sedang terkoneksi ke WebSocket server.
 *
 * @param {string} userId - ID unik pengguna
 * @returns {boolean} true jika user sedang online, false jika tidak
 */
export const isConnected = (userId: string): boolean => {
  return connections.has(userId);
};

/**
 * Mengambil semua userId yang sedang terkoneksi.
 *
 * @returns {string[]} Array berisi semua userId yang sedang online
 */
export const getAllConnectedUserIds = (): string[] => {
  return Array.from(connections.keys());
};
