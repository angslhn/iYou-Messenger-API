import ResponseError from '@/utils/response-error.js';

/**
 * Memvalidasi data input untuk pembuatan story baru.
 * Memastikan bahwa background color tidak terlalu panjang, teks sesuai batas,
 * dan minimal mengirimkan salah satu (teks atau media).
 *
 * @param {Record<string, unknown>} data - Data body request
 * @throws {ResponseError} 400 - Jika format data story tidak valid
 */
export function createStory(data: Record<string, unknown>): void {
  const contentText = data.content_text as string | undefined;
  const bgColor = data.bg_color as string | undefined;
  const mediaUrl = data.media_url as string | undefined;

  // Minimal harus ada teks ATAU url media yang dikirim
  if (!contentText?.trim() && !mediaUrl?.trim()) {
    throw new ResponseError(
      400,
      'Invalid Story',
      'Story cannot be empty. Please provide text or media.',
    );
  }

  // Validasi panjang teks story (batasan UI seperti WhatsApp)
  if (contentText && contentText.trim().length > 700) {
    throw new ResponseError(
      400,
      'Content Too Long',
      'The text content for the story exceeds the maximum allowed length of 700 characters.',
    );
  }

  // Validasi format background color (biasanya format HEX: #FFFFFF)
  if (bgColor && bgColor.trim().length > 10) {
    throw new ResponseError(
      400,
      'Invalid Background Color',
      'The background color format is invalid.',
    );
  }

  const mediaType = data.media_type as string | undefined;

  if (mediaType && !['image', 'video'].includes(mediaType)) {
    throw new ResponseError(400, 'Invalid Media Type', 'Media type must be image or video.');
  }
}
