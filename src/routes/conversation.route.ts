import { Router } from 'express';

import upload from '@/middlewares/upload.js';
import authorization from '@/middlewares/authorization.js';
import validation from '@/middlewares/validation.js';

import * as ConversationController from '@/controllers/conversation.controller.js';
import * as ConversationValidator from '@/validators/conversation.validator.js';

const routes = Router();

// GET /api/v1/conversations/invites - Mengambil semua daftar undangan group
routes.get('/invites', authorization, ConversationController.getPendingInvites);

// PATCH /api/v1/invites/:inviteId/accept - Menerima undangan group pengguna
routes.patch('/invites/:inviteId/accept', authorization, ConversationController.acceptGroupInvite);

// PATCH /api/v1/invites/:inviteId/reject - Menolak undangan group pengguna
routes.patch('/invites/:inviteId/reject', authorization, ConversationController.rejectGroupInvite);

// POST /api/v1/conversations/:id/participants - Menambahkan anggota baru ke dalam grup (Admin Only)
routes.post(
  '/join',
  authorization,
  validation([{ name: 'pin', type: 'string' }], ConversationValidator.joinGroup),
  ConversationController.joinGroup,
);

// POST /api/v1/conversations/group - Membuat grup percakapan baru
routes.post(
  '/group',
  authorization,
  upload('image'),
  validation(
    [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string', optional: true },
    ],
    ConversationValidator.createGroup,
  ),
  ConversationController.createGroup,
);

// GET /api/v1/conversations/private - Mengambil semua daftar percakapan private aktif pengguna
routes.get('/private', authorization, ConversationController.getConversations('private'));

// GET /api/v1/conversations/group - Mengambil semua daftar percakapan group aktif pengguna
routes.get('/group', authorization, ConversationController.getConversations('group'));

// GET /api/v1/conversations/private/archive - Mengambil semua daftar percakapan aktif yang diarsipkan pengguna
routes.get('/private/archive', authorization, ConversationController.getConversations('private'));

// GET /api/v1/conversations/group/archive - Mengambil semua daftar percakapan aktif yang diarsipkan pengguna
routes.get('/group/archive', authorization, ConversationController.getConversations('group'));

// GET /api/v1/conversations/:id/messages - Mengambil riwayat pesan dalam satu percakapan
routes.get('/:id/messages', authorization, ConversationController.getMessages);

// GET /api/v1/conversations/:id/info - Mengambil detail profil grup dan daftar anggota
routes.get('/:id/info', authorization, ConversationController.getGroupInfo);

// GET /api/v1/conversations/:id/participants - Mengambil daftar anggota dalam sebuah obrolan grup
routes.get('/:id/participants', authorization, ConversationController.getParticipants);

// POST /api/v1/conversations/:id/participants - Menambahkan anggota baru ke dalam grup (Admin Only)
routes.post(
  '/:id/participants',
  authorization,
  validation([{ name: 'targetUserId', type: 'string' }], ConversationValidator.addMember),
  ConversationController.addGroupMember,
);

// POST /api/v1/conversations/:id/invites - Mengundang user ke dalam grup (Admin Only)
routes.post(
  '/:id/invites',
  authorization,
  validation([{ name: 'targetUserId', type: 'string' }], ConversationValidator.addMember),
  ConversationController.inviteToGroup,
);

// PATCH /api/v1/conversations/:id/avatar - Memperbarui avatar grup (Admin Only)
routes.patch(
  '/:id/avatar',
  authorization,
  upload('image'),
  ConversationController.updateGroupAvatar,
);

// PATCH /api/v1/conversations/:id - Memperbarui nama dan deskripsi grup (Admin Only)
routes.patch('/:id', authorization, ConversationController.updateGroupInfo);

// PATCH /api/v1/conversations/:id/generate/pin - Men-generate ulang PIN grup percakapan (Admin Only)
routes.patch('/:id/generate/pin', authorization, ConversationController.generateGroupPin);

// PATCH /api/v1/conversations/:id/pin - Menyematkan/melepas sematan percakapan
routes.patch(
  '/:id/pin',
  authorization,
  validation([{ name: 'value', type: 'boolean' }], ConversationValidator.togglePreference),
  ConversationController.pinConversation,
);

// PATCH /api/v1/conversations/:id/archive - Mengarsipkan/mengembalikan percakapan
routes.patch(
  '/:id/archive',
  authorization,
  validation([{ name: 'value', type: 'boolean' }], ConversationValidator.togglePreference),
  ConversationController.archiveConversation,
);

// PATCH /api/v1/conversations/:id/mute - Membisukan/membunyikan notifikasi percakapan
routes.patch(
  '/:id/mute',
  authorization,
  validation([{ name: 'value', type: 'boolean' }], ConversationValidator.togglePreference),
  ConversationController.muteConversation,
);

// PATCH /api/v1/conversations/:id/clear - Membersihkan riwayat pesan dari layar user
routes.patch('/:id/clear', authorization, ConversationController.clearChat);

// DELETE /api/v1/conversations/:id/participants/:userId - Mengeluarkan anggota dari grup (Admin Only)
routes.delete('/:id/participants/:userId', authorization, ConversationController.removeGroupMember);

// DELETE /api/v1/conversations/:id/group - Menghapus grup secara permanen (Admin Only)
routes.delete('/:id/group', authorization, ConversationController.deleteGroup);

// DELETE /api/v1/conversations/:id/pin - Menghapus PIN dari grup percakapan (Admin Only)
routes.delete('/:id/pin', authorization, ConversationController.removeGroupPin);

// DELETE /api/v1/conversations/:id/leave - Keluar dari grup percakapan atas kemauan sendiri
routes.delete('/:id/leave', authorization, ConversationController.leaveGroup);

// DELETE /api/v1/conversations/:id - Menghapus (soft delete/clear) percakapan dari sisi pengguna
routes.delete('/:id', authorization, ConversationController.deleteConversation);

export default routes;
