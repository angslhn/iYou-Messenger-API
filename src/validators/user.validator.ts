import ResponseError from '@/utils/response-error.js';

import * as Input from '@/validators/input.validator.js';

/**
 * Memvalidasi data input untuk pencarian pengguna berdasarkan username.
 * @param {Record<string, unknown>} data - Data query request
 */
export function searchUser(data: Record<string, unknown>): void {
  const queryVal = Input.identifier((data.q as string).trim());

  if (queryVal) throw new ResponseError(400, 'Invalid Search Query', queryVal);
}

/**
 * Memvalidasi data input untuk pencarian pengguna berdasarkan PIN.
 * @param {Record<string, unknown>} data - Data body request
 */
export function findUserByPin(data: Record<string, unknown>): void {
  const pinVal = Input.pin((data.pin as string).trim());

  if (pinVal) throw new ResponseError(400, 'Invalid PIN', pinVal);
}

/**
 * Memvalidasi data input untuk pencarian pengguna berdasarkan nomor telepon.
 * @param {Record<string, unknown>} data - Data body request
 */
export function findUserByPhone(data: Record<string, unknown>): void {
  const phoneVal = Input.phone((data.phone as string).trim());

  if (phoneVal) throw new ResponseError(400, 'Invalid Phone Number', phoneVal);
}

/**
 * Memvalidasi data input untuk pembaruan profil pengguna.
 * Minimal satu field harus ada.
 * @param {Record<string, unknown>} data - Data body request
 */
export function updateProfile(data: Record<string, unknown>): void {
  if (!data.fullname && !data.about) {
    throw new ResponseError(
      400,
      'Invalid Data',
      'At least one field (fullname or about) must be provided',
    );
  }

  if (data.fullname) {
    const fullnameVal = Input.fullname((data.fullname as string).trim());

    if (fullnameVal) throw new ResponseError(400, 'Invalid Full Name', fullnameVal);
  }

  if (data.about) {
    const aboutVal = Input.about((data.about as string).trim());

    if (aboutVal) throw new ResponseError(400, 'Invalid About', aboutVal);
  }
}

/**
 * Memvalidasi data input untuk pembaruan username pengguna.
 * @param {Record<string, unknown>} data - Data body request
 */
export function updateUsername(data: Record<string, unknown>): void {
  const usernameVal = Input.username((data.username as string).trim());

  if (usernameVal) throw new ResponseError(400, 'Invalid Username', usernameVal);
}

/**
 * Memvalidasi data input untuk pembaruan email pengguna.
 * @param {Record<string, unknown>} data - Data body request
 */
export function updateEmail(data: Record<string, unknown>): void {
  const emailVal = Input.email((data.email as string).trim());

  if (emailVal) throw new ResponseError(400, 'Invalid Email', emailVal);
}

/**
 * Memvalidasi data input untuk verifikasi OTP perubahan email.
 * @param {Record<string, unknown>} data - Data body request
 */
export function verifyUpdateEmail(data: Record<string, unknown>): void {
  const tokenVal = Input.token((data.token as string).trim());

  if (tokenVal) throw new ResponseError(400, 'Invalid Token', tokenVal);

  const otpVal = Input.otp((data.otp as string).trim());

  if (otpVal) throw new ResponseError(400, 'Invalid OTP', otpVal);
}

/**
 * Memvalidasi data input untuk pembaruan nomor telepon pengguna.
 * @param {Record<string, unknown>} data - Data body request
 */
export function updatePhone(data: Record<string, unknown>): void {
  const phoneVal = Input.phone((data.phone as string).trim());

  if (phoneVal) throw new ResponseError(400, 'Invalid Phone Number', phoneVal);
}

/**
 * Memvalidasi data input untuk verifikasi OTP perubahan nomor telepon.
 * @param {Record<string, unknown>} data - Data body request
 */
export function verifyUpdatePhone(data: Record<string, unknown>): void {
  const tokenVal = Input.token((data.token as string).trim());

  if (tokenVal) throw new ResponseError(400, 'Invalid Token', tokenVal);

  const otpVal = Input.otp((data.otp as string).trim());

  if (otpVal) throw new ResponseError(400, 'Invalid OTP', otpVal);
}

/**
 * Memvalidasi data input untuk proses resend OTP.
 * @param {Record<string, unknown>} data - Data body request
 */
export function resend(data: Record<string, unknown>): void {
  const emailVal = Input.email((data.email as string).trim());

  if (emailVal) throw new ResponseError(400, 'Invalid Email', emailVal);
}

/**
 * Memvalidasi data input untuk pembaruan password pengguna.
 * @param {Record<string, unknown>} data - Data body request
 */
export function updatePassword(data: Record<string, unknown>): void {
  const currentPasswordVal = Input.password((data.current_password as string).trim());

  if (currentPasswordVal)
    throw new ResponseError(400, 'Invalid Current Password', currentPasswordVal);

  const newPasswordVal = Input.password((data.new_password as string).trim());

  if (newPasswordVal) throw new ResponseError(400, 'Insecure New Password', newPasswordVal);
}

/**
 * Memvalidasi data input untuk pembaruan menyembunyikan profil pengguna dari pencarian.
 * @param {Record<string, unknown>} data - Data body request
 */
export function updateHideProfile(data: Record<string, unknown>): void {
  const booleanVal = Input.boolean(data.value as boolean);

  if (booleanVal) throw new ResponseError(400, 'Invalid Value', booleanVal);
}

/**
 * Memvalidasi data input untuk pembaruan terakhir dilihat pengguna.
 * @param {Record<string, unknown>} data - Data body request
 */
export function updateLastSeen(data: Record<string, unknown>): void {
  const booleanVal = Input.boolean(data.value as boolean);

  if (booleanVal) throw new ResponseError(400, 'Invalid Value', booleanVal);
}

/**
 * Memvalidasi data input untuk pembaruan pesan dibaca pengguna.
 * @param {Record<string, unknown>} data - Data body request
 */
export function updateReadReceipt(data: Record<string, unknown>): void {
  const booleanVal = Input.boolean(data.value as boolean);

  if (booleanVal) throw new ResponseError(400, 'Invalid Value', booleanVal);
}

/**
 * Memvalidasi data input untuk pembaruan lihat story pengguna.
 * @param {Record<string, unknown>} data - Data body request
 */
export function updateStoryReceipt(data: Record<string, unknown>): void {
  const booleanVal = Input.boolean(data.value as boolean);
  if (booleanVal) throw new ResponseError(400, 'Invalid Value', booleanVal);
}

/**
 * Memvalidasi data input untuk penghapusan akun pengguna.
 * @param {Record<string, unknown>} data - Data body request
 */
export function deleteAccount(data: Record<string, unknown>): void {
  const passwordVal = Input.password((data.password as string).trim());

  if (passwordVal) throw new ResponseError(400, 'Invalid Password', passwordVal);
}
