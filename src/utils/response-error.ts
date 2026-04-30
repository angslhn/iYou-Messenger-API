/**
 * Fallback redirect ketika terjadi kesalahan pada proses autentikasi
 */
type Redirect = 'login' | 'register' | 'verify' | 'forgot_password';

/**
 * Class kustom untuk menangani error respons API secara terstruktur.
 * Memperluas class bawaan `Error` dengan menambahkan informasi spesifik HTTP
 * seperti status code, judul error yang representatif, serta instruksi redirect
 * untuk memandu alur navigasi di sisi frontend.
 */
class ResponseError extends Error {
  public statusCode: number;
  public title: string;
  public redirect?: Redirect;
  public email?: string;

  /**
   * Membuat instance baru dari ResponseError.
   *
   * @param {number} statusCode - Kode status HTTP (contoh: 400, 401, 403, 404, 500)
   * @param {string} title - Judul singkat yang merepresentasikan jenis error (contoh: 'User Not Found')
   * @param {string} message - Penjelasan detail dan formal mengenai penyebab error
   * @param {'login' | 'register' | 'verify' | 'forgot_password'} [redirect] - (Opsional) Instruksi navigasi halaman bagi client/frontend jika diperlukan
   * @param {string} [email] - (Opsional) Alamat email pengguna, dikirim ke FE saat redirect ke halaman verify
   * @param {string} [stack] - (Opsional) Stack trace kustom, berguna jika error dilempar ulang (re-throw) dari service lain
   */
  constructor(
    statusCode: number,
    title: string,
    message: string,
    redirect?: Redirect,
    email?: string,
    stack?: string,
  ) {
    // Memanggil konstruktor bawaan dari kelas Error untuk meregistrasi properti 'message'
    super(message);

    // Menyimpan properti kustom untuk kebutuhan format respons JSON di global error handler
    this.statusCode = statusCode;
    this.title = title;
    this.redirect = redirect;
    this.email = email;

    // Menangani tumpukan jejak eksekusi (stack trace) untuk keperluan debugging backend
    if (stack) {
      this.stack = stack;
    } else {
      // Menangkap stack trace dari titik di mana error ini secara spesifik dilempar,
      // sekaligus menyembunyikan konstruktor ResponseError ini dari log stack trace itu sendiri
      // agar log error lebih bersih dan akurat.
      Error.captureStackTrace(this, this.constructor);
    }

    // Memperbaiki rantai purwarupa (prototype chain).
    // Ini adalah langkah krusial di TypeScript/ES6+ ketika mewarisi (extend) objek bawaan bawaan seperti Error,
    // agar operator validasi seperti (err instanceof ResponseError) tetap mereturn nilai true.
    Object.setPrototypeOf(this, ResponseError.prototype);
  }
}

export default ResponseError;
