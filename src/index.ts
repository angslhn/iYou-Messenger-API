import http from 'http';
import app from '@/app.js';

import { env } from '@/config/env.js';
import { initWsServer } from '@/websocket/server.ws.js';

import { startRateLimiterCleanup } from '@/websocket/rate-limiter.ws.js';
import { startStoryCleanupJob } from '@/jobs/story-cleanup.job.js';

// Bungkus Express app ke dalam HTTP server
// agar WebSocket bisa share port yang sama
const httpServer = http.createServer(app);

// Inisialisasi WebSocket server
initWsServer(httpServer);

// Dipanggil sekali, dan akan berjalan di background selamanya
startStoryCleanupJob();

// Membatasi abuse setiap event di WebSocket
startRateLimiterCleanup();

// Jalankan server
httpServer.listen(env.PORT, () => {
  console.info(`[SERVER] Running on port ${env.PORT}`);
});
