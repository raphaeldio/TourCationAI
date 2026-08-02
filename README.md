# TourCation AI: Perencana Perjalanan Danau Toba Berbasis Optimasi Anggaran
# Submission Hackathon IT DEL 2026

> **PENTING - ATURAN BLIND REVIEW:** 
> Peserta **DILARANG KERAS** mencantumkan nama institusi/universitas/sekolah asal di dalam file ini maupun di seluruh _source code_. Pelanggaran terhadap aturan ini dapat berakibat pada pengurangan nilai atau diskualifikasi.

---

## 1. Deskripsi Singkat

Informasi wisata Danau Toba sebenarnya sudah melimpah — daftar destinasi, ulasan, dan rentang harga mudah ditemukan — namun wisatawan tetap kesulitan pada langkah berikutnya: **menyusun keputusan** berupa kombinasi destinasi, penginapan, dan tempat makan yang pasti tidak melampaui anggaran, masuk akal secara rute dan jam operasional, serta benar-benar menyentuh usaha lokal. Persoalan ini adalah *constrained optimization*, bukan pencarian informasi.
  
TourCation AI menyusun itinerary lengkap dari satu input (anggaran, durasi, jumlah orang, minat): agenda harian berjam, urutan rute, deteksi penyeberangan feri ke Samosir, rincian biaya, serta analisis dampak ekonomi ke UMKM lokal. **Inti sistem adalah model _Integer Linear Programming_ (PuLP + solver CBC)** yang memilih destinasi/kuliner/penginapan di bawah kendala anggaran, sehingga hasilnya deterministik, dapat direproduksi, dan setiap angkanya dapat ditelusuri ke dataset panitia. Pendekatan analitik pendukungnya mencakup *geospatial routing* (OSRM/haversine + *nearest-neighbour* untuk urutan kunjungan), *rule-based time-aware filtering* atas jam operasional, dan **UMKM Scorer** — pembobotan tiga sinyal (penyajian kuliner khas Batak, pola nama usaha lokal, keterjangkauan harga) yang menjadi suku tambahan pada fungsi objektif ILP.

Model bahasa (`gpt-4o-mini`) ditempatkan **hanya pada lapisan antarmuka** untuk dua fitur opsional: AI Search yang dibumikan (*grounded/RAG-ringan*) pada itinerary aktif beserta cuplikan review dari dataset, dan penerjemah 18 bahasa. Harga, anggaran, jarak, dan koordinat tidak pernah dijadikan hasil generasi model — sehingga tidak ada ruang halusinasi pada angka yang menjadi dasar keputusan wisatawan.

## 2. Anggota Tim

| Nama Lengkap | Peran dalam Tim | Kontak (Email) |
| :--- | :--- | :--- |
| [Raphael Diovana Tarigan(ketua tim)] | Full Stack Engineer - AI/Optimization | [Email: raphaelardeldiovana@gmail.com] |
| [Michael Aaron Hutagaol] | UI/UX Engineer | [Email: michaelaaron062608@gmail.com] |
| [Sinari Ilene Situmorang] | Researcher & QA | [Email: sinariilenesitumorang1929@gmail.com ] |

## 3. Pemanfaatan Data Pariwisata Toba

Solusi ini dibangun **sepenuhnya di atas Lake Toba Smart Tourism Knowledge Dataset** dari panitia. Tidak ada dataset harga, jarak, maupun jam operasional dari sumber lain.

### Data Utama

| Berkas dataset (`data/`) | Dipakai untuk |
| :--- | :--- |
| `wisata-metadata_typed.csv` | 137 destinasi: harga, rating, koordinat, alamat — kandidat variabel keputusan ILP |
| `resto-metadata_typed.csv` | 117 tempat makan: harga min/max, rating, koordinat — kandidat slot makan |
| `hotel-metadata_typed.csv` | 27 penginapan: acuan titik pangkal seluruh perhitungan jarak |
| `waktu_operasional_destinasi_typed.csv` | Time-Aware Filter: jam buka dan hari tutup mingguan |
| `transportasi_typed.csv` | Tarif feri penyeberangan & tarif angkutan umum untuk komponen biaya transport |
| `kuliner_typed.csv` | Daftar kuliner khas Batak — sinyal utama skor UMKM & metrik ragam kuliner |
| `wisata-v2_typed.csv` | Review pengunjung destinasi — cuplikan konteks untuk AI Search |
| `resto-hotel-v2_typed.csv` | Review pengunjung resto/hotel — cuplikan konteks untuk AI Search |
| `Info_Seputar_Danau_Toba_typed.csv` | Fasilitas umum (SPBU, ATM, dsb.) per kabupaten yang dilalui rute |

Berkas dataset lain yang tetap disertakan di `data/` untuk kelengkapan (`Artikel_Danau_Toba`, `Attractions_Info`, `prompt`, `tempat-wisata-v1`, `hotel-resto-v1`) **tidak** dipakai oleh alur produksi saat ini.

### Pengolahan

Pra-pemrosesan dilakukan **di dalam kode saat runtime** (`engine.py`), sehingga juri dapat menelusuri setiap transformasi tanpa berkas antara:

1. **Perbaikan CSV rusak** — berkas metadata hotel memiliki setiap baris terbungkus tanda kutip dan berakhiran `;;`, serta sebagian `place-name` memuat koma tanpa kutip sehingga jumlah kolomnya berlebih. Parser khusus `_baca_csv_hotel()` merapikan header, memecah ulang kolom, dan mengembalikan tipe numerik.
2. **Pembersihan baris tidak layak** — `dropna` atas `harga_min`, `place-rating`, `latitude`, `longitude`. Baris tanpa koordinat atau harga dibuang karena tidak dapat masuk ke fungsi objektif maupun perhitungan jarak.
3. **Deduplikasi lintas tabel** — entitas yang muncul di dataset resto sekaligus dataset hotel dinormalisasi namanya lalu disatukan agar tidak dihitung ganda.
4. **Turunan kolom** — `harga_max` yang kosong diisi dari `harga_min`, lalu dibentuk `harga_tengah = (harga_min + harga_max) / 2`. Kendala anggaran ILP sengaja dipasang pada **`harga_max`**, bukan `harga_tengah`, agar rencana tetap aman ketika wisatawan menukar pilihan makan/penginapan.
5. **Anotasi jam operasional** — string jam diurai menjadi jam buka/tutup dan daftar hari tutup; sumber jam ditandai (`sumber_jam`) agar UI dapat menampilkan peringatan bila data tidak tersedia.
6. **Pengayaan geospasial** — jarak antar titik dihitung via OSRM (jarak jalan nyata) dengan *fallback* otomatis ke haversine bila jaringan tidak tersedia; kabupaten dideteksi dari string alamat (berhasil pada 134 dari 137 destinasi).
7. **Skoring UMKM** — tiap tempat makan diberi skor 0–1 dari tiga sinyal berbobot: menyajikan kuliner khas Batak (0,5), pola nama usaha lokal seperti BPK/RM/Lapo/Warung (0,3), harga terjangkau ≤ Rp25.000 (0,2).

### Data Tambahan

Tidak ada dataset tabular eksternal. Yang dipakai hanyalah **layanan geospasial publik** (bukan dataset yang diunduh):

| Layanan | Fungsi | Tautan |
| :--- | :--- | :--- |
| OSRM (demo server) | Jarak & durasi tempuh jalan nyata antar koordinat | https://project-osrm.org |
| OpenStreetMap | Ubin peta pada tampilan rute | https://www.openstreetmap.org |
| Nominatim | Geocoding titik berangkat kustom | https://nominatim.openstreetmap.org |

## 4. Tautan & Aset Pendukung

- **Link Video Demonstrasi (Wajib):** [Tautan Video - Pastikan dapat diakses/Unlisted]
- **Link Pitch Deck / Proposal (Wajib):** [Tautan Dokumen PDF]
- **Dokumentasi model & indikator keberhasilan:** [`DOKUMENTASI_MODEL.md`](DOKUMENTASI_MODEL.md) (versi PDF: `DOKUMENTASI_MODEL.pdf`)
- **Laporan evaluasi model:** [`evaluasi/evaluation_report.md`](evaluasi/evaluation_report.md) (versi PDF: `evaluasi/evaluation_report.pdf`)

## 5. Struktur Repository

```text
.
├── engine.py                 # INTI SISTEM — model ILP, rute, agenda, feri, skor UMKM (7 modul)
├── backend/
│   ├── main.py               # FastAPI: membungkus engine.py jadi JSON API (tanpa logika perencanaan)
│   └── requirements.txt      # Dependensi untuk menjalankan aplikasi
├── frontend/                 # UI React + TypeScript (Vite + Tailwind + Leaflet)
│   ├── src/pages/            # Halaman: beranda, itinerary, peta, galeri
│   ├── src/components/       # Komponen UI (papan itinerary, peta rute, dampak UMKM)
│   ├── src/exportPdf.ts      # Ekspor rencana ke PDF
│   └── src/i18n.tsx          # Lapisan multibahasa
├── data/                     # 14 berkas CSV dataset panitia (*_typed.csv)
├── evaluasi/                 # Kerangka evaluasi model
│   ├── evaluate.py           # Batch testing budget × durasi × wisatawan + ablation study
│   ├── modul/                # Evaluator per modul: ferry, rute, time_filter, umkm, ablation
│   ├── evaluation_report.md  # Hasil eksekusi terakhir (siap dibaca tanpa menjalankan ulang)
│   ├── evaluation_charts/    # 8 grafik hasil evaluasi
│   └── *_report.csv          # Keluaran mentah tiap modul
├── uji/                      # Skrip kalibrasi & audit engine (dasar angka di DOKUMENTASI_MODEL.md)
├── DOKUMENTASI_MODEL.md      # Dokumentasi desain model & indikator keberhasilan
├── requirements.txt          # Dependensi untuk menjalankan evaluasi model
├── .env.example              # Template environment variable
└── README.md
```

Data disimpan sebagai berkas CSV yang dimuat ke pandas saat startup. Tidak ada basis data karena beban kerjanya optimasi numerik atas dataset statis, bukan pengelolaan *state* — setiap *solve* memerlukan seluruh kandidat berada di memori.

## 6. Prasyarat (Requirements)

- **Environment:** Python 3.10 atau lebih baru **dan** Node.js 18 atau lebih baru.
- **Package manager:** `pip` (Python) dan `npm` (Node).
- **Software tambahan:** tidak ada. Tidak memerlukan Docker maupun basis data — solver CBC sudah ikut terpasang bersama paket `pulp`.
- **API Key Eksternal:**
  - **OpenAI** (`OPENAI_API_KEY`) — **OPSIONAL**. Aplikasi berjalan penuh tanpanya; yang nonaktif hanya **AI Search** dan **Penerjemah**. Seluruh penyusunan itinerary, rute, peta, biaya, dan analisis UMKM tidak memanggilnya sama sekali.
  - Tidak ada API key lain. OSRM, OpenStreetMap, dan Nominatim dipakai tanpa autentikasi; bila internet tidak tersedia, jarak otomatis jatuh ke estimasi haversine dan sistem menandainya pada hasil.
- **Catatan:** repositori ini **tidak** memuat API key asli. Berkas `.env` diblokir oleh `.gitignore`.

## 7. Environment Variables

Berkas [`.env.example`](.env.example) sudah tersedia di root repo. Salin menjadi `.env`, lalu isi seperlunya:

```env
# Opsional — hanya untuk AI Search & Penerjemah.
# Kosongkan bila juri tidak ingin memakai kunci: aplikasi tetap berjalan penuh.
OPENAI_API_KEY=isi_dengan_api_key_openai_anda
OPENAI_MODEL_NAME=gpt-4o-mini
```

Variabel frontend seluruhnya **opsional** dan punya nilai bawaan di `frontend/src/config.ts` (video hero, logo, foto hero). Bila ingin menggantinya, buat `frontend/.env` berisi `VITE_VIDEO_URL`, `VITE_HERO_MEDIA_URL`, `VITE_HERO_FOTO_URL`, atau `VITE_BRAND_LOGO_URL`. Tidak ada basis data, sehingga `DATABASE_URL` tidak diperlukan.

## 8. Langkah Instalasi & Menjalankan Project Secara Lokal

Aplikasi terdiri dari backend dan frontend, jadi diperlukan **dua terminal**. Keduanya dijalankan dari folder repo.

### Terminal 1 — Backend

```bash
# 1. Clone repository
git clone https://github.com/raphaeldio/TourCationAI
cd TourCationAI

# 2. Buat virtual environment
python -m venv .venv
source .venv/bin/activate      # Untuk Mac/Linux
# .venv\Scripts\activate       # Untuk Windows (PowerShell/CMD)

# 3. Install dependencies backend
pip install -r backend/requirements.txt

# 4. Salin file environment variable (opsional — hanya untuk AI Search & Penerjemah)
cp .env.example .env
# (Lalu isi OPENAI_API_KEY di dalam .env. Boleh dilewati; aplikasi tetap jalan.)

# 5. Jalankan API
python -m uvicorn backend.main:app --reload --port 8000
```

Tunggu sampai terminal menampilkan `Application startup complete`.

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Buka **http://localhost:5173** di peramban.

> Vite meneruskan `/api/*` ke backend di port 8000, jadi tidak ada CORS atau URL yang perlu diatur manual. **Permintaan pertama memerlukan beberapa detik** karena seluruh dataset CSV dimuat sekali ke memori.

## 9. Cara Menggunakan / Testing (Evaluasi Model)

### A. Mencoba aplikasi (alur demo yang disarankan)

Buka `http://localhost:5173`, lalu:

1. **Panel "Atur Perjalanan"** di sisi kanan — contoh input untuk menguji fitur inti:
   - Anggaran: **Rp5.000.000**
   - Durasi: **3 hari / 2 malam**
   - Jumlah orang: **2**
   - Minat: **Alam, Budaya, Kuliner**
   - Moda: **mobil**

   Tekan **Susun Rencana**; layar otomatis membawa ke hasil.
2. **Papan itinerary** — agenda per hari lengkap dengan jam kunjungan. Setiap slot makan menyediakan alternatif; menukarnya memperbarui total biaya dan angka dampak UMKM secara langsung.
3. **Bandingkan penginapan** — pilih hotel lain dari daftar kandidat. Rencana disusun **ulang** sepenuhnya (ILP dijalankan kembali), karena hotel adalah titik acuan seluruh jarak.
4. **Peta rute** — pilih hari, ubah titik berangkat, tambah singgahan dari chip "Destinasi Terdekat", lalu **DRIVE NOW** untuk membuka Google Maps.
5. **Dampak UMKM** — proporsi usaha lokal otentik, ragam kuliner khas, dan estimasi rupiah yang mengalir ke usaha lokal.
6. **Ekspor PDF** — rencana lengkap beserta angka dampaknya.
7. *(perlu `OPENAI_API_KEY`)* **AI Search** di hero — contoh pertanyaan: *"Berapa total biaya makan selama perjalanan ini?"* atau *"Ceritakan tentang Bukit Holbung di rencana saya"*. **Penerjemah** mengambang di pojok layar (18 bahasa, termasuk Batak Toba).

### B. Menguji API secara langsung (tanpa UI)

**Cara termudah — lewat Swagger UI.** Backend menyediakan dokumentasi interaktif di **http://localhost:8000/docs**. Pilih `POST /api/itinerary` → tombol **Try it out** → ubah nilai JSON bila perlu → **Execute**. Tidak perlu mengetik perintah apa pun, dan berlaku sama di semua sistem operasi.

**Lewat terminal.** Perintahnya berbeda antara Windows dan macOS/Linux, jadi gunakan yang sesuai.

**Windows (PowerShell):**

```powershell
Invoke-RestMethod -Uri http://localhost:8000/api/itinerary -Method Post -ContentType 'application/json' -Body '{"budget_total":5000000,"n_days":3,"n_nights":2,"n_orang":2,"minat_wisata":["Alam","Kuliner"],"moda":"mobil"}'
```

> Di PowerShell, `curl` bukan curl asli melainkan alias untuk `Invoke-WebRequest`, sehingga flag `-H` dan `-d` **tidak dikenali** dan memunculkan error `Cannot bind parameter 'Headers'`. Karena itu dipakai `Invoke-RestMethod` yang merupakan perintah asli PowerShell — sekaligus otomatis mengurai balasan JSON menjadi objek, sehingga hasilnya bisa langsung diakses seperti `$hasil.summary.total_estimasi`.

**macOS / Linux / Git Bash di Windows:**

```bash
curl -X POST http://localhost:8000/api/itinerary -H "Content-Type: application/json" -d '{"budget_total":5000000,"n_days":3,"n_nights":2,"n_orang":2,"minat_wisata":["Alam","Kuliner"],"moda":"mobil"}'
```

> Body JSON dibungkus tanda kutip tunggal agar tanda kutip ganda di dalamnya tidak perlu di-*escape*.

**Balasan yang diharapkan** diawali `{"status":"Optimal", ...}`, diikuti `summary` (rincian biaya), `hotel`, `days` (agenda per hari), dan `dampak_lokal`. Permintaan pertama memerlukan beberapa detik karena seluruh dataset CSV dimuat sekali ke memori; permintaan berikutnya di bawah satu detik.

Endpoint lain yang dapat dicoba: `GET /api/health` (cek hidup), `GET /api/meta` (daftar minat, profil, gaya jelajah), dan `GET /api/languages` (daftar bahasa penerjemah). Ketiganya cukup dibuka langsung di peramban.

### C. Menjalankan evaluasi model

```bash
pip install -r requirements.txt
```

```bash
python evaluasi/evaluate.py
```

Skrip menyapu kombinasi **anggaran × durasi × jumlah wisatawan** (60 skenario), lalu menghasilkan `evaluasi/evaluation_results.csv`, delapan grafik di `evaluasi/evaluation_charts/`, dan `evaluasi/evaluation_report.md`. Termasuk *ablation study* yang membandingkan keluaran dengan dan tanpa UMKM Scorer, serta evaluasi terpisah untuk Ferry Detector, Route Optimizer, dan Time-Aware Filter.

**Hasil eksekusi terakhir sudah tersedia di folder `evaluasi/`**, jadi laporannya dapat dibaca tanpa perlu menjalankan ulang. Ringkasannya: 59 dari 60 skenario mencapai status `Optimal`, *Constraint Satisfaction Rate* 100% (tidak pernah melampaui anggaran), *mean diversity score* 81,4%, dan runtime median 0,475 detik per skenario.

Skrip kalibrasi dan audit yang menjadi dasar angka pada `DOKUMENTASI_MODEL.md` berada di folder `uji/` dan dapat dijalankan satu per satu, contoh:

```bash
python uji/perbandingan_hotel.py
```

## 10. Known Issues / Batasan

Disampaikan secara terbuka; uraian lengkap ada pada Bab 10 [`DOKUMENTASI_MODEL.md`](DOKUMENTASI_MODEL.md).

1. **Cakupan jadwal mingguan — keterbatasan paling serius.** Informasi hari tutup hanya tersedia untuk **20 dari 137 destinasi (14,6%)**. Untuk 117 destinasi selebihnya sistem hanya mengetahui jam buka tanpa informasi hari, sehingga kasus seperti museum yang tutup setiap Senin tidak selalu dapat dihindari. Keterbatasan ini bersumber dari dataset, bukan algoritma.
2. **Optimum bersifat bersyarat terhadap penginapan.** Penginapan dipilih di luar ILP (sebagai titik acuan jarak), sehingga status `Optimal` berlaku *diberikan* penginapan tersebut. Pengujian tanding atas seluruh 27 penginapan menempatkan pilihan sistem pada peringkat 2 dari 27 menurut jarak rata-rata — celahnya kecil, namun diuji pada satu skenario saja.
3. **Ambang anggaran minimum.** Di bawah ambang tertentu (mis. ±Rp533.736 untuk 3 hari/2 orang) solver mengembalikan status `Infeasible` disertai pesan yang dapat dibaca — sistem **tidak** menyusun rencana rekaan yang tidak mungkin dijalankan.
4. **Utilisasi anggaran cenderung konservatif** (rata-rata 44,3% pada dasar harga tengah). Ini pilihan perancangan: kendala dipasang pada `harga_max` agar wisatawan tetap aman saat menukar pilihan, dengan konsekuensi anggaran tidak terpakai habis.
5. **Tarif transportasi merupakan asumsi.** Dataset feri hanya memuat rentang Rp3.500–Rp250.000 tanpa rincian jenis kendaraan, sehingga tarif per moda merupakan hasil interpolasi (khususnya sepeda motor). Dataset angkutan umum hanya memuat empat operator antarkota, sehingga tarif angkutan lokal didekati dengan median.
6. **Ketergantungan jaringan pada OSRM.** Bila server OSRM publik lambat atau tidak dapat dijangkau, jarak otomatis jatuh ke estimasi garis lurus (haversine) yang lebih pendek dari jarak jalan sebenarnya. Sistem menandai kondisi ini pada hasil (`sumber_jarak`).
7. **Lapisan model bahasa bersifat non-deterministik.** Jawaban AI Search di luar konteks itinerary (pengetahuan umum) tidak dijamin akurat dan sudah diinstruksikan untuk ditandai sebagai bukan berasal dari dataset. Terjemahan istilah Batak Toba juga belum diverifikasi penutur asli.
8. **Skala prototipe.** Solver dimuat sekali per proses dan menyimpan dataset di memori; belum diuji untuk beban banyak pengguna serentak, dan belum ada persistensi rencana antar-sesi.
9. **Deteksi kabupaten berbasis string alamat** berhasil pada 134 dari 137 destinasi (97,8%); tiga destinasi sisanya tidak memperoleh rekomendasi fasilitas umum.

### Deklarasi penggunaan AI

Ide, konsep dasar, dan perumusan masalah sepenuhnya berasal dari tim — mencakup penetapan optimasi berbasis anggaran sebagai pendekatan inti, perumusan kriteria keberpihakan UMKM, dan rancangan alur pengalaman wisatawan. Inti sistem bukan model generatif: seluruh penyusunan itinerary dihasilkan model ILP yang deterministik, dengan angka harga, jarak, dan jam operasional diambil langsung dari dataset panitia. Model `gpt-4o-mini` dipakai terbatas pada AI Search dan penerjemahan di lapisan antarmuka. Dalam pengembangan, tim memakai asisten pemrograman berbasis AI untuk implementasi kode, antarmuka, dan dokumentasi, sementara seluruh arahan teknis, keputusan rancangan, peninjauan, dan pengujian tetap dipegang tim. Dataset tidak dihasilkan AI, dan angka pada laporan evaluasi berasal dari eksekusi nyata terhadap sistem.

## 📋 Aturan Submission (Wajib Dibaca & Dipatuhi)
1. **Hak Akses:** Repository harus bersifat **Private**. Peserta **WAJIB** mengundang akun email **aicenter.itdel@gmail.com** sebagai *Collaborator/Viewer* agar juri dapat mengakses kode.
2. **Kesesuaian Instruksi:** Panitia dan juri akan menjalankan _project_ secara lokal murni berdasarkan instruksi di *Langkah Instalasi* pada README ini. Pastikan langkah tersebut valid dan komplit.
3. **Keamanan:** Dilarang keras men-_commit_ API key, _credential_, atau file `.env` asli ke repository.
4. **Kelengkapan Kode:** Sertakan seluruh _source code_ yang relevan. Tidak boleh ada dependensi yang memaksa kode mengambil dari server privat peserta yang tidak bisa diakses panitia.
5. **Batas Waktu:** Perubahan/commit pada _repository_ setelah batas waktu submisi _Preliminary Round_ ditutup tidak akan dinilai, kecuali untuk penyesuaian akses atas permintaan panitia.
