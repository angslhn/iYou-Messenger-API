import crypto from 'crypto';
import { customAlphabet } from 'nanoid';

const nanoNumber = customAlphabet('0123456789');
const nanoPin = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');

/**
 * Menghasilkan ID unik berupa angka acak sepanjang 15 digit.
 * Menggunakan nanoNumber dengan alphabet khusus angka 0-9.
 *
 * @returns {string} ID unik 15 digit berupa string angka
 */
export const id = (): string => nanoNumber(15);

/**
 * Menghasilkan kode OTP unik berupa angka acak sepanjang 6 digit.
 * Menggunakan nanoNumber dengan alphabet khusus angka 0-9.
 *
 * @returns {string} Kode OTP 6 digit berupa string angka
 */
export const otp = (): string => nanoNumber(6);

/**
 * Menghasilkan token acak sepanjang 64 karakter dalam format hexadecimal.
 * Menggunakan crypto.randomBytes bawaan Node.js untuk keamanan kriptografis.
 *
 * @returns {string} Token 64 karakter hexadecimal
 */
export const token = (): string => crypto.randomBytes(32).toString('hex');

/**
 * Menghasilkan pin acak unik berupa angka dan huruf besar sepanjang 8 karakter.
 * Menggunakan nanoPin dengan alphabet khusus angka 0-9 dan huruf A-Z.
 *
 * @returns {string} PIN unik 8 karakter campuran angka dan huruf
 */
export const pin = (): string => nanoPin(8);
