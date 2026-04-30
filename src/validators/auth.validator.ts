import ResponseError from '@/utils/response-error.js';

import * as Input from '@/validators/input.validator.js';

/**
 * Memvalidasi data input untuk proses registrasi pengguna baru.
 * @param {Record<string, unknown>} data - Data body request
 */
export function register(data: Record<string, unknown>): void {
  const fullnameVal = Input.fullname((data.fullname as string).trim());

  if (fullnameVal) throw new ResponseError(400, 'Invalid Fullname', fullnameVal);

  const usernameVal = Input.username((data.username as string).trim());

  if (usernameVal) throw new ResponseError(400, 'Invalid Username', usernameVal);

  const emailVal = Input.email((data.email as string).trim());

  if (emailVal) throw new ResponseError(400, 'Invalid Email', emailVal);

  const passwordVal = Input.password((data.password as string).trim());

  if (passwordVal) throw new ResponseError(400, 'Insecure Password', passwordVal);
}

/**
 * Memvalidasi data input untuk proses login pengguna.
 * @param {Record<string, unknown>} data - Data body request
 */
export function login(data: Record<string, unknown>): void {
  const identifierVal = Input.identifier((data.identifier as string).trim());

  if (identifierVal) throw new ResponseError(400, 'Login Failed', identifierVal);

  const passwordCheck = !(data.password as string).trim();

  if (passwordCheck) throw new ResponseError(400, 'Login Failed', 'Password is required');
}

/**
 * Memvalidasi data input untuk proses verifikasi email.
 * @param {Record<string, unknown>} data - Data body request
 */
export function verify(data: Record<string, unknown>): void {
  const emailVal = Input.email((data.email as string).trim());

  if (emailVal) throw new ResponseError(400, 'Invalid email', emailVal);

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
 * Memvalidasi data input untuk proses forgot password.
 * @param {Record<string, unknown>} data - Data body request
 */
export function forgotPassword(data: Record<string, unknown>): void {
  const identifierVal = Input.identifier((data.identifier as string).trim());

  if (identifierVal) throw new ResponseError(400, 'Invalid Identifier', identifierVal);
}

/**
 * Memvalidasi data input untuk proses reset password.
 * @param {Record<string, unknown>} data - Data body request
 */
export function resetPassword(data: Record<string, unknown>): void {
  const tokenVal = Input.token((data.token as string).trim());

  if (tokenVal) throw new ResponseError(400, 'Invalid Token', tokenVal);

  const passwordVal = Input.password((data.new_password as string).trim());

  if (passwordVal) throw new ResponseError(400, 'Insecure Password', passwordVal);
}
