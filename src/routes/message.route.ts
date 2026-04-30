import { Router } from 'express';

import authorization from '@/middlewares/authorization.js';
import validation from '@/middlewares/validation.js';

import * as MessageController from '@/controllers/message.controller.js';
import * as MessageValidator from '@/validators/message.validator.js';

const routes = Router();

// PATCH /api/v1/messages/:id/content - Mengedit konten pesan yang sudah terkirim
routes.patch(
  '/:id/content',
  authorization,
  validation([{ name: 'content', type: 'string' }], MessageValidator.editContent),
  MessageController.editMessage,
);

// PUT /api/v1/messages/:id/reactions - Memberikan atau memperbarui reaksi emoji pada pesan
routes.put(
  '/:id/reactions',
  authorization,
  validation([{ name: 'reaction', type: 'string' }], MessageValidator.reactMessage),
  MessageController.reactToMessage,
);

// DELETE /api/v1/messages/:id - Menghapus pesan untuk semua orang (soft delete global)
routes.delete('/:id', authorization, MessageController.deleteMessage);

export default routes;
