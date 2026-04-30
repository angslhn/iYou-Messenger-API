import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/config/env.js';

/**
 * Instance Cloudinary yang telah dikonfigurasi untuk menangani upload dan manajemen aset media.
 */
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
