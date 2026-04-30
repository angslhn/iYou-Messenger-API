import * as ConversationService from '@/services/conversation.service.js';

import type { Request, Response, NextFunction } from 'express';

/**
 * Menangani permintaan pengambilan semua daftar percakapan aktif untuk 'private' atau 'group' bahkan yang di arsipkan pengguna.
 *
 * @param {'private' | 'group'} type - Tipe percakapan aktif
 */
export const getConversations = (type: 'private' | 'group') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;

      const isArchived = req.path.endsWith('/archive');

      const conversations = await ConversationService.getConversations(userId, type, isArchived);

      res.status(200).json(conversations);
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Menangani permintaan pengguna untuk pengambilan semua daftar undangan group.
 *
 * @param {Request} req - Request dengan JWT payload
 * @param {Response} res - Response 200 berisi daftar percakapan
 * @param {NextFunction} next - Error handler
 */
export const getPendingInvites = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;

    const invites = await ConversationService.getPendingInvites(userId);

    res.status(200).json(invites);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengguna untuk menerima undangan group.
 *
 * @param {Request} req - Request dengan JWT payload
 * @param {Response} res - Response 200 berisi daftar percakapan
 * @param {NextFunction} next - Error handler
 */
export const acceptGroupInvite = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const inviteId = req.params.inviteId as string;

    await ConversationService.acceptGroupInvite(userId, inviteId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan untuk mengunggah dan memperbarui avatar grup.
 * Mengharuskan request memiliki file gambar multipart/form-data.
 *
 * @param {Request} req - Request dengan param id (grup) dan req.file dari multer
 * @param {Response} res - Response 200 berisi JSON dengan { avatarUrl }
 * @param {NextFunction} next - Error handler
 * @returns {Promise<void>}
 */
export const updateGroupAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const adminId = req.user.id;
    const conversationId = req.params.id as string;

    // Menangkap buffer dari middleware multer (upload.single('image'))
    const fileBuffer = req.file?.buffer;

    const avatarUrl = await ConversationService.updateGroupAvatar(
      adminId,
      conversationId,
      fileBuffer,
    );

    res.status(200).json({ avatarUrl });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengambilan profil grup beserta daftar anggotanya.
 *
 * @param {Request} req - Request dari client dengan parameter id grup
 * @param {Response} res - Response 200 berisi data profil grup
 * @param {NextFunction} next - Error handler
 * @returns {Promise<void>}
 */
export const getGroupInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;

    const groupInfo = await ConversationService.getGroupInfo(userId, conversationId);

    res.status(200).json(groupInfo);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan untuk memperbarui informasi dasar grup (nama & deskripsi).
 *
 * @param {Request} req - Request dengan param id (grup) dan body { name, description }
 * @param {Response} res - Response 200 OK
 * @param {NextFunction} next - Error handler
 * @returns {Promise<void>}
 */
export const updateGroupInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const adminId = req.user.id;
    const conversationId = req.params.id as string;
    const { name, description } = req.body;

    await ConversationService.updateGroupInfo(adminId, conversationId, { name, description });

    res.status(200).json({
      message: 'Group information updated successfully.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan admin untuk mengundang user ke dalam grup.
 *
 * @param {Request} req - Request dengan param id (grup) dan body targetUserId
 * @param {Response} res - Response 201 Created
 * @param {NextFunction} next - Error handler
 */
export const inviteToGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const adminId = req.user.id;
    const conversationId = req.params.id as string;
    const { targetUserId }: { targetUserId: string } = req.body;

    await ConversationService.sendGroupInvite(adminId, conversationId, targetUserId);

    res.status(201).json({
      message: 'Group invitation sent successfully.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan untuk men-generate ulang PIN tautan grup.
 * Membutuhkan hak akses Administrator.
 *
 * @param {Request} req - Request dengan param id (grup)
 * @param {Response} res - Response 200 berisi JSON dengan PIN baru
 * @param {NextFunction} next - Error handler
 * @returns {Promise<void>}
 */
export const generateGroupPin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const adminId = req.user.id;
    const conversationId = req.params.id as string;

    const pin = await ConversationService.generateGroupPin(adminId, conversationId);

    // Mengirim pin kembali agar Frontend bisa langsung update UI tanpa perlu fetch ulang profil
    res.status(200).json({ pin });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani bergabungnya pengguna kedalam grup dengan menggunakan PIN unik yang diberikan oleh admin.
 *
 * @param {Request} req - Request dengan JWT payload
 * @param {Response} res - Response 200 berhasil bergabung kedalam grup
 * @param {NextFunction} next - Error handler
 * @returns {Promise<void>}
 */
export const joinGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { pin }: { pin: string } = req.body;

    const groupId = await ConversationService.joinGroupByPin(userId, pin);

    res.status(200).json({
      message: 'Successfully joined the group.',
      data: { id: groupId },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan untuk menghapus/menonaktifkan PIN grup.
 * Membutuhkan hak akses Administrator.
 *
 * @param {Request} req - Request dengan param id (grup)
 * @param {Response} res - Silent 200
 * @param {NextFunction} next - Error handler
 * @returns {Promise<void>}
 */
export const removeGroupPin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const adminId = req.user.id;
    const conversationId = req.params.id as string;

    await ConversationService.removeGroupPin(adminId, conversationId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengguna untuk menolak undangan group.
 *
 * @param {Request} req - Request dengan JWT payload
 * @param {Response} res - Response 200 berisi daftar percakapan
 * @param {NextFunction} next - Error handler
 */
export const rejectGroupInvite = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const inviteId = req.params.inviteId as string;

    await ConversationService.rejectGroupInvite(userId, inviteId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengambilan riwayat pesan dalam satu percakapan.
 * Mendukung pagination dengan query limit dan offset.
 *
 * @param {Request} req - Request dengan param id dan query limit, offset
 * @param {Response} res - Response 200 berisi daftar pesan
 * @param {NextFunction} next - Error handler
 */
export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await ConversationService.getMessages(userId, conversationId, limit, offset);

    res.status(200).json(messages);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengambilan daftar anggota obrolan.
 *
 * @param {Request} req - Request dengan param id percakapan
 * @param {Response} res - Response 200 berisi daftar partisipan
 * @param {NextFunction} next - Error handler
 */
export const getParticipants = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;

    const participants = await ConversationService.getParticipants(userId, conversationId);

    res.status(200).json(participants);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan menyematkan (pin) atau melepas sematan percakapan.
 *
 * @param {Request} req - Request dengan param id dan body value
 * @param {Response} res - Silent 200
 * @param {NextFunction} next - Error handler
 */
export const pinConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;
    const { value }: { value: boolean } = req.body;

    await ConversationService.pinConversation(userId, conversationId, value);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan mengarsipkan (archive) percakapan.
 *
 * @param {Request} req - Request dengan param id dan body value
 * @param {Response} res - Silent 200
 * @param {NextFunction} next - Error handler
 */
export const archiveConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;
    const { value }: { value: boolean } = req.body;

    await ConversationService.archiveConversation(userId, conversationId, value);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan membisukan (mute) notifikasi percakapan.
 *
 * @param {Request} req - Request dengan param id dan body value
 * @param {Response} res - Silent 200
 * @param {NextFunction} next - Error handler
 */
export const muteConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;
    const { value }: { value: boolean } = req.body;

    await ConversationService.muteConversation(userId, conversationId, value);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan penghapusan (soft delete/clear chat) percakapan oleh pengguna.
 * Percakapan hanya dihapus dari sisi pengguna tersebut.
 *
 * @param {Request} req - Request dengan param id
 * @param {Response} res - Silent 200
 * @param {NextFunction} next - Error handler
 */
export const deleteConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;

    await ConversationService.deleteConversation(userId, conversationId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pembersihan riwayat obrolan (Clear Chat) oleh pengguna.
 *
 * @param {Request} req - Request dengan param id
 * @param {Response} res - Response 200 OK
 * @param {NextFunction} next - Error handler
 */
export const clearChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;

    await ConversationService.clearChat(userId, conversationId);

    res.status(200).json({
      message: 'Chat history cleared successfully.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pembuatan grup percakapan baru.
 *
 * @param {Request} req - Request dengan body name dan description
 * @param {Response} res - Response 201 berisi ID grup yang baru dibuat
 * @param {NextFunction} next - Error handler
 */
export const createGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const creatorId = req.user.id;
    const { name, description } = req.body;

    const fileBuffer = req.file?.buffer;

    const groupId = await ConversationService.createGroup(creatorId, name, description, fileBuffer);

    res.status(201).json({
      message: 'Group created successfully',
      data: { id: groupId },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan penambahan anggota baru ke dalam grup.
 * Membutuhkan hak akses Administrator.
 *
 * @param {Request} req - Request dengan param id (grup) dan body targetUserId
 * @param {Response} res - Silent 200
 * @param {NextFunction} next - Error handler
 */
export const addGroupMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const adminId = req.user.id;
    const conversationId = req.params.id as string;
    const { targetUserId }: { targetUserId: string } = req.body;

    await ConversationService.addGroupMember(adminId, conversationId, targetUserId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengeluaran (kick) anggota dari grup.
 * Membutuhkan hak akses Administrator.
 *
 * @param {Request} req - Request dengan param id (grup) dan userId (anggota yang dikick)
 * @param {Response} res - Silent 200
 * @param {NextFunction} next - Error handler
 */
export const removeGroupMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const adminId = req.user.id;
    const conversationId = req.params.id as string;
    const targetUserId = req.params.userId as string;

    await ConversationService.removeGroupMember(adminId, conversationId, targetUserId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengguna untuk keluar dari grup percakapan.
 *
 * @param {Request} req - Request dengan param id
 * @param {Response} res - Silent 200
 * @param {NextFunction} next - Error handler
 */
export const leaveGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;

    await ConversationService.leaveGroup(userId, conversationId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan penghapusan grup percakapan secara permanen (Hard Delete).
 * Membutuhkan hak akses Administrator.
 *
 * @param {Request} req - Request dengan param id
 * @param {Response} res - Silent 200
 * @param {NextFunction} next - Error handler
 */
export const deleteGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id as string;

    await ConversationService.deleteGroup(userId, conversationId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};
