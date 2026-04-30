/**
 * Memvalidasi format dan aturan input pengguna.
 * Setiap fungsi mengembalikan null jika valid, atau pesan error jika tidak valid.
 */

// ============================================================
// USERNAME
// Aturan: 3-32 karakter, lowercase, boleh angka (maks 6 digit
// berurutan), boleh titik (maks 3x, tidak berurutan, tidak di
// awal/akhir) dan underscore (maks 5x, maks 3 berurutan),
// tidak boleh diawali angka, tidak boleh karakter lain.
// ============================================================

/**
 * Memvalidasi format username pengguna.
 *
 * @param {string} value - Username yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function username(value: string): string | null {
  const isLength = value.length;

  // Cek panjang minimum dan maksimum
  if (isLength < 3) return 'Username must be at least 3 characters.';
  if (isLength > 32) return 'Username maximum 32 characters.';

  const isLowercase = /[a-z]+/.test(value);
  const isUppercase = /[A-Z]+/.test(value);
  const isNumber = /\d+/.test(value);
  const isAllowedSymbol = /[_.]/.test(value);
  const isDeniedSymbol = /[^a-zA-Z0-9_.]+/.test(value);
  const dotCount = value.split('.').length;
  const underscoreCount = value.split('_').length;
  const isOverNumber = /\d{7,}/.test(value);
  const isOverDot = /[.]{2,}/.test(value);
  const isOverUnderscore = /[_]{4,}/.test(value);

  // Cek karakter yang tidak diizinkan
  if (isDeniedSymbol) {
    if (isUppercase) return 'Capital letters and prohibited symbols are not permitted.';
    if (!isAllowedSymbol || isNumber) return 'Forbidden numbers and symbols are not allowed.';
    if (isAllowedSymbol) return 'Symbols are not allowed.';
    return 'No prohibited symbols allowed.';
  }

  // Cek huruf kapital
  if (isUppercase) return 'Containing uppercase letters is not permitted.';

  // Cek keberadaan huruf kecil
  if (!isLowercase) {
    if (isNumber && isAllowedSymbol) return 'Numbers and symbols are not allowed.';
    if (isNumber) return 'Numbers alone are not allowed.';
    if (isAllowedSymbol) return 'Symbols are not allowed.';
    return 'Must contain lowercase letters.';
  }

  // Cek batas penggunaan angka, titik, dan underscore
  if (isOverNumber) return 'Number cannot be more than 6.';
  if (dotCount > 4) return 'The maximum dots used is 3 times.';
  if (underscoreCount > 6) return 'Maximum underscore used is 5 times.';
  if (isOverDot) return 'Dots cannot be more than 1 in sequence.';
  if (isOverUnderscore) return 'Underscores cannot be more than 3 in sequence.';

  // Cek posisi awal dan akhir
  if (/\d/.test(value.charAt(0))) return 'Number cannot be at the beginning.';
  if (value.startsWith('.') || value.endsWith('.')) return 'Dot cannot be at the beginning or end.';

  return null;
}

// ============================================================
// PASSWORD
// Aturan: 8-64 karakter, wajib ada lowercase, uppercase,
// angka, dan simbol (!@#$%^&*()_+=.?-), tidak boleh karakter
// lain di luar daftar yang diizinkan.
// ============================================================

/**
 * Memvalidasi format password pengguna.
 *
 * @param {string} value - Password yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function password(value: string): string | null {
  const isLength = value.length;

  // Cek panjang minimum dan maksimum
  if (isLength < 8) return 'Password is too short, minimum 8.';
  if (isLength > 64) return 'Password is too long, maximum 64.';

  const isLowercase = /[a-z]+/.test(value);
  const isUppercase = /[A-Z]+/.test(value);
  const isNumber = /\d+/.test(value);
  const isSymbols = /[!@#$%^&*()_+=.?-]+/.test(value);
  const isDenied = /[^a-zA-Z0-9!@#$%^&*()_+=.?-]+/.test(value);

  // Cek karakter yang tidak diizinkan
  if (isDenied) return 'A forbidden character was used.';

  // Cek keberadaan setiap jenis karakter yang wajib ada
  if (!isLowercase) return 'Password must contain at least one lowercase letters.';
  if (!isUppercase) return 'Password must contain at least one uppercase letters.';
  if (!isNumber) return 'Password must contain at least one numbers.';
  if (!isSymbols) return 'Password must contain at least one symbols.';

  return null;
}

// ============================================================
// EMAIL
// Aturan: format standar email (local@domain.tld),
// maksimum 255 karakter sesuai kolom DB.
// ============================================================

/**
 * Memvalidasi format alamat email.
 *
 * @param {string} value - Email yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function email(value: string): string | null {
  // Cek panjang maksimum sesuai kolom DB
  if (value.length > 255) return 'Email is too long, maximum 255 characters.';

  // Cek format ketat: local part + @ + domain + . + tld (min 2 char)
  const isValidFormat = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
  if (!isValidFormat) return 'Invalid email format.';

  // Cek tidak ada titik berurutan di local part
  if (/\.{2,}/.test(value.split('@')[0] ?? ''))
    return 'Email local part cannot contain consecutive dots.';

  // Cek tidak diawali atau diakhiri titik di local part
  const localPart = value.split('@')[0] ?? '.';

  if (localPart.startsWith('.') || localPart.endsWith('.'))
    return 'Email cannot start or end with a dot.';

  return null;
}

// ============================================================
// PHONE
// Aturan: format internasional E.164, diawali +,
// hanya angka setelah +, panjang 7-15 digit.
// ============================================================

/**
 * Memvalidasi format nomor telepon dalam format internasional E.164.
 *
 * @param {string} value - Nomor telepon yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function phone(value: string): string | null {
  // Cek diawali dengan tanda +
  if (!value.startsWith('+')) return 'Phone number must start with "+" (e.g. +6281234567890).';

  const digits = value.slice(1);

  // Cek hanya berisi angka setelah +
  if (!/^\d+$/.test(digits)) return 'Phone number must only contain digits after "+".';

  // Cek panjang digit (standar E.164: 7-15 digit)
  if (digits.length < 7) return 'Phone number is too short, minimum 7 digits.';
  if (digits.length > 15) return 'Phone number is too long, maximum 15 digits.';

  return null;
}

// ============================================================
// FULLNAME
// Aturan: 1-60 karakter sesuai kolom DB, tidak boleh
// hanya spasi, boleh huruf dan spasi saja.
// ============================================================

/**
 * Memvalidasi format nama lengkap pengguna.
 *
 * @param {string} value - Nama lengkap yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function fullname(value: string): string | null {
  const trimmed = value.trim();

  // Cek tidak boleh kosong atau hanya spasi
  if (!trimmed) return 'Full name cannot be empty.';

  // Cek panjang minimum dan maksimum sesuai kolom DB
  if (trimmed.length < 1) return 'Full name must be at least 1 character.';
  if (trimmed.length > 60) return 'Full name is too long, maximum 60 characters.';

  // Cek hanya boleh huruf dan spasi
  if (!/^[a-zA-Z\s]+$/.test(trimmed)) return 'Full name can only contain letters and spaces.';

  return null;
}

// ============================================================
// ABOUT
// Aturan: maksimum 100 karakter sesuai kolom DB,
// boleh kosong (opsional field).
// ============================================================

/**
 * Memvalidasi format bio/about pengguna.
 *
 * @param {string} value - Bio yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function about(value: string): string | null {
  // Cek panjang maksimum sesuai kolom DB
  if (value.length > 100) return 'About is too long, maximum 100 characters.';

  return null;
}

// ============================================================
// OTP
// Aturan: tepat 6 digit angka, sesuai Generator.otp().
// ============================================================

/**
 * Memvalidasi format kode OTP.
 *
 * @param {string} value - Kode OTP yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function otp(value: string): string | null {
  // Cek panjang tepat 6 karakter
  if (value.length !== 6) return 'OTP code must be exactly 6 digits.';

  // Cek hanya berisi angka
  if (!/^\d{6}$/.test(value)) return 'OTP code must only contain numbers.';

  return null;
}

// ============================================================
// PIN (input user, bukan generate)
// Aturan: tepat 8 karakter, hanya angka dan huruf besar,
// sesuai format Generator.pin().
// ============================================================

/**
 * Memvalidasi format PIN pengguna untuk pencarian.
 *
 * @param {string} value - PIN yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function pin(value: string): string | null {
  // Cek panjang tepat 8 karakter
  if (value.length !== 8) return 'PIN must be exactly 8 characters.';

  // Cek hanya berisi angka dan huruf besar sesuai format Generator.pin()
  if (!/^[0-9A-Z]{8}$/.test(value)) return 'PIN must only contain uppercase letters and numbers.';

  return null;
}

// ============================================================
// TOKEN
// Aturan: tepat 64 karakter hexadecimal,
// sesuai format Generator.token().
// ============================================================

/**
 * Memvalidasi format token verifikasi.
 *
 * @param {string} value - Token yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function token(value: string): string | null {
  // Cek panjang tepat 64 karakter
  if (value.length !== 64) return 'Invalid verification token.';

  // Cek format hexadecimal
  if (!/^[a-f0-9]{64}$/.test(value)) return 'Invalid verification token.';

  return null;
}

// ============================================================
// IDENTIFIER (login & forgot password)
// Aturan: tidak boleh kosong, minimal 3 karakter,
// bisa berupa username, email, phone, atau PIN.
// ============================================================

/**
 * Memvalidasi identifier pengguna untuk proses login dan forgot password.
 *
 * @param {string} value - Identifier yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function identifier(value: string): string | null {
  // Cek tidak boleh kosong
  if (!value.trim()) return 'Identifier cannot be empty.';

  // Cek panjang minimum
  if (value.trim().length < 3) return 'Identifier must be at least 3 characters.';

  return null;
}

// ============================================================
// BOOLEAN (read_receipt)
// Aturan: harus bertipe boolean, tidak boleh string atau number.
// ============================================================

/**
 * Memvalidasi nilai boolean untuk pengaturan read receipt.
 *
 * @param {boolean} value - Nilai yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function boolean(value: boolean): string | null {
  // Cek tipe data harus boolean
  if (typeof value !== 'boolean') return 'Value must be a boolean (true or false).';

  return null;
}

// ============================================================
// EMOJI
// Aturan: 100% murni karakter emoji. Mendukung modifier warna
// kulit, Zero-Width Joiner (ZWJ), dan Variation Selector.
// Tidak boleh ada huruf, angka, simbol standar, atau spasi.
// ============================================================

/**
 * Memvalidasi apakah string 100% berisi karakter emoji murni.
 *
 * @param {string} value - String yang akan divalidasi
 * @returns {string | null} Pesan error jika tidak valid, null jika valid
 */
export function emoji(value: string): string | null {
  if (!value) return 'Emoji cannot be empty.';

  // REGEX PENJELASAN (Flag 'u' wajib untuk Unicode):
  // \p{Extended_Pictographic}: Mayoritas emoji modern (ikon, wajah, benda)
  // \p{Emoji_Presentation}: Karakter yang dirender sebagai emoji secara default
  // \p{Emoji_Modifier}: Modifier warna kulit (🏻, 🏼, 🏽, 🏾, 🏿)
  // \u200D: Zero-Width Joiner (untuk emoji gabungan seperti 👨‍👩‍👧‍👦)
  // \uFE0F: Variation Selector-16 (memaksa render grafis emoji)
  const isPureEmoji =
    /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\u200D\uFE0F]+$/u.test(
      value,
    );

  if (!isPureEmoji) {
    return 'Value must be pure emoji. Text, numbers, spaces, or standard symbols are not allowed.';
  }

  return null;
}
