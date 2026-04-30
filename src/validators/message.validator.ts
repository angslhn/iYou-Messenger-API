import ResponseError from '@/utils/response-error.js';

import * as Input from '@/validators/input.validator.js';

/**
 * Memvalidasi data input untuk pengeditan konten pesan.
 * Memastikan konten baru tidak kosong atau melebihi batas.
 *
 * @param {Record<string, unknown>} data - Data body request
 * @throws {ResponseError} 400 - Jika konten pesan tidak valid
 */
export function editContent(data: Record<string, unknown>): void {
  const content = data.content as string;

  if (!content || content.trim().length === 0) {
    throw new ResponseError(
      400,
      'Invalid Message Content',
      'Message content cannot be empty. If you wish to remove the message, please use the delete feature instead.',
    );
  }

  if (content.trim().length > 2000) {
    throw new ResponseError(
      400,
      'Message Content Too Long',
      'The edited message content is too long. The maximum allowed length is 2000 characters.',
    );
  }
}

/**
 * Memvalidasi data input untuk pemberian reaksi pada pesan.
 * Memastikan reaksi (emoji) dikirim dengan benar dan 100% murni emoji.
 *
 * @param {Record<string, unknown>} data - Data body request
 * @throws {ResponseError} 400 - Jika reaksi tidak valid atau bukan emoji
 */
export function reactMessage(data: Record<string, unknown>): void {
  const reaction = data.reaction as string;

  // Jika string kosong, berarti user sedang melakukan "unreact", izinkan lewat.
  if (reaction === '') return;

  // Validasi apakah kosong
  if (!reaction || reaction.trim().length === 0) {
    throw new ResponseError(
      400,
      'Invalid Reaction',
      'A reaction emoji is required. Please provide a valid emoji character to react to this message.',
    );
  }

  // Validasi 100% Murni Emoji (Anti-Bypass Postman/cURL)
  const emojiVal = Input.emoji(reaction.trim());
  if (emojiVal) {
    throw new ResponseError(400, 'Invalid Reaction Format', emojiVal);
  }

  // Validasi batas panjang byte/karakter
  if (reaction.trim().length > 15) {
    throw new ResponseError(
      400,
      'Reaction Too Long',
      'The provided reaction sequence is too long. Only single emoji reactions are allowed.',
    );
  }
}
