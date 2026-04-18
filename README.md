# Drive PDF Previewer - Professional Document Viewer

### 🚀 Live Preview: [https://pdf-preview-xi.vercel.app/](https://pdf-preview-xi.vercel.app/)

A professional-grade, web-based PDF viewer integrated with the Google Drive API. This application provides a seamless "Google Drive Preview" experience with advanced features like multi-document history and persistent reading progress.

---

## 🧐 Bagaimana Cara Kerja Logika Penyimpanannya?

Salah satu fitur unggulan dari aplikasi ini adalah kemampuannya untuk **mengingat halaman terakhir** yang Anda baca. Berikut adalah penjelasan teknis di balik layar:

### 1. Persistent Storage (LocalStorage)
Aplikasi menggunakan fitur **Web Storage API (localStorage)** yang ada di dalam browser Anda. Data tidak disimpan di server, melainkan di memori lokal perangkat Anda.
*   **Key**: `DRIVE_VIEWER_HISTORY`
*   **Format**: Array of Objects (maksimal 5 dokumen terbaru).

Setiap kali Anda memuat dokumen atau berpindah halaman, sistem akan menyimpan state terbaru:
```json
{
  "id": "FILE_ID_GOOGLE_DRIVE",
  "title": "Nama File Asli.pdf",
  "page": 10,
  "zoom": 1.2,
  "timestamp": 1713456789000
}
```

### 2. Mekanisme "Auto-Resume"
Saat Anda me-refresh halaman atau membuka kembali link yang sama:
1.  **Boot Phase**: Aplikasi memeriksa URL untuk mencari parameter `?id=`. Jika tidak ada, ia mengambil entri paling baru dari riwayat lokal.
2.  **Lookup Phase**: Sebelum PDF dirender, `StorageManager` akan mencari kecocokan ID dokumen di dalam history.
3.  **Restore Phase**: Jika ditemukan (misal: Anda terakhir di halaman 15), sistem akan mengirimkan variabel `startPage = 15` ke mesin render PDF.js.
4.  **Instant Jump**: PDF.js akan langsung melompat ke halaman tersebut tanpa harus melalui halaman 1 terlebih dahulu.

### 3. Sinkronisasi Real-time
Setiap gerakan (seperti ganti halaman atau ganti level zoom) akan langsung memperbarui objek dokumen yang tepat di dalam array history. Ini memastikan data selalu akurat bahkan jika terjadi pemutusan koneksi atau refresh mendadak.

---

## ✨ Fitur Utama
- 📂 **Multi-Document History**: Mencatat hingga 5 dokumen terakhir yang Anda buka.
- 🔍 **Dynamic Zoom**: Kontrol zoom dari 50% hingga 300% dengan rendering teks yang tajam.
- 🎨 **Google Drive Aesthetic**: UI modern dengan tema gelap (#323639) dan floating toolbar.
- ⚡ **Direct URL Access**: Buka dokumen spesifik langsung lewat URL (Contoh: `/?id=FILE_ID`).
- 🛠️ **OOP Architecture**: Kode yang bersih dan terstruktur menggunakan JavaScript ES6 Classes.

## 🛠️ Tech Stack
- **PDF.js**: Library utama untuk rendering PDF ke HTML5 Canvas.
- **Google Drive API (v3)**: Digunakan untuk mengambil konten file biner dan metadata dokumen.
- **Vanilla CSS3**: Styling kustom dengan efek Glassmorphism.
- **Object Oriented JavaScript**: Manajemen state yang modular dan efisien.

---

## 📦 Cara Instalasi Mandiri
1. Clone repositori ini.
2. Buka `index.html` langsung di browser atau melalui live server.
3. (Optional) Ganti `apiKey` di dalam `script.js` dengan API Key milik Anda dari [Google Cloud Console](https://console.cloud.google.com/).

---
*Dibuat dengan ❤️ untuk kebutuhan Repositori Dokumen yang Profesional.*
