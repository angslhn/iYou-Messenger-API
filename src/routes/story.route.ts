import { Router } from 'express';

import * as StoryController from '@/controllers/story.controller.js';
import * as StoryValidator from '@/validators/story.validator.js';

import authorization from '@/middlewares/authorization.js';
import validation from '@/middlewares/validation.js';

const routes = Router();

// GET /api/v1/stories/feed - Mengambil semua status aktif milik pengguna dan teman-temannya
routes.get('/feed', authorization, StoryController.getFeed);

// GET /api/v1/stories/:id/viewers - Mengambil daftar viewers dari sebuah story
routes.get('/:id/viewers', authorization, StoryController.getViewers);

// POST /api/v1/stories/create - Membuat status baru (Teks atau Gambar/Video)
routes.post(
  '/create',
  authorization,
  validation(
    [
      { name: 'content_text', type: 'string', optional: true },
      { name: 'bg_color', type: 'string', optional: true },
      { name: 'media_url', type: 'string', optional: true },
      { name: 'media_public_id', type: 'string', optional: true },
      { name: 'media_type', type: 'string', optional: true },
    ],
    StoryValidator.createStory,
  ),
  StoryController.createStory,
);

// POST /api/v1/stories/:id/view - Menandai bahwa status tertentu telah dilihat oleh pengguna
routes.post('/:id/view', authorization, StoryController.viewStory);

export default routes;
