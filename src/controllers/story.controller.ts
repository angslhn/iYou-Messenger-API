import * as Story from '@/models/story.model.js';
import * as StoryService from '@/services/story.service.js';

import type { Request, Response, NextFunction } from 'express';

/**
 * Menangani permintaan pembuatan story (status) baru.
 *
 * @param {Request} req - Request berisi JSON (content_text, bg_color, media_url, dll)
 * @param {Response} res - Response 201 menandakan berhasil dibuat
 * @param {NextFunction} next - Error handler
 */
export const createStory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;

    // Menangkap payload yang sekarang murni berupa JSON
    const payload: {
      content_text?: string;
      bg_color?: string;
      media_url?: string;
      media_public_id?: string;
      media_type?: 'image' | 'video';
    } = req.body;

    // Lempar langsung ke Service, tanpa mem-passing buffer file lagi!
    await StoryService.createStory(userId, payload);

    res.status(201).json({
      title: 'Story Created',
      message:
        'Your story has been successfully updated and is now visible to your friends for the next 24 hours.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan pengambilan feed story dari teman-teman yang aktif.
 *
 * @param {Request} req - Request dengan JWT payload
 * @param {Response} res - Response 200 berisi array story
 * @param {NextFunction} next - Error handler
 */
export const getFeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    const feed = await StoryService.getFeed(userId);

    res.status(200).json(feed);
  } catch (err) {
    next(err);
  }
};

/**
 * Mengambil daftar penonton dari sebuah story spesifik.
 * @param {Request} req - Request dengan JWT payload
 * @param {Response} res - Response 200 berisi array story
 * @param {NextFunction} next - Error handler
 */
export const getViewers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const storyId = req.params.id as string;

    const story = await Story.findById(storyId);

    // Jika story tidak ditemukan ATAU yang request bukan pembuatnya
    if (!story || story.user_id !== userId) {
      return void res.status(200).json([]); // Kirim array kosong sebagai response
    }

    const viewers = await StoryService.getViewers(storyId);

    res.status(200).json(viewers);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan untuk menandai sebuah story telah dilihat (seen).
 *
 * @param {Request} req - Request dengan parameter ID story
 * @param {Response} res - Silent 200 jika sukses
 * @param {NextFunction} next - Error handler
 */
export const viewStory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const storyId = req.params.id as string;

    await StoryService.viewStory(userId, storyId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};
