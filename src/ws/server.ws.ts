import jsonwebtoken from 'jsonwebtoken';

import { parse } from 'cookie';
import { WebSocketServer } from 'ws';
import { env } from '@/config/env.js';

import * as WsManager from '@/lib/ws.js';
import * as WsHandler from '@/ws/handler.ws.js';
import * as User from '@/models/user.model.js';

import type { Server } from 'http';
import type { UserToken } from '@/@types/globals.js';

/**
 * Menginisialisasi WebSocket server dan menggabungkannya dengan HTTP server Express.
 * Menggunakan cookie JWT untuk autentikasi saat handshake.
 * Semua event dari client diproses oleh WsHandler.
 *
 * @param {Server} httpServer - Instance HTTP server dari Express
 * @throws {Error} Jika JWT tidak valid atau user tidak ditemukan saat handshake (koneksi ditutup dengan kode 1008)
 */
export const initWsServer = (httpServer: Server): void => {
  const wss = new WebSocketServer({
    server: httpServer,

    // Tambahkan verifyClient untuk mencegat Handshake
    verifyClient: (info, done) => {
      const origin = info.origin;

      // Cek apakah header Origin ada, Browser modern pasti mengirimkan Origin saat koneksi WebSocket.
      if (!origin) {
        console.info('[WS] Rejected: No Origin header');
        return done(false, 401, 'Unauthorized'); // Tolak koneksi
      }

      // Validasi apakah Origin berasal dari Frontend resmi
      if (origin !== env.CLIENT_ORIGIN) {
        console.info(`[WS] Rejected: Invalid origin (${origin})`);
        return done(false, 403, 'Forbidden'); // Tolak koneksi
      }

      // Jika Origin valid, izinkan koneksi berlanjut ke tahap autentikasi Token
      done(true);
    },
  });

  console.info('[WS] WebSocket server initialized');

  wss.on('connection', async (socket, req) => {
    let userId: string;
    let decoded: { id: string; exp: number };

    try {
      // Ambil cookie dari request header saat handshake
      const cookies = parse(req.headers.cookie ?? '');
      const jwtToken = cookies[env.AUTH_COOKIE_NAME];

      // Tolak koneksi jika tidak ada cookie JWT
      if (!jwtToken) {
        socket.close(1008, 'Unauthorized: No token provided');
        return;
      }

      // Verifikasi JWT token
      decoded = jsonwebtoken.verify(jwtToken, env.JWT_SECRET) as UserToken & {
        id: string;
        exp: number;
      };

      userId = decoded.id;

      // Cek apakah user ada, tidak dihapus, dan sudah terverifikasi
      const user = await User.findById(userId);

      if (!user || user.deleted_at) {
        socket.close(1008, 'Unauthorized: User not found');
        return;
      }

      if (!user.is_verify) {
        socket.close(1008, 'Unauthorized: Account not verified');
        return;
      }
    } catch {
      socket.close(1008, 'Unauthorized: Invalid token');
      return;
    }

    // Pasang "Bom Waktu" untuk memutus koneksi saat JWT expired
    // exp dari JWT menggunakan format detik (seconds), jadi harus dikali 1000 untuk jadi milidetik
    const timeUntilExpiry = decoded.exp * 1000 - Date.now();

    // Pastikan waktunya belum terlewat (jaga-jaga)
    if (timeUntilExpiry > 0) {
      setTimeout(() => {
        // Jika socket masih terbuka saat waktu habis, tutup paksa!
        if (socket.readyState === socket.OPEN) {
          socket.close(1008, 'Session expired: Please login again');
          console.info(`[WS] Connection closed for user ${userId} due to JWT expiration`);
        }
      }, timeUntilExpiry);
    } else {
      socket.close(1008, 'Unauthorized: Token already expired');
      return;
    }

    // Simpan koneksi ke manager — koneksi lama otomatis ditutup jika ada
    WsManager.addConnection(userId, socket);

    await WsHandler.handleConnect(userId);

    console.info(`[WS] User ${userId} connected`);

    // Event ketika client mengirim pesan/event
    socket.on('message', async (rawData) => {
      try {
        await WsHandler.handleMessage(userId, rawData);
      } catch {
        console.error(`[WS] Message error — user ${userId}`);
      }
    });

    // Event ketika koneksi terputus
    socket.on('close', async () => {
      try {
        // Hanya proses disconnect jika socket yang mati adalah socket yang sedang aktif
        const activeSocket = WsManager.getConnection(userId);

        if (activeSocket === socket) {
          await WsHandler.handleDisconnect(userId);
          console.info(`[WS] User ${userId} disconnected`);
        }
      } catch {
        console.error(`[WS] Disconnect error — user ${userId}`);
      }
    });

    // Event ketika terjadi error pada koneksi
    socket.on('error', async () => {
      console.error(`[WS] Socket error — user ${userId}`);

      try {
        const activeSocket = WsManager.getConnection(userId);

        if (activeSocket === socket) {
          await WsHandler.handleDisconnect(userId);
        }
      } catch {
        console.error(`[WS] Disconnect error after socket error — user ${userId}`);
      }
    });
  });
};
