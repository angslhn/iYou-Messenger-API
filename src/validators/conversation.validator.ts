import ResponseError from '@/utils/response-error.js';

import * as Input from '@/validators/input.validator.js';

/**
 * Memvalidasi data input untuk pembaruan preferensi percakapan (pin, archive, mute).
 * Memastikan nilai yang dikirim adalah boolean yang valid.
 *
 * @param {Record<string, unknown>} data - Data body request
 * @throws {ResponseError} 400 - Jika nilai bukan boolean
 */
export function togglePreference(data: Record<string, unknown>): void {
  const booleanVal = Input.boolean(data.value as boolean);

  if (booleanVal) throw new ResponseError(400, 'Invalid Preference Value', booleanVal);
}

/**
 * Memvalidasi data input untuk pembuatan grup percakapan baru.
 * Memastikan nama grup tidak kosong.
 *
 * @param {Record<string, unknown>} data - Data body request
 * @throws {ResponseError} 400 - Jika nama grup tidak valid atau kosong
 */
export function createGroup(data: Record<string, unknown>): void {
  const name = data.name as string;

  if (!name || name.trim().length === 0) {
    throw new ResponseError(
      400,
      'Invalid Group Name',
      'The group name is required and cannot be empty. Please provide a valid name to create the group.',
    );
  }

  if (name.length > 255) {
    throw new ResponseError(
      400,
      'Group Name Too Long',
      'The group name exceeds the maximum allowed length of 255 characters.',
    );
  }
}

/**
 * Memvalidasi data input untuk penambahan anggota baru ke dalam grup.
 *
 * @param {Record<string, unknown>} data - Data body request
 * @throws {ResponseError} 400 - Jika ID pengguna target tidak valid
 */
export function addMember(data: Record<string, unknown>): void {
  const targetUserId = data.targetUserId as string;

  if (!targetUserId || targetUserId.trim().length === 0) {
    throw new ResponseError(
      400,
      'Invalid User ID',
      'The target user ID is required to add a member to the group.',
    );
  }
}

/**
 * Memvalidasi data input untuk bergabung ke grup menggunakan PIN.
 * Memastikan PIN sesuai dengan format (8 karakter huruf kapital & angka).
 *
 * @param {Record<string, unknown>} data - Data body request
 * @throws {ResponseError} 400 - Jika format PIN tidak valid
 */
export function joinGroup(data: Record<string, unknown>): void {
  const pin = data.pin as string;

  if (!pin) {
    throw new ResponseError(400, 'Invalid Data', 'PIN is required to join a group.');
  }

  const pinVal = Input.pin(pin.trim());

  if (pinVal) {
    throw new ResponseError(400, 'Invalid PIN', pinVal);
  }
}
