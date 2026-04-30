import multer from 'multer';
import ResponseError from '@/utils/response-error.js';

import type { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ResponseError(
        400,
        'Invalid File Format',
        'The uploaded file format is not supported. Please upload an image (JPG/PNG/WEBP) or a video (MP4/WEBM/MOV).',
      ),
    );
  }
};

// Pindahkan inisialisasi Multer ke LUAR fungsi agar hanya dibuat sekali
const mediaUploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 4, // 4MB
  },
});

const upload = (field: 'media' | 'image') => (req: Request, res: Response, next: NextFunction) => {
  // Panggil instance yang sudah dibuat di atas
  const uploadMiddleware = mediaUploader.single(field);

  uploadMiddleware(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ResponseError(
            413,
            'File Too Large',
            'The file size exceeds the maximum limit of 4MB. Please compress your file before uploading.',
          ),
        );
      }
      return next(new ResponseError(400, 'Upload Error', err.message));
    }

    if (err) {
      return next(err);
    }

    next();
  });
};

export default upload;
