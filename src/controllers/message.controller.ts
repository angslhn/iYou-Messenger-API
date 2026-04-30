import * as MessageService from '@/services/message.service.js';

import type { Request, Response, NextFunction } from 'express';

/**
 * Menangani permintaan penghapusan pesan secara global (tarik pesan).
 *
 * @param {Request} req - Request dengan param id (messageId) dan JWT payload
 * @param {Response} res - Silent 200 jika berhasil atau tidak ada aksi yang diperlukan
 * @param {NextFunction} next - Error handler
 */
export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id as string;

    await MessageService.deleteMessage(userId, messageId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengeditan konten pesan yang sudah terkirim.
 * Hanya pengirim asli yang berhak mengubah isi pesan.
 *
 * @param {Request} req - Request dengan param id (messageId) dan body content
 * @param {Response} res - Silent 200 jika berhasil
 * @param {NextFunction} next - Error handler
 */
export const editMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id as string;
    const { content }: { content: string } = req.body;

    await MessageService.editMessage(userId, messageId, content);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pemberian reaksi (emoji) pada pesan.
 *
 * @param {Request} req - Request dengan param id (messageId) dan body reaction
 * @param {Response} res - Silent 200 jika berhasil
 * @param {NextFunction} next - Error handler
 */
export const reactToMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id as string;
    const { reaction }: { reaction: string } = req.body;

    await MessageService.reactToMessage(userId, messageId, reaction);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};
