/**
 * Menyamarkan alamat email pengguna untuk ditampilkan ke client.
 * Menjaga privasi dengan hanya menampilkan karakter pertama dan domain email.
 * Contoh: 'mamathidayat@gmail.com' -> 'm***@gmail.com'
 *
 * @param {string} email - Alamat email yang ingin disamarkan
 * @returns {string} Alamat email yang sudah disamarkan
 */
export const email = (email: string): string => {
  const [local, domain] = email.split('@');

  if (!local || !domain) return email;

  const masked = local[0] + '*'.repeat(local.length - 1);
  return `${masked}@${domain}`;
};

/**
 * Menyamarkan nomor telepon pengguna untuk ditampilkan ke client.
 * Menjaga privasi dengan hanya menampilkan 4 digit terakhir.
 * Contoh: '081234567890' -> '********7890'
 *
 * @param {string} phone - Nomor telepon yang ingin disamarkan
 * @returns {string} Nomor telepon yang sudah disamarkan
 */
export const phone = (phone: string): string => {
  if (phone.length < 4) return phone;
  // Ambil 4 digit terakhir, sisanya diganti bintang
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
};
