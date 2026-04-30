import { Router } from 'express';

import authRoutes from '@/routes/auth.route.js';
import userRoutes from '@/routes/user.route.js';
import friendshipRoutes from '@/routes/friendship.route.js';
import conversationRoutes from '@/routes/conversation.route.js';
import messageRoutes from '@/routes/message.route.js';
import storyRoutes from '@/routes/story.route.js';

const routes = Router();

// Route group untuk semua fitur autentikasi (login, register, dll.)
routes.use('/auth', authRoutes);

// Route group untuk manajemen profile dan data pengguna
routes.use('/users', userRoutes);

// Route group untuk fitur pertemanan, request, dan blocking
routes.use('/friendships', friendshipRoutes);

// Route group untuk manajemen percakapan dan grup
routes.use('/conversations', conversationRoutes);

// Route group untuk aksi spesifik pada pesan
routes.use('/messages', messageRoutes);

// Route group untuk fitur status
routes.use('/stories', storyRoutes);

export default routes;
