# 📨 iYou Messenger API

> **REST API & Real-Time WebSocket Server untuk Aplikasi Chat Modern.**

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

iYou Messenger API adalah arsitektur _backend_ berperforma tinggi yang dirancang untuk mendukung aplikasi pesan instan dengan fokus pada skalabilitas dan keamanan. Dibangun menggunakan **Node.js, Express, TypeScript, dan PostgreSQL**, proyek ini menggabungkan fleksibilitas REST API dengan kecepatan komunikasi dua arah melalui protokol WebSocket asli (`ws`).

---

## ✨ Fitur Utama

### 🔐 Autentikasi & Keamanan (Enterprise-Level)

- **JWT via HttpOnly Cookie:** Sesi aman yang kebal terhadap serangan XSS karena token tidak dapat diakses melalui JavaScript.
- **JWT Time-Bomb:** Mekanisme keamanan yang secara otomatis memutus koneksi WebSocket tepat saat masa berlaku token JWT habis.
- **OTP Multi-Channel:** Verifikasi pendaftaran dan perubahan identitas sensitif (Email/HP) menggunakan kode OTP 6-digit.
- **Granular Rate Limiting:** Proteksi berlapis terhadap serangan _Brute-force_ pada API dan pembatasan frekuensi (_In-memory Sliding Window_) pada event WebSocket.

### 💬 Real-Time Messaging (WebSocket)

- **Private & Group Chat:** Sinkronisasi pesan instan dengan latensi minimal.
- **Smart Indicators:** Status "online/offline" dan indikator "sedang mengetik..." yang responsif.
- **Read & Delivery Receipts:** Pelacakan status pesan (Centang Satu/Dua/Biru) berdasarkan status koneksi real-time dan interaksi pengguna.
- **Message Actions:** Mendukung fitur tarik pesan (_Delete for Everyone_), edit konten, dan reaksi emoji (dengan validasi _Strict Unicode_).

### 🗄️ Database & Integritas Data (PostgreSQL)

- **N+1 Query Slayer:** Pengambilan daftar obrolan menggunakan _Common Table Expressions_ (CTE) untuk mengagregasi pesan terakhir dan jumlah pesan belum dibaca dalam satu _database trip_.
- **ACID Transactions:** Menjamin konsistensi data pada operasi kompleks (seperti bergabung ke grup) menggunakan transaksi atomik (`BEGIN`/`COMMIT`).
- **Soft Deletes:** Fitur _Clear Chat_ personal tanpa menghapus riwayat pesan secara global bagi partisipan lain.

### 👥 Manajemen Sosial & Grup

- **PIN Unik 8-Karakter:** Tambah teman atau bergabung ke grup secara instan tanpa perlu membagikan nomor telepon pribadi.
- **Role-Based Group:** Manajemen grup dengan fitur Admin, Kick Member, dan _Auto-Promote_ admin jika admin sebelumnya keluar.

### 📸 Stories / Status (24 Jam)

- **Cloudinary Integration:** Manajemen unggahan media yang efisien.
- **Auto-Cleanup Cron Job:** Tugas latar belakang otomatis untuk menghapus story yang kedaluwarsa dan membersihkan file fisik di server Cloudinary setiap jam.

---

## 🛠️ Tech Stack

- **Core:** Node.js, Express.js, TypeScript.
- **Database:** PostgreSQL (Raw SQL dengan `pg`).
- **Real-Time:** `ws` (Native WebSockets).
- **Storage:** Cloudinary (Aset Media).
- **Security:** Helmet, CORS, Bcrypt.js, JSONWebToken.
- **Utilities:** Node-cron (Background Jobs), Nodemailer.

---
