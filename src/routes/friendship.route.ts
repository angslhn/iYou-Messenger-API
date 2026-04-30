import { Router } from 'express';

import authorization from '@/middlewares/authorization.js';
import validation from '@/middlewares/validation.js';

import * as FriendshipController from '@/controllers/friendship.controller.js';
import * as FriendshipValidator from '@/validators/friendship.validator.js';

const routes = Router();

// GET /api/v1/friendships — List semua teman dengan status 'accepted'
routes.get('/', authorization, FriendshipController.getFriends);

// GET /api/v1/friendships/requests — Ambil semua 'pending request' yang masuk ke user
routes.get('/requests', authorization, FriendshipController.getPendingRequests);

// GET /api/v1/friendships/blocked — Ambil semua user yang diblokir
routes.get('/blocked', authorization, FriendshipController.getBlockedUsers);

// POST /api/v1/friendships/request — Kirim 'friend request' lewat username atau nomor telepon
routes.post(
  '/request',
  authorization,
  validation([{ name: 'identifier', type: 'string' }], FriendshipValidator.sendRequest),
  FriendshipController.sendRequest,
);

// POST /api/v1/friendships/pin — Tambah teman via PIN (langsung 'accepted' tanpa request)
routes.post(
  '/pin',
  authorization,
  validation([{ name: 'pin', type: 'string' }], FriendshipValidator.addFriendByPin),
  FriendshipController.addFriendByPin,
);

// PATCH /api/v1/friendships/:id/accept — Terima 'friend request' berdasarkan ID pertemanan
routes.patch('/:id/accept', authorization, FriendshipController.acceptRequest);

// PATCH /api/v1/friendships/:id/reject — Tolak 'friend request' yang masuk
routes.patch('/:id/reject', authorization, FriendshipController.rejectRequest);

// PATCH /api/v1/friendships/block/:userId — Blokir user secara spesifik menggunakan 'userId'
routes.patch('/block/:userId', authorization, FriendshipController.blockUser);

// PATCH /api/v1/friendships/:id/unblock — Buka blokir user berdasarkan 'friendshipId'
routes.patch('/:id/unblock', authorization, FriendshipController.unblockUser);

// DELETE /api/v1/friendships/:id — Hapus pertemanan atau 'unfriend'
routes.delete('/:id', authorization, FriendshipController.unfriend);

export default routes;
