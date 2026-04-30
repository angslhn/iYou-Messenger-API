import ResponseError from '@/utils/response-error.js';

import * as Input from '@/validators/input.validator.js';

/**
 * Memvalidasi data input untuk kirim friend request via username atau phone.
 * Identifier bisa berupa username (tanpa +) atau phone (diawali +).
 *
 * @param {Record<string, unknown>} data - Data body request
 */
export function sendRequest(data: Record<string, unknown>): void {
  const identifierVal = Input.identifier((data.identifier as string).trim());

  if (identifierVal) throw new ResponseError(400, 'Invalid Identifier', identifierVal);
}

/**
 * Memvalidasi data input untuk tambah teman via PIN.
 *
 * @param {Record<string, unknown>} data - Data body request
 */
export function addFriendByPin(data: Record<string, unknown>): void {
  const pinVal = Input.pin((data.pin as string).trim());

  if (pinVal) throw new ResponseError(400, 'Invalid PIN', pinVal);
}
