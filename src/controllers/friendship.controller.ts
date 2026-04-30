import * as FriendshipService from '@/services/friendship.service.js';

import type { Request, Response, NextFunction } from 'express';

/**
 * Menangani permintaan pengiriman friend request via username atau phone.
 *
 * @param {Request} req - Request berisi identifier di body dan JWT payload di req.user
 * @param {Response} res - Response 200 jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const sendRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requesterId: string = req.user.id;
    const { identifier }: { identifier: string } = req.body;

    await FriendshipService.sendRequest(requesterId, identifier);

    res.status(200).json({
      title: 'Friend Request Sent',
      message: 'Your friend request has been sent successfully and is waiting for a response.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan tambah teman via PIN — langsung accepted.
 *
 * @param {Request} req - Request berisi pin di body dan JWT payload di req.user
 * @param {Response} res - Response 200 jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const addFriendByPin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requesterId: string = req.user.id;
    const { pin }: { pin: string } = req.body;

    await FriendshipService.addFriendByPin(requesterId, pin);

    res.status(200).json({
      title: 'Friend Added',
      message: 'The user has been successfully added to your friend list.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan menerima friend request.
 *
 * @param {Request} req - Request berisi friendshipId di params dan JWT payload di req.user
 * @param {Response} res - Silent 200 jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const acceptRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId: string = req.user.id;
    const friendshipId = req.params.id as string;

    await FriendshipService.acceptRequest(userId, friendshipId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan menolak friend request.
 *
 * @param {Request} req - Request berisi friendshipId di params dan JWT payload di req.user
 * @param {Response} res - Silent 200 jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const rejectRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId: string = req.user.id;
    const friendshipId = req.params.id as string;

    await FriendshipService.rejectRequest(userId, friendshipId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan unfriend.
 *
 * @param {Request} req - Request berisi friendshipId di params dan JWT payload di req.user
 * @param {Response} res - Silent 200 jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const unfriend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId: string = req.user.id;
    const friendshipId = req.params.id as string;

    await FriendshipService.unfriend(userId, friendshipId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan blokir user.
 *
 * @param {Request} req - Request berisi targetUserId di params dan JWT payload di req.user
 * @param {Response} res - Silent 200 jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const blockUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const blockerId: string = req.user.id;
    const targetUserId = req.params.userId as string;

    await FriendshipService.blockUser(blockerId, targetUserId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan unblock user.
 *
 * @param {Request} req - Request berisi friendshipId di params dan JWT payload di req.user
 * @param {Response} res - Silent 200 jika berhasil
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const unblockUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId: string = req.user.id;
    const friendshipId = req.params.id as string;

    await FriendshipService.unblockUser(userId, friendshipId);

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan mengambil semua teman yang sudah accepted.
 *
 * @param {Request} req - Request berisi JWT payload di req.user
 * @param {Response} res - Response 200 dengan daftar teman
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const getFriends = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId: string = req.user.id;

    const friends = await FriendshipService.getFriends(userId);

    res.status(200).json(friends);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan mengambil semua pending friend request yang masuk.
 *
 * @param {Request} req - Request berisi JWT payload di req.user
 * @param {Response} res - Response 200 dengan daftar pending request
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const getPendingRequests = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId: string = req.user.id;

    const requests = await FriendshipService.getPendingRequests(userId);

    res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
};

/**
 * Menangani permintaan mengambil semua teman yang diblokir pengguna.
 *
 * @param {Request} req - Request berisi JWT payload di req.user
 * @param {Response} res - Response 200 dengan daftar teman yang diblokir
 * @param {NextFunction} next - Meneruskan error ke global error handler
 */
export const getBlockedUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId: string = req.user.id;
    const blocked = await FriendshipService.getBlockedUsers(userId);

    res.status(200).json(blocked);
  } catch (err) {
    next(err);
  }
};
