import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Bahasa } from "./types";
import { fetchLanguages, translateUI } from "./api";
import { EN } from "./locales/en";

/**
 * Multibahasa. Kuncinya adalah teks Indonesia itu sendiri, jadi terjemahan yang
 * belum tersedia jatuh ke teks asli, bukan layar kosong.
 *
 * EN memakai kamus statis (locales/en.ts); bahasa lain diterjemahkan sekali
 * lewat /api/translate-ui lalu di-cache di localStorage.
 */

const KUNCI_BAHASA = "tourcation.lang";
const AWALAN_KAMUS = "tourcation.dict.";

interface I18nValue {
  lang: string;
  langs: Bahasa[];
  setLang: (kode: string) => void;
  t: (teks: string) => string;
  memuat: boolean;
  galat: string | null;
}

const I18nContext = createContext<I18nValue>({
  lang: "id",
  langs: [],
  setLang: () => {},
  t: (s) => s,
  memuat: false,
  galat: null,
});

/** Didaftar eksplisit agar satu panggilan cukup untuk seluruh situs. */
export const STRING_UI: string[] = [
  // Navbar & footer
  "Home", "Perjalanan", "Galeri", "AI Guide", "Dampak UMKM", "Ekspor PDF", "Plan Trip",
  "Unduh rencana sebagai PDF",
  "Ke beranda", "Dibuat untuk penjelajah modern", "Bahasa",
  // Seksi & pintu masuk dashboard
  "Dashboard", "Tourism Intelligence", "Dashboard Pemerintah", "Dashboard UMKM",
  "Statistik, tren, dan kesenjangan wilayah", "Performa usaha dan peluang pasar",
  "Dari rencana perjalanan menjadi", "keputusan berbasis data", "Buka dashboard",
  "Masuk", "Akun",
  "Setiap itinerary yang tersusun menambah gambaran tentang ke mana wisatawan pergi dan apa yang mereka cari. Gambaran itu dikembalikan kepada UMKM dan pemerintah daerah sebagai insight yang bisa ditindaklanjuti.",
  "Seluruh angka dihitung langsung dari dataset kawasan Danau Toba — tanpa data sintetis. Keterbatasan datanya ikut ditampilkan apa adanya di setiap dashboard.",
  "Destinasi & UMKM terdata per kabupaten", "Tren permintaan 12 bulan",
  "Prioritas pengembangan wilayah", "Posisi harga terhadap UMKM sejenis",
  "Sinyal permintaan wilayah", "Peluang berbasis data, bukan tebakan",
  // Section galeri
  "Sekilas Danau Toba", "Lihat Sendiri Keindahannya",
  "Kaldera vulkanik terbesar di dunia, danau sepanjang 100 kilometer, dan budaya Batak yang hidup di tepiannya.",
  "Geser untuk menjelajah — klik kartu untuk melihat selengkapnya",
  "Sebelumnya", "Berikutnya", "Putar", "Tutup",
  "Pulau Samosir", "Pulau seluas Singapura di tengah danau",
  "Bukit Holbung", "Punggung bukit hijau menghadap perairan",
  "Air Terjun Sipiso-piso", "Terjunan 120 meter di ujung utara kaldera",
  "Desa Tomok", "Rumah bolon dan makam batu raja Batak",
  // Halaman detail galeri
  "Halaman ini masih disiapkan. Konten lengkapnya segera hadir.",
  "Halaman tidak ditemukan", "Destinasi yang kamu cari tidak ada dalam galeri.",
  // Pilihan penginapan
  "Pilihan penginapan", "rata-rata ke wisata", "rencana saat ini", "total",
  "Lihat {n} hotel teratas lainnya", "Sembunyikan hotel lain",
  "Mengganti penginapan menyusun ulang seluruh rencana — wisata, urutan rute, dan biayanya ikut berubah.",
  // Transportasi
  "Transportasi", "Angkutan umum", "Dipakai", "Jalan kaki", "Motor", "Mobil",
  "Tarif per orang per hari dari data operator antarkota.",
  "Tanpa biaya BBM. Feri dihitung tarif pejalan kaki.",
  "Biaya BBM dihitung dari jarak rute dan ikut membatasi budget.",
  "Feri", "Jarak rencana ini terlalu jauh untuk moda tersebut", "batas wajar",
  // Hero
  "Discover the Magic of", "Susun Perjalanan", "Scroll",
  "Tanya AI soal Danau Toba…", "Salin", "Tersalin",
  "Susun rencana agar jawabannya lebih spesifik.",
  "AI menyusun perjalananmu di danau vulkanik terbesar Asia Tenggara — itinerari personal, rute harian yang efisien, dan pilihan kuliner yang berpihak pada UMKM lokal.",
  // Panel Atur Perjalanan
  "Atur Perjalanan", "Budget Total (Rp)", "Durasi (Hari)", "Jumlah Orang",
  "Wisata Per Hari", "Minat Wisata", "Gaya Pengalaman", "Saran AI",
  "Dipilihkan dari budget per hari", "Susun Rencana", "AI menyusun rencana…",
  "Dijamin tidak melebihi budget", "Mendukung UMKM & wisata lokal",
  "Penginapan", "Termasuk", "Tidak", "malam", "tanpa menginap",
  "Gunakan lokasi saya", "Perbarui lokasi saya",
  "Hotel tidak dibiayai. Rute berangkat dari titik acuan pilihanmu.",
  "Tanpa lokasi, rute tetap berpangkal di hotel acuan terdekat.",
  "Meminta izin lokasi…", "Titik acuan: lokasi Anda saat ini.",
  "Izin lokasi ditolak. Rute akan berpangkal di hotel acuan.",
  "Tips Lokal",
  // Papan itinerary
  "Perjalanan Dioptimalkan AI", "Hari", "Malam", "Orang", "Profil", "Umum",
  "Estimasi Biaya", "Sisa Budget", "Total Jarak", "Per Hari", "per orang",
  "orang / hari",
  "dari budget", "melebihi budget", "destinasi", "Titik Keberangkatan",
  "Titik rute harian", "Tanpa penginapan", "Titik acuan",
  "Koordinat tidak tersedia",
  "Rute harian berangkat dan kembali ke titik ini. Tidak ada biaya penginapan.",
  "Wisata", "Sarapan", "Makan siang", "Makan malam", "pilihan sepadan",
  "rekomendasi AI", "Gratis masuk", "per grup", "Highly Rated", "Kembalikan",
  "AI sedang menyusun…", "Siap menyusun rencana", "Mulai dari",
  "Alam", "Budaya", "Rohani", "Rekreasi",
  "Alam & Petualangan", "Budaya & Akar Tradisi", "Ziarah & Refleksi",
  "Rekreasi & Keluarga", "Eksplorasi", "Eksplorasi Campuran",
  // Peta
  "Peta Rute", "Peta rute muncul setelah rencana disusun.",
  "Destinasi Terdekat", "Total Biaya Wisata", "Total Biaya BBM",
  "Perlu menyeberang", "Buka di Google Maps", "Titik berangkat", "Perhentian",
  "Singgahan tambahan", "Cari lokasi", "Gunakan lokasiku",
  "Kembali berangkat dari hotel", "Lokasi Saya",
  // Analisis AI
  "Di balik layar", "Analisis", "Budget Solver", "Route Optimizer",
  "Time-Aware Filter", "Ferry Detector", "UMKM Scorer", "Modul",
  "Wisata terpilih", "Resto terpilih", "Total agenda", "Ragam kuliner khas",
  "Tanya AI", "Tanpa feri", "penyeberangan",
  // Dampak UMKM
  "Dampak Ekonomi Lokal", "Dampak", "Usaha Lokal Otentik",
  "Ragam Kuliner Khas", "Usaha Unik Dikunjungi",
  "Porsi kunjungan ke usaha lokal", "Kuliner khas Batak dalam rencana ini",
  "Belum ada rencana untuk diukur",
  // Penerjemah
  "Penerjemah AI", "Siap menerjemahkan", "Menerjemahkan…",
  "Ketik teks untuk diterjemahkan…", "Hapus percakapan", "Tukar bahasa",
  "Rekam suara", "Berhenti merekam", "Mendengarkan…", "Terjemahkan",
  "Dengarkan", "Enter kirim · Shift+Enter baris baru",

  // ── Dashboard (Fase 8) ──────────────────────────────────────────────
  // Kerangka dashboard & navigasi
  "Ikhtisar", "Kesenjangan", "Simulasi", "Beranda", "Usaha & Produk",
  "Cari destinasi atau kabupaten...", "Cari produk atau pesanan...", "Cari...",
  "Akun saya", "Keluar", "Buka menu", "Tutup menu", "Dinas Pariwisata",
  "Pemerintah Daerah", "Pemilik Usaha", "UMKM Mitra",
  // Masuk & akun
  "Kembali ke beranda", "Masuk ke TourCation",
  "Perencanaan perjalanan tetap bisa dipakai tanpa masuk. Akun hanya diperlukan untuk membuka dashboard UMKM dan pemerintah.",
  "Login belum dikonfigurasi di lingkungan ini.", "perlu diisi di", "Memeriksa sesi...",
  "Lanjutkan dengan Google", "Peran yang tersedia",
  "kelola produk dan harga, lihat performa usaha. Perlu mengklaim usaha yang terdaftar.",
  "Pemerintah",
  "statistik kawasan, analisis kesenjangan, simulasi kebijakan. Masuk memakai surel dinas resmi (mis. berakhiran .go.id) — aktif seketika, tanpa persetujuan admin.",
  "Masuk berhasil, tapi profil belum terbaca",
  "Server tidak membalas dalam waktu yang wajar. Pastikan backend berjalan di port 8000.",
  "Mencoba...", "Coba lagi",
  "Sesi Google Anda sudah tersimpan. Begitu backend hidup, cukup tekan tombol Coba lagi — tidak perlu mengulang proses masuk.",
  "Menyiapkan akun Anda...", "Akun Saya", "Peran", "Wilayah", "Permohonan sedang ditinjau",
  "Permohonan peran",
  "sudah tercatat dan menunggu persetujuan admin. Peran akan berubah otomatis begitu disetujui — tidak perlu mendaftar ulang.",
  "Ajukan Peran", "Permohonan ditinjau admin. Peran tidak berubah sampai disetujui.",
  "Peran Pemerintah ditentukan oleh alamat surel dinas Anda.",
  "Pemilik UMKM", "Cari usaha Anda di daftar terdaftar", "mis. Lapo, RM, nama warung...",
  "alamat tidak tercatat", "Dipilih",
  "Mengikuti alamat usaha yang dipilih.",
  "Alamat usaha tidak mencantumkan kabupaten — pilih manual.",
  "Akan terisi otomatis setelah usaha dipilih.",
  "Peran Pemerintah lewat surel dinas",
  "Peran ini tidak diajukan lewat formulir. Masuk memakai alamat surel dinas Anda — peran Pemerintah aktif seketika, tanpa menunggu persetujuan.",
  "Domain yang diterima", "Anda sedang masuk sebagai",
  "— alamat ini belum terdaftar sebagai surel dinas.",
  "Instansi yang memakai surel di luar domain tersebut bisa didaftarkan satu per satu oleh admin lewat GOV_EMAILS di server.",
  "Keluar & masuk dengan surel dinas",
  "Keterangan tambahan (opsional)", "Mengirim...",
  "Ajukan Permohonan",
  // Penjaga route
  "Login belum dikonfigurasi",
  "Variabel VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diisi di frontend/.env, sehingga halaman berperan tidak dapat dibuka.",
  "Profil tidak terbaca", "Memeriksa akses...", "Akses ditolak",
  "Halaman ini memerlukan peran", "atau", "Peran akun Anda saat ini", "Ajukan peran",
  "Server belum dikonfigurasi untuk autentikasi (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum terbaca). Coba restart backend.",
  "Token tidak diterima server. Coba masuk ulang.",
  "Tidak dapat menghubungi server di /api. Pastikan backend berjalan di port 8000 (uvicorn backend.main:app --port 8000).",
  // Dashboard pemerintah — ikhtisar
  "Gagal memuat data", "Ikhtisar Pariwisata", "Kawasan Danau Toba", "kabupaten",
  "Data per", "Destinasi Terdata", "kabupaten belum terdata", "UMKM Terdata",
  "tergolong lokal-otentik", "Sinyal Ulasan 12 Bulan",
  "Proksi permintaan, bukan jumlah kunjungan", "Kabupaten Tanpa UMKM", "Sinyal Permintaan",
  "Volume ulasan 12 bulan terakhir", "nasional", "ulasan", "Sinyal", "Sebaran Kategori",
  "Destinasi terdata menurut minat",
  "Dominasi Wisata Alam adalah temuan, bukan kebetulan — ia menjadi dasar rekomendasi diversifikasi pada analisis kesenjangan.",
  "Pembacaan AI", "Penjelasan naratif atas angka di halaman ini", "Tren yang muncul",
  "Tumbuh tercepat", "Perlu perhatian", "Kategori diminati", "Analisis UMKM",
  "Rekomendasi promosi", "Rekomendasi pembangunan", "Perencanaan Nyata",
  "Itinerary yang benar-benar disusun", "hari terakhir", "Cukup untuk diperingkat",
  "Perlu", "Total sepanjang waktu", "Dalam", "hari", "Tak terpenuhi",
  "Rerata estimasi biaya", "Disusun", "rencana", "Tumbuh Tercepat",
  "Dibanding paruh 6 bulan sebelumnya", "Menurun", "Perlu perhatian dinas pariwisata",
  "Tidak ada destinasi yang memenuhi ambang bukti pada periode ini.",
  "Destinasi Paling Banyak Dibicarakan", "Peringkat menurut sinyal ulasan 12 bulan",
  "Destinasi", "Kabupaten", "Kategori", "Rating", "Status", "Catatan Kualitas Data",
  "Keterbatasan yang perlu diketahui sebelum mengambil keputusan",
  "Cakupan pemetaan ulasan ke tempat", "dari", "baris", "NAIK CEPAT", "TURUN", "STABIL",
  "DATA TIPIS", "BARU MUNCUL", "TERSENSOR",
  // Analisis kesenjangan
  "Analisis Kesenjangan", "Prioritas pengembangan wilayah berdasarkan tujuh sumbu terukur",
  "PRIORITAS", "Skor prioritas", "Sebaran Prioritas",
  "Ukuran titik mengikuti skor prioritas. Ketuk untuk memilih kabupaten.",
  "Profil Kesenjangan", "Makin luas areanya, makin besar kesenjangannya", "kesenjangan",
  "Bukti Angka", "Destinasi terdata", "UMKM terdata", "UMKM lokal-otentik",
  "Sinyal ulasan 12 bln", "Wisatawan 2024", "imputasi", "Fasilitas tercatat",
  "Event tercatat", "Rekomendasi Pengembangan",
  "Tidak ada sumbu yang tertinggal signifikan di wilayah ini.", "ATRAKSI TERDOKUMENTASI",
  "Metodologi", "Pembacaan AI atas Kesenjangan",
  "Urutan prioritas tetap mengikuti skor yang sudah dihitung", "Celah utama",
  "Prioritas penanganan", "Potensi investasi", "Rekomendasi", "Prioritas",
  "destinasi terdata", "wisatawan 2024", "Data wisatawan tidak tersedia",
  "Posisi perkiraan — tidak ada destinasi terdata",
  "Peta prioritas pengembangan per kabupaten", "Paling mendesak", "Mendesak", "Sedang",
  "Terkelola", "Posisi perkiraan",
  // Simulator kebijakan
  "Gagal memuat opsi", "Simulasi Dampak Kebijakan",
  "Bandingkan pilihan program sebelum anggaran dikeluarkan", "Rancang Skenario",
  "Jenis program", "Musim puncak", "Skala festival", "Lokal", "Regional", "Nasional",
  "Waktu penyelenggaraan", "Biasa", "Musim sepi", "Anggaran promosi (Rp)", "Jangkauan",
  "Internasional", "Jumlah UMKM dilatih", "Jumlah destinasi baru", "Kategori destinasi",
  "Jumlah program budaya", "Profil belanja wisatawan", "ke usaha lokal", "Menghitung...",
  "Jalankan Simulasi", "Belum ada simulasi",
  "Pilih jenis program dan wilayah di panel sebelah, lalu jalankan untuk melihat perkiraan dampaknya beserta seluruh asumsi yang dipakai.",
  "Tambahan wisatawan", "dari basis", "Tambahan dampak ekonomi", "Tambahan transaksi UMKM",
  "porsi lokal", "poin persen", "porsi lokal tetap", "Proyeksi 12 Bulan",
  "Dengan program dibandingkan tanpa program", "wisatawan", "Tanpa program",
  "Dengan program", "Pergeseran Distribusi Wisatawan",
  "Pangsa tiap kabupaten sebelum dan sesudah program (%)", "Sebelum", "Sesudah",
  "Asumsi Model", "Setiap angka di atas berasal dari salah satu baris di bawah",
  "Parameter", "Nilai", "Sumber", "Pembanding tanpa program", "Dampak ekonomi dasar",
  "Penjelasan AI", "Dibuat atas permintaan; seluruh angka sudah dihitung rule engine",
  "Yang perlu diperhatikan", "Tindak lanjut",
  // Dashboard UMKM
  "Performa Usaha Anda", "Posisi usaha dalam ekosistem wisata", "Pilih kabupaten",
  "UMKM di Wilayah Ini", "Destinasi Pendukung", "Sumber lalu lintas wisatawan",
  "Angka imputasi — tidak ada di dataset", "Kunjungan nusantara, data resmi",
  "Sinyal Permintaan Wilayah", "Volume ulasan 12 bulan terakhir di kabupaten Anda",
  "Batang gelap adalah 6 bulan terakhir. Ini proksi permintaan dari volume ulasan, bukan jumlah kunjungan atau transaksi.",
  "Posisi Harga", "Pembanding", "UMKM sekabupaten", "Sampel di wilayah ini hanya",
  "UMKM. Persentil harga sengaja tidak ditampilkan — pada sampel sekecil itu angkanya lebih menyesatkan daripada membantu.",
  "Termurah (p25)", "Tengah (p50)", "Termahal (p75)",
  "Harga di luar rentang wajar akan ditandai dan tidak langsung memengaruhi sistem rekomendasi.",
  "UMKM Paling Menonjol", "Di", "menurut sinyal ulasan", "Belum ada UMKM terdata di",
  "Ini peluang: wilayah ini punya", "destinasi tanpa UMKM pendukung yang tercatat.",
  "sinyal", "Otentik", "Peluang di Wilayah Anda", "Diturunkan dari data, bukan tebakan",
  "Rasio UMKM per destinasi",
  "Belum ada UMKM terdata — peluang paling terbuka di kawasan.",
  "Semakin rendah, semakin longgar persaingannya.", "Aktivitas malam wilayah ini",
  "destinasi buka sampai pukul 20.00.", "Jam operasional lebih panjang bisa jadi pembeda.",
  "Permintaan malam sudah terbentuk.", "Siapkan stok dan promo menjelang periode ini.",
  "Event besar tercatat", "Momentum kunjungan yang bisa dimanfaatkan.",
  "Budget harian wisatawan", "Patokan menetapkan titik harga.",
  // Usaha & produk saya
  "Belum bisa menampilkan usaha", "Kabupaten belum diisi", "usaha terverifikasi",
  "menunggu verifikasi admin", "Terverifikasi", "Produk aktif", "Harga terverifikasi",
  "Harga ditandai", "Skor verifikasi rata-rata", "Produk & Harga",
  "produk aktif · harga dinilai terhadap sebaran rumah makan sekitar",
  "Belum ada produk. Tambahkan lewat formulir di samping.", "Produk dinonaktifkan.",
  "KULINER KHAS", "NONAKTIF", "Nonaktifkan", "harga terverifikasi", "belum terverifikasi", "OK",
  // Dua lapisan harga. "est." menandai angka dataset pada kartu itinerary;
  // harga menu pemilik tampil apa adanya di panel usaha. Jangan disatukan —
  // yang satu perkiraan, yang satu laporan.
  "est.", "Estimasi kisaran dari dataset kawasan, bukan harga menu",
  // Verifikasi usaha oleh dinas
  "Verifikasi Usaha", "Menunggu", "Menunggu verifikasi", "Sudah terverifikasi",
  "Usaha di wilayah", "Wilayah kerja Anda", "Seluruh kabupaten (akun admin)",
  "Verifikasi", "Cabut verifikasi", "Ya, cabut", "Ya, tandai terverifikasi",
  "Catatan petugas", "kabupaten belum diisi", "Pemberitahuan",
  "Surel belum aktif", "ANTRE", "TERKIRIM", "GAGAL",
  "Usaha ditandai terverifikasi.", "Verifikasi dicabut.",
  "Tidak ada usaha yang menunggu verifikasi di wilayah Anda.",
  "Belum ada pemberitahuan untuk wilayah ini.",
  "Bisa dicabut bila keadaannya berubah",
  "Usaha sudah bisa mengisi menu dan tetap muncul di platform selama menunggu",
  "Tercatat di sini lebih dulu; surel hanya salah satu cara mengantarkannya",
  "Alasan pencabutan — tercatat permanen di jejak audit",
  "Dasar verifikasi, mis. nomor NIB atau tanggal kunjungan",
  // Selisih harga (seri keempat dashboard GOV)
  "Selisih Harga", "Selisih Harga Lapangan", "Dua satuan yang tidak sama",
  "Usaha terpasangkan", "Di bawah pita", "Di dalam pita", "Di atas pita",
  "DI BAWAH", "DI DALAM", "DI ATAS", "Di bawah", "Di dalam", "Di atas",
  "Median selisih", "Per kabupaten", "Rincian per usaha", "Pita estimasi",
  "Terlapor", "Posisi", "Selisih", "Usaha", "harga",
  "n terlalu kecil", "Belum ada usaha terpasangkan",
  "Hanya kabupaten yang sudah punya usaha terpasangkan",
  "Angka kedua, bukan angka utama — baca peringatan satuan di atas",
  "terhadap titik tengah pita estimasi, berpasangan per usaha",
  "Terurut dari selisih paling negatif — harga terlapor paling jauh di bawah estimasi",
  "Perbandingan estimasi dataset dengan harga yang dilaporkan pemilik usaha",
  "Belum diterbitkan: perlu minimal", "usaha terpasangkan, saat ini",
  ". Cacah posisi di atas tetap berlaku — ia hitungan, bukan estimasi sebaran.",
  "Membandingkan estimasi kisaran dataset dengan harga yang benar-benar dilaporkan pemilik usaha dan dinilai wajar oleh komunitas. Selisih ini tidak bisa dihitung selama kedua angka masih dilebur menjadi satu.",
  "Estimasi dataset adalah pita harga makan per orang; harga terlapor adalah harga satu item menu. Karena itu angka yang dipertanggungjawabkan di halaman ini adalah POSISI — apakah harga terlapor jatuh di bawah, di dalam, atau di atas pita estimasi usaha itu sendiri. Besaran rupiah di bawah hanya indikasi arah.",
  "Belum ada usaha yang punya harga terverifikasi sekaligus cocok dengan nama tempat di dataset. Angka akan muncul begitu ada UMKM yang mengklaim usahanya, mengisi menu, dan harganya lolos penilaian komunitas.",
  "usaha terdaftar punya harga terverifikasi tetapi namanya tidak ada di dataset, jadi tidak punya pita estimasi untuk dibandingkan. Itu bukan galat — dataset memang tidak memuat seluruh usaha di kawasan.",
  "SUSPECT", "FLAGGED", "Tambah Produk", "Harga langsung diperiksa saat disimpan",
  "Produk tersimpan dan harganya sudah dinilai.", "Nama produk (mis. Naniura Ikan Mas)",
  "Harga (Rupiah)", "Kategori (mis. Makanan Utama)",
  "Keterangan singkat (menaikkan skor kelengkapan)", "Kuliner khas Batak", "Simpan produk",
  "Harga Pembanding", "Sebaran", "rumah makan di", "Bawah (p25)", "Median", "Atas (p75)",
  "Dihitung dari",
  "titik harga nyata pada dataset — kedua ujung pita harga tiap rumah makan, bukan titik tengahnya.",
  "Jam Buka", "Ikut menyusun skor kelengkapan tiap produk",
  "Jam buka diperbarui; skor produk dihitung ulang.", "mis. 08.00 - 21.00", "Simpan",
  "Penasihat Bisnis AI", "Saran berbasis harga, permintaan nyata, dan musim wilayah Anda",
  "Produk berpotensi", "Analisis harga", "Saran promo", "Perkiraan kunjungan", "Peluang",
  "harga ditandai.",
  "Produk tersebut tetap tampil di halaman ini, tetapi tidak ditandai terverifikasi kepada wisatawan dan tidak ikut dihitung dalam statistik harga daerah sampai harganya diperbaiki atau didukung penilaian komunitas.",
  // Narasi AI (kerangka)
  "dari cache", "Muat ulang", "Buat penjelasan",
  "Penjelasan AI tidak aktif. Seluruh angka di halaman ini tetap lengkap.",
  "Angka di halaman ini sudah lengkap tanpa AI. Tekan tombol di atas untuk menambahkan penjelasan naratif.",
  "Disusun AI dari angka yang sudah dihitung sistem. Model tidak melakukan perhitungan sendiri — setiap angka di atas disalin dari data yang ditampilkan pada halaman ini.",

  // ── Dashboard (Fase 8) ──────────────────────────────────────────────


  // ── Monetisasi (Fase 9) ──────────────────────────────────────────────
  // Halaman bisnis & langganan
  "Model Bisnis", "Harga yang jujur, peringkat yang tidak dijual",
  "TourCation hidup dari dua pelanggan: UMKM yang ingin memahami pasarnya, dan pemerintah daerah yang ingin mengukur dampak kebijakannya. Keduanya membeli insight — bukan posisi di daftar rekomendasi.",
  "Langganan tidak membeli peringkat",
  "Semua tier — termasuk Gratis — muncul di itinerary lewat optimasi yang sama persis. Status langganan tidak pernah dibaca oleh mesin penyusun rencana. Begitu langganan bisa membeli peringkat, kualitas rekomendasi runtuh dan dashboard pemerintah kehilangan keabsahannya.",
  "Ini ditegakkan struktur kode, bukan janji: modul langganan hanya diimpor oleh halaman UMKM dan panel admin, tidak pernah oleh mesin itinerary.",
  "Untuk UMKM", "Rp 49.000 kira-kira setara dua porsi makan pada harga median dataset.",
  "Paling sesuai", "bln", "Muncul di itinerary wisatawan", "Produk tak terbatas",
  "produk aktif", "bulan riwayat statistik", "AI Advisor", "AI Advisor tidak tersedia",
  "Analisis kompetitor sekabupaten (anonim)", "Ekspor CSV",
  "Badge Terverifikasi diperoleh dari skor, bukan dari paket.",
  "Pembayaran belum diaktifkan pada tahap ini. Status langganan diatur manual oleh admin — yang dibangun adalah strukturnya, bukan tiruan gateway pembayaran.",
  "Untuk Pemerintah Daerah",
  "Satu survei kepariwisataan bersifat sekali jalan dan usang dalam hitungan bulan. Lisensi tahunan memberi indikator yang terus diperbarui — plus kemampuan mensimulasikan dampak kebijakan sebelum anggaran dikeluarkan.",
  "Lisensi", "Cakupan", "Estimasi per tahun", "Kabupaten/Kota",
  "1 wilayah: dashboard, analisis kesenjangan, simulator, 5 akun", "Rp 45–90 juta",
  "Provinsi", "Seluruh kabupaten + perbandingan antarwilayah, 25 akun, akses API",
  "Rp 250–450 juta", "Badan Otorita / BUMD",
  "Lintas kabupaten, indikator kustom, laporan kuartalan", "Mulai Rp 150 juta", "Pilot",
  "6 bulan, 1 kabupaten, fitur penuh", "Tanpa biaya",
  "Tier Kabupaten sengaja dipatok di bawah ambang pengadaan langsung agar siklus pembeliannya berupa hitungan minggu, bukan satu tahun anggaran. Ambang nominalnya berubah antar-Perpres dan diverifikasi ulang sebelum setiap penawaran.",
  "Bagaimana slot bersponsor akan bekerja",
  "Belum diaktifkan. Aturannya diterbitkan lebih dulu supaya bisa dinilai sebelum ada uang yang terlibat, bukan sesudahnya.",
  "Sponsor tidak pernah masuk ke perhitungan itinerary inti — kelayakan, budget, rute, dan waktu operasional dihitung tanpa mengetahui siapa yang membayar.",
  "Sponsor hanya boleh muncul di dua permukaan alternatif: saran di sekitar rute, dan pilihan rumah makan pengganti.",
  "Kandidat harus lolos kelayakan lebih dulu tanpa melihat sponsor: relevan secara geografis, masuk pita budget, skor verifikasi ≥ 0,7, harga berstatus wajar, rating di atas median kabupaten.",
  "Pengaruh peringkat dibatasi β ≤ 0,15, dan item bersponsor tidak boleh menggeser kandidat yang relevansinya lebih tinggi 20% atau lebih.",
  "Maksimal satu item bersponsor per hari, tidak pernah pada agenda pertama.",
  "Badge Bersponsor terlihat jelas, dan field disponsori ikut di respons API sehingga bisa diaudit siapa pun.",
  "Item bersponsor dikeluarkan dari seluruh peringkat analitik pemerintah — kalau penempatan berbayar bocor ke sana, produk intelijennya kehilangan keabsahan.",
  "Seluruh angka pendapatan pada dokumen model bisnis adalah model berbasis asumsi yang dinyatakan terbuka, bukan proyeksi terverifikasi.",
  "Langganan", "Belum bisa menampilkan langganan",
  "Paket menentukan kedalaman insight, bukan posisi Anda di rekomendasi", "Paket berjalan",
  "Lihat semua paket", "Kuota AI Advisor", "Batas produk", "Tak terbatas",
  "Riwayat statistik", "Berlaku sampai",
  "Kuota AI Advisor periode ini sudah habis. Narasi yang sudah pernah dibuat tetap bisa dibuka — menyajikannya dari cache tidak memotong kuota.",
  "Perbandingan paket", "Paket", "Harga", "Produk", "Advisor", "aktif",
  "Semua paket muncul di itinerary lewat optimasi yang sama. Naik paket menambah kedalaman insight, tidak menaikkan posisi Anda di rekomendasi wisatawan.",
  "Pembayaran belum diaktifkan. Untuk mencoba tier berbayar saat penjurian, admin dapat menetapkannya langsung.",

  // ── Komunitas: rating, aspirasi, pengumuman ──────────────────────────────────────────────
  // Enum aspirasi & pengumuman
  "SEMUA", "BARU", "DIBACA", "DITINDAKLANJUTI", "SELESAI", "DITOLAK", "INFRASTRUKTUR",
  "PERMODALAN", "PELATIHAN", "PROMOSI", "PERIZINAN", "LAINNYA", "KEBIJAKAN", "BANTUAN",
  "EVENT", "TERPERCAYA", "BERKEMBANG", "PERLU PEMBINAAN",
  // Aspirasi — sisi pemerintah
  "Aspirasi", "Aspirasi UMKM", "Keluhan dan usulan dari pelaku usaha di",
  "Keluhan dan usulan dari pelaku usaha di seluruh kawasan", "Total masuk",
  "Belum ditangani", "Ditindaklanjuti", "Selesai", "Belum ada aspirasi pada saringan ini.",
  "Tanggapan dinas", "Tulis tanggapan untuk pelaku usaha...", "Tanggapi", "Ubah tanggapan",
  "Batal",
  // Pengumuman — sisi pemerintah
  "Pengumuman", "Pengumuman untuk UMKM",
  "Kebijakan, program bantuan, pelatihan, dan agenda yang perlu diketahui pelaku usaha",
  "Terbitkan Pengumuman", "Jenis", "Judul pengumuman", "Isi pengumuman",
  "Nama instansi penerbit", "Wilayah sasaran", "Seluruh kabupaten",
  "Nilai bantuan (Rupiah)", "Nilai bantuan", "Cara mendaftar", "Tenggat (opsional)",
  "Tenggat", "Terbitkan", "Menerbitkan...", "Pengumuman diterbitkan.",
  "Belum ada pengumuman yang diterbitkan.", "Arsipkan", "Tayangkan lagi",
  // Suara & pengumuman — sisi UMKM
  "Suara & Pengumuman",
  "Sampaikan kendala usaha Anda, dan ikuti kebijakan serta bantuan dari dinas",
  "Dari Dinas", "Belum ada pengumuman untuk wilayah Anda.", "Sampaikan Aspirasi",
  "Ringkas kendalanya dalam satu kalimat",
  "Jelaskan selengkapnya — apa kendalanya dan bantuan seperti apa yang dibutuhkan",
  "Kirim Aspirasi", "Aspirasi terkirim. Dinas akan meninjaunya.", "Aspirasi Anda",
  // Sisi wisatawan
  "Halo", "penjelajah",
  "Setiap penilaian yang Anda berikan ikut membentuk skor kepercayaan UMKM di kawasan Danau Toba — dan membantu usaha yang belum dikenal mendapat kesempatan yang sama.",
  "Penilaian Anda", "usaha dinilai", "rata-rata",
  "Belum ada penilaian. Susun rencana perjalanan, lalu beri penilaian pada rumah makan yang Anda kunjungi — satu akun satu penilaian per usaha, dan bisa diubah kapan saja.",
  "Rekomendasi Lainnya", "Bersponsor",
  // Rating pada slot Rekomendasi Lainnya
  "Belum ada penilaian", "Beri penilaian", "penilaian",
  "Penilaian tersimpan. Terima kasih!",
  "Masuk untuk memberi penilaian — satu akun satu penilaian per usaha.",
  "Rating dibekukan", "Rating sedang dibekukan.",
  // Penilaian tempat makan pada kartu agenda
  "Penilaian Anda saat ini",
  // Suara kewajaran harga
  "Menu & kewajaran harga", "Memuat menu...",
  "Usaha ini belum mendaftarkan produk, jadi belum ada harga untuk dinilai.",
  "median sekitar", "belum ada pembanding", "menilai wajar",
  "belum ada penilaian harga", "Wajar", "Kemahalan",
  "Masuk untuk ikut menilai kewajaran harga.",
  // Ulasan masuk di dashboard UMKM
  "Ulasan Masuk",
  "Penilaian wisatawan atas usaha Anda — identitas penilai tidak ditampilkan",
  "Belum ada penilaian. Usaha tanpa rating tetap muncul di slot Rekomendasi Lainnya — justru di situlah penilaian pertama biasanya datang.",
  "puas", "Semua penilaian masuk tanpa komentar tertulis.",
  // Status slot bersponsor (dicabut)
  "Tidak ada slot bersponsor", "Penempatan berbayar tidak tersedia, dan kodenya tidak ada di dalam produk ini. Urutan yang Anda lihat pada rekomendasi sepenuhnya berasal dari relevansi — tidak ada satu pun jalur yang bisa dibeli.", "Bila kelak dihidupkan, aturannya akan diterbitkan lebih dulu di halaman ini — sebelum ada uang yang terlibat, bukan sesudahnya.",

  // ── Analisis Pasar (Fase 10) ─────────────────────────────────────────
  // Navigasi & pintasan
  "Lainnya", "Analisis Pasar", "Pintasan halaman", "Daftarkan menu dan harga",
  "Riwayat, posisi harga, ekspor", "Kirim kendala ke dinas", "Paket Anda dan isinya",
  // Kerangka halaman
  "Riwayat performa usaha Anda, posisinya terhadap sekitar, dan datanya untuk dibawa keluar",
  "Paket Anda",
  "Paket menentukan seberapa dalam Anda melihat pasar — bukan seberapa tinggi Anda muncul di rekomendasi wisatawan.",
  // Riwayat performa
  "Riwayat Performa", "bulan di paket lebih tinggi", "Dilihat", "kali dibuka wisatawan",
  "Penilaian masuk", "belum ada rata-rata", "Suara harga", "Penilaian",
  "Belum ada aktivitas tercatat pada periode ini. Angka mulai terisi begitu usaha Anda muncul di rencana wisatawan dan mulai dinilai.",
  "Dihitung dari jejak pemakaian nyata: tampilan halaman usaha, penilaian wisatawan, suara kewajaran harga, dan setiap kali harga produk dinilai ulang. Tidak ada angka yang disimulasikan.",
  // Posisi harga
  "Posisi Harga Anda", "Median wilayah", "Anda",
  "Harga tengah Anda berada di persentil", "artinya sekitar",
  "titik harga pembanding lebih murah dari Anda.",
  "TERMURAH", "DI BAWAH TENGAH", "SEKITAR TENGAH", "DI ATAS TENGAH", "TERMAHAL",
  "TANPA ACUAN",
  "Persentil empiris terhadap titik harga nyata pada dataset — kedua ujung pita harga tiap rumah makan, bukan titik tengahnya.",
  // Posisi permintaan
  "Posisi Permintaan", "Sinyal ulasan 12 bulan sekabupaten",
  "Belum cukup pembanding di wilayah ini.", "rumah makan terdata", "teratas",
  "Usaha Anda belum ada pada dataset ulasan.", "Sinyal Anda", "ulasan 12 bulan",
  "Rating wilayah", "Status tren",
  "Riwayat ulasan usaha Anda menyentuh batas pengambilan data, jadi pertumbuhannya tidak dapat diukur — bukan berarti nol.",
  // Celah menu
  "Celah Menu", "Kuliner khas kawasan yang belum Anda tawarkan",
  "Daftar kuliner khas belum bisa dibaca di server.", "Skor UMKM lokal atas menu Anda",
  "Sudah ada di menu", "Belum ditawarkan",
  "Skor ini disimulasikan atas menu yang Anda daftarkan, memakai fungsi yang sama dengan mesin rekomendasi. Kuliner khas menaikkan skor karena ia menandai keotentikan menu — bukan karena paket langganan Anda.",
  // Agregat usaha terdaftar
  "Usaha Terdaftar Sekabupaten", "Agregat anonim",
  "Belum cukup usaha terdaftar untuk dibandingkan.", "Usaha lain",
  "terdaftar di kabupaten", "Median harga mereka", "Kategori paling ramai", "usaha",
  "kategori lain disembunyikan karena hanya dipakai sedikit usaha — menampilkannya sama dengan menunjuk usaha tertentu.",
  // Jam & musim
  "Jam & Musim", "Patokan operasional wilayah Anda", "Jam buka Anda", "belum diisi",
  "destinasi di wilayah ini buka sampai pukul 20.00.",
  "Siapkan stok dan tenaga menjelang periode ini.",
  // Anonimitas & netralitas
  "Analisis ini tidak mengubah posisi Anda di rekomendasi wisatawan. Paket menentukan apa yang bisa Anda LIHAT, bukan urutan yang dilihat orang lain.",
  // Ekspor CSV
  "Unduh data usaha Anda untuk diolah di spreadsheet", "Produk & harga",
  "Riwayat bulanan", "Berkas terunduh",
  "Berkas berisi data usaha Anda sendiri. Identitas pemberi rating dan suara harga tidak pernah ikut terekspor.",
  "Rentang riwayat mengikuti jendela paket Anda:",
  // Kartu fitur terkunci
  "Lihat paket", "paket Anda", "Gratis", "Growth", "Pro",
  "Naik paket menambah kedalaman insight — bukan posisi Anda di rekomendasi wisatawan.",
  "Analisis kompetitor sekabupaten",
  "Lihat posisi harga dan permintaan usaha Anda dibanding rumah makan lain di kabupaten yang sama — seluruhnya anonim, tanpa satu pun nama pesaing.",
  "Posisi harga tiap produk pada sebaran nyata sekabupaten",
  "Peringkat sinyal permintaan Anda dari sekian rumah makan terdata",
  "Kuliner khas kawasan yang belum ada di menu Anda",
  "Agregat disupresi bila pembandingnya terlalu sedikit untuk anonim",
  "Bawa data usaha Anda keluar dari dashboard — untuk laporan, pengajuan bantuan, atau diolah sendiri di spreadsheet.",
  "Produk & harga lengkap dengan status pemeriksaan dan skor verifikasi",
  "Penilaian wisatawan dan suara kewajaran harga, tanpa identitas penilai",
  "Riwayat bulanan sepanjang jendela paket Anda",
  "Langsung terbaca di Excel — tanpa wizard impor",
  // Isi paket pada halaman Langganan
  "Yang termasuk paket Anda", "Tekan salah satu untuk langsung membuka halamannya",
  "terkunci", "Belum termasuk paket ini", "kali tersisa periode ini",
  "Analisis kompetitor", "Anonim, sekabupaten", "Jendela", "bulan",
  "Produk, penilaian, riwayat",

  // ── Biodata pengguna ──────────────────────────────────────────────────
  "Biodata", "Ubah", "Ubah Biodata", "Lengkapi Biodata Anda",
  "Perubahan langsung berlaku. Hanya nama yang wajib diisi.",
  "Sekali saja, lalu Anda tidak akan ditanya lagi. Hanya nama yang wajib — sisanya boleh dilewati dan bisa diisi kapan pun dari halaman Akun.",
  "Nama lengkap", "Nama lengkap wajib diisi.",
  "Nama sesuai yang ingin Anda tampilkan", "Nomor telepon",
  "Dipakai bila pemilik usaha perlu menghubungi Anda soal reservasi.",
  "Kota asal", "mis. Medan", "Negara", "Bahasa utama", "mis. Indonesia",
  "Tanggal lahir", "Jenis kelamin", "Tidak diisi",
  "Laki-laki", "Perempuan", "Tidak disebutkan",
  "Kota asal, tanggal lahir, dan jenis kelamin hanya dipakai sebagai angka gabungan di dashboard pemerintah — tidak pernah ditampilkan per orang, dan tidak pernah ikut ke data itinerary yang dibaca dinas.",
  "Simpan Perubahan", "Simpan & Lanjutkan",

  // ── Perjalanan tersimpan, ulasan, laporan lapangan ────────────────────
  "Beri penilaian keseluruhan terlebih dahulu.",
  "Terima kasih. Tersimpan",
  "penilaian usaha",
  "laporan lapangan",
  "Ulasan Perjalanan Anda",
  "Bagaimana perjalanan Anda?",
  "Penilaian usaha sampai ke pemilik warung dan skor kepercayaannya.",
  "Laporan lapangan sampai ke dinas pariwisata secara anonim — tidak pernah memengaruhi skor usaha mana pun.",
  "Kembali ke halaman saya",
  "Perjalanan ini belum selesai. Ulasan bisa diberikan setelah tanggal terakhir perjalanan terlewati.",
  "Penilaian keseluruhan",
  "Saya tidak jadi berangkat.",
  "Ulasan Anda tetap tersimpan dan tetap berguna, tetapi laporan lapangannya tidak akan dipakai sebagai bukti oleh dinas.",
  "Biaya nyata dibanding perkiraan aplikasi",
  "Kepadatan jadwal harian",
  "Catatan bebas",
  "Apa yang paling berkesan, dan apa yang perlu diperbaiki?",
  "Tempat yang Anda lewati",
  "Daftar ini diambil dari rencana Anda. Hanya tempat di sini yang bisa dinilai dan dilaporkan.",
  "Tidak ada tempat tercatat pada perjalanan ini.",
  "Menginap",
  "Laporkan masalah",
  "sebelumnya",
  "Kirim Ulasan",
  "Ulasan hanya bisa dikirim satu kali per perjalanan.",
  "Perjalanan Saya",
  "Laporan untuk dinas",
  "Hapus laporan ini",
  "Jenis masalah",
  "Tingkat",
  "Jelaskan apa yang Anda temui di lokasi...",
  "Biaya",
  "Jadwal",
  "Anda menandai perjalanan ini tidak dijalankan; laporannya tidak dipakai dinas sebagai bukti lapangan.",
  "Laporan Anda ke dinas",
  "Laporan Lapangan",
  "Pengamatan wisatawan yang perjalanannya sudah selesai di",
  "Pengamatan wisatawan yang perjalanannya sudah selesai di seluruh kawasan",
  "Total laporan",
  "Ulasan perjalanan",
  "Rata-rata kepuasan",
  "Terkumpul",
  "laporan, masih di bawah ambang",
  "Angka di halaman ini belum layak dipakai memeringkat wilayah maupun membantah sumbu analisis kesenjangan.",
  "Akurasi rencana yang disusun sistem",
  "wisatawan menilai biaya nyata lebih tinggi dari perkiraan aplikasi. Angka ini menilai estimasi kami, bukan kinerja kabupaten.",
  "Tekanan per kabupaten",
  "Laporan",
  "Berat",
  "Konfirmasi fasilitas",
  "Masalah pendataan",
  "n kecil",
  "\"Konfirmasi fasilitas\" adalah laporan yang membenarkan sumbu fasilitas pada analisis kesenjangan — satu-satunya bukti lapangan atas sumbu yang selama ini hanya diturunkan dari CSV. \"Masalah pendataan\" berarti jadwal atau data tempat di aplikasi tidak sesuai kenyataan.",
  "Jenis masalah terbanyak",
  "Kotak masuk laporan",
  "Laporan tidak memuat identitas pelapor — jalur bacanya memang tidak membawanya.",
  "Semua",
  "Semua jenis masalah",
  "Belum ada laporan pada saringan ini.",
  "Tulis tindak lanjut atas laporan ini...",
  "Umpan Balik Perjalanan",
  "Dari wisatawan yang rencananya memang melewati tempat Anda dan sudah selesai",
  "Penilaian bersaksi",
  "Rata-rata",
  "Laporan lapangan",
  "Bisa Anda perbaiki",
  "Berbeda dari penilaian biasa: yang ini dipastikan berasal dari akun yang rencana perjalanannya memuat tempat Anda dan tanggalnya sudah lewat. Bobotnya pada skor kepercayaan sama seperti penilaian lain — penandaannya untuk transparansi, bukan untuk mengubah skor.",
  "Belum ada. Penilaian bersaksi muncul setelah wisatawan yang melewati tempat Anda menyelesaikan perjalanannya dan mengisi ulasan.",
  "Laporan lapangan yang menyangkut tempat Anda",
  "Laporan ini TIDAK memengaruhi skor kepercayaan maupun status harga usaha Anda. Muaranya dinas pariwisata. Sebagian besar isinya di luar kendali Anda — jalan, papan penunjuk, sinyal — dan Anda melihatnya di sini supaya bisa meneruskannya ke dinas.",
  "laporan bisa Anda selesaikan sendiri",
  "— wisatawan menemukan tempat Anda tutup padahal jam buka di aplikasi menyatakan buka. Perbarui jam buka di halaman Usaha & Produk.",
  "Belum ada laporan yang menyangkut tempat Anda.",
  "Teruskan ke dinas lewat Aspirasi",
  "Rencana Perjalanan",
  "disimpan",
  "Lihat ulasan",
  "Beri Ulasan",
  "Bisa diulas setelah perjalanan selesai",
  "Hapus dari Perjalanan Saya",
  "Rencana ini ditampilkan apa adanya seperti saat disimpan — tidak disusun ulang. Harga dan jam buka bisa sudah bergeser sejak itu; laporkan lewat ulasan bila Anda menemukan perbedaannya.",
  "tanpa tanggal",
  "tidak disimpan",
  "Buka rencana",
  "Belum diulas",
  "Belum bisa diulas",
  "Perjalanan Aktif",
  "Rencana yang Anda simpan dan belum selesai. Klik untuk membukanya kembali.",
  "Perjalanan Anda sudah selesai",
  "Ceritakan bagaimana kenyataannya. Penilaian Anda menggerakkan skor kepercayaan UMKM, dan laporan lapangan Anda masuk ke dinas pariwisata secara anonim.",
  "Riwayat Perjalanan",
  "Akun & perjalanan saya",
  "Ada perjalanan yang menunggu ulasan",
  "Perjalanan Tersimpan",
  "Belum ada. Susun rencana lalu tekan Simpan Perjalanan untuk menemukannya di sini.",
  "menunggu ulasan",
  "Lihat semua perjalanan",
  "Fasilitas Umum",
  "di",
  "Daftar ini berdasarkan kabupaten yang dilalui, bukan jarak — data sumbernya tidak memuat koordinat.",
  "libur",
  "Simpan rencana ke Perjalanan Saya",
  "Menyimpan…",
  "Tersimpan",
  "Simpan Perjalanan",
  "Masuk untuk menyimpan rencana dan mengunduh PDF",
  "Masuk untuk simpan & ekspor PDF",
  "Trip pulang-hari",
  "Akses jalan",
  "Fasilitas umum",
  "Kebersihan",
  "Papan penunjuk arah",
  "Sinyal komunikasi",
  "Keamanan",
  "Tarif tidak resmi",
  "Jam buka tidak sesuai",
  "Ringan",
  "Baru",
  "Dibaca",
  "Ditolak",
  "Jauh lebih murah",
  "Lebih murah",
  "Sesuai perkiraan",
  "Lebih mahal",
  "Jauh lebih mahal",
  "Terlalu padat",
  "Pas",
  "Terlalu longgar",
  "Akan datang",
  "Sedang berjalan",
  "Tanpa tanggal",
];

/**
 * Sidik jari pendek dari isi STRING_UI (FNV-1a, base36).
 *
 * Dipakai sebagai VERSI kunci cache. Sebelumnya kuncinya polos
 * (`tourcation.dict.ja`), sehingga `bacaKamus` yang mengembalikan cache lama
 * membuat pengguna yang pernah memilih sebuah bahasa TIDAK PERNAH melihat
 * string yang ditambahkan sesudahnya — persis yang akan terjadi saat empat
 * dashboard menambah ratusan label.
 *
 * Versi diturunkan otomatis dari isinya, bukan konstanta yang harus diingat
 * untuk dinaikkan manual: menambah satu string saja sudah mengubah kuncinya
 * dan memicu pengambilan ulang dengan sendirinya.
 */
function sidik(daftar: string[]): string {
  let h = 0x811c9dc5;
  for (const s of daftar) {
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x0a; // pemisah antar entri: ["ab","c"] != ["a","bc"]
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const VERSI_KAMUS = sidik(STRING_UI);
const KUNCI_KAMUS = (kode: string) => `${AWALAN_KAMUS}${kode}.v${VERSI_KAMUS}`;

/** Buang kamus versi lama agar localStorage tidak menumpuk tiap kali berubah. */
function sapuKamusUsang() {
  try {
    const buang: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(AWALAN_KAMUS) && !k.endsWith(`.v${VERSI_KAMUS}`)) {
        buang.push(k);
      }
    }
    buang.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* localStorage diblokir — tidak apa-apa, cache memang opsional */
  }
}

function bacaKamus(kode: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(KUNCI_KAMUS(kode));
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

function simpanKamus(kode: string, kamus: Record<string, string>) {
  try {
    localStorage.setItem(KUNCI_KAMUS(kode), JSON.stringify(kamus));
  } catch {
    /* localStorage penuh atau diblokir — abaikan, cukup jalan tanpa cache */
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<string>(
    () => localStorage.getItem(KUNCI_BAHASA) || "id",
  );
  const [langs, setLangs] = useState<Bahasa[]>([]);
  const [kamus, setKamus] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    sapuKamusUsang();
    fetchLanguages()
      .then(setLangs)
      .catch(() => setLangs([]));
  }, []);

  // EN statis, ID kosong (bahasa dasar), sisanya cache lalu AI.
  useEffect(() => {
    let batal = false;
    setGalat(null);

    if (lang === "id") {
      setKamus({});
      return;
    }
    if (lang === "en") {
      setKamus(EN);
      return;
    }

    const tersimpan = bacaKamus(lang);
    if (tersimpan) {
      setKamus(tersimpan);
      return;
    }

    setMemuat(true);
    translateUI(STRING_UI, lang)
      .then((m) => {
        if (batal) return;
        setKamus(m);
        simpanKamus(lang, m);
      })
      .catch((e: Error) => {
        if (batal) return;
        setKamus({});
        setGalat(e.message || "Gagal memuat terjemahan.");
      })
      .finally(() => !batal && setMemuat(false));

    return () => {
      batal = true;
    };
  }, [lang]);

  const setLang = useCallback((kode: string) => {
    setLangState(kode);
    try {
      localStorage.setItem(KUNCI_BAHASA, kode);
    } catch {
      /* abaikan */
    }
    document.documentElement.lang = kode;
  }, []);

  const t = useCallback((teks: string) => kamus[teks] ?? teks, [kamus]);

  const value = useMemo<I18nValue>(
    () => ({ lang, langs, setLang, t, memuat, galat }),
    [lang, langs, setLang, t, memuat, galat],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Pintasan bila komponen hanya butuh fungsi terjemahannya. */
export function useT(): (teks: string) => string {
  return useContext(I18nContext).t;
}
