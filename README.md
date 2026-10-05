# TourCation AI

**Perencana wisata Danau Toba yang tidak pernah melampaui anggaran, dan memastikan uang wisatawan sampai ke usaha lokal.**

[Coba demo langsung](https://tour-cation-ai-nu.vercel.app) | [Dokumentasi model](DOKUMENTASI_MODEL.md) | [Laporan evaluasi](evaluasi/evaluation_report.md)

> Layanan backend gratis di Render tidur setelah 15 menit idle, jadi akses pertama bisa memakan sekitar 50 detik. Ini perilaku platform, bukan error.

Proyek untuk Hackathon IT DEL 2026, dibangun di atas *Lake Toba Smart Tourism Knowledge Dataset* dari panitia.

<!-- Tambahkan 1-2 screenshot di sini, mis. papan itinerary dan peta rute:
![Papan itinerary](docs/screenshot-itinerary.png) -->

---

## Masalah yang diselesaikan

Informasi wisata Danau Toba sudah melimpah. Yang sulit adalah **memutuskan**: kombinasi destinasi, penginapan, dan tempat makan yang tidak melampaui anggaran, masuk akal secara rute dan jam buka, dan benar-benar menyentuh usaha lokal. Ini masalah *constrained optimization*, bukan pencarian informasi.

Dari satu input (anggaran, durasi, jumlah orang, minat), TourCation AI menyusun:

- agenda harian berjam dan urutan rute,
- deteksi penyeberangan feri ke Samosir,
- rincian biaya,
- analisis dampak ekonomi ke UMKM lokal,
- ekspor PDF.

## Keputusan desain utama

**Inti sistem bukan model generatif.** Penyusunan itinerary dilakukan model *Integer Linear Programming* (PuLP + solver CBC), sehingga hasilnya deterministik, dapat direproduksi, dan setiap angka bisa ditelusuri ke dataset.

| Lapisan | Teknik | Mengapa |
| --- | --- | --- |
| Pemilihan destinasi, kuliner, penginapan | ILP dengan kendala anggaran pada `harga_max` | Rencana tetap aman saat wisatawan menukar pilihan |
| Urutan kunjungan | OSRM (jarak jalan nyata) + nearest-neighbour, fallback haversine | Rute masuk akal, tetap jalan tanpa internet |
| Jam operasional | Filter berbasis aturan (jam buka, hari tutup) | Tidak menjadwalkan tempat yang tutup |
| Keberpihakan UMKM | Skor 0-1 dari tiga sinyal: kuliner khas Batak (0,5), nama usaha lokal (0,3), harga terjangkau (0,2), masuk ke fungsi objektif | Dampak lokal ikut dioptimasi, bukan sekadar dilaporkan |
| AI Search dan penerjemah 18 bahasa | `gpt-4o-mini`, hanya di lapisan antarmuka | Harga, anggaran, jarak, koordinat tidak pernah dihasilkan model, jadi tidak ada ruang halusinasi pada angka |

OpenAI bersifat **opsional**: tanpa API key, seluruh perencanaan, rute, peta, biaya, dan analisis UMKM tetap berjalan penuh.

## Hasil evaluasi

Dievaluasi pada 60 skenario (anggaran x durasi x jumlah wisatawan), termasuk *ablation study* dengan dan tanpa skor UMKM.

| Metrik | Hasil |
| --- | --- |
| Skenario berstatus `Optimal` | 59 dari 60 |
| Constraint Satisfaction Rate (tidak pernah melampaui anggaran) | 100% |
| Mean diversity score | 81,4% |
| Runtime median per skenario | 0,475 detik |

Laporan lengkap, grafik, dan skrip ada di folder [`evaluasi/`](evaluasi/). Hasil dapat dibaca tanpa menjalankan ulang.

## Arsitektur

```
engine.py      Inti sistem: model ILP, rute, agenda, feri, skor UMKM (7 modul)
backend/       FastAPI yang membungkus engine.py menjadi JSON API (tanpa logika perencanaan)
frontend/      React + TypeScript (Vite, Tailwind, Leaflet): beranda, itinerary, peta, galeri
data/          14 berkas CSV dataset panitia
evaluasi/      Evaluasi model: batch testing, ablation, laporan, grafik
uji/           Skrip kalibrasi dan audit yang menjadi dasar angka di dokumentasi
```

Tidak ada basis data: beban kerjanya optimasi numerik atas dataset statis, dan setiap *solve* membutuhkan seluruh kandidat di memori. Frontend (Vercel) meneruskan `/api/*` ke backend (Render) lewat rewrite, sehingga tidak ada urusan CORS.

## Menjalankan secara lokal

Prasyarat: Python 3.10+ dan Node.js 18+. Tanpa Docker, tanpa basis data.

**Terminal 1: backend**

```bash
git clone https://github.com/raphaeldio/TourCationAI
cd TourCationAI
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cp .env.example .env             # opsional, hanya untuk AI Search dan penerjemah
python -m uvicorn backend.main:app --reload --port 8000
```

**Terminal 2: frontend**

```bash
cd frontend
npm install
npm run dev
```

Buka <http://localhost:5173>. Permintaan pertama butuh beberapa detik karena dataset dimuat sekali ke memori.

Contoh input untuk dicoba: anggaran Rp5.000.000, 3 hari 2 malam, 2 orang, minat Alam, Budaya, Kuliner, moda mobil.

**Environment variable** (semua opsional):

```
OPENAI_API_KEY=isi_dengan_api_key_anda
OPENAI_MODEL_NAME=gpt-4o-mini
```

API dapat dicoba langsung lewat Swagger UI di <http://localhost:8000/docs> (`POST /api/itinerary`). Untuk menjalankan evaluasi: `pip install -r requirements.txt` lalu `python evaluasi/evaluate.py`.

## Batasan yang diketahui

Disampaikan terbuka. Uraian lengkap di Bab 10 [`DOKUMENTASI_MODEL.md`](DOKUMENTASI_MODEL.md).

1. **Cakupan hari tutup hanya 14,6%** (20 dari 137 destinasi). Ini keterbatasan dataset, bukan algoritma.
2. **Optimum bersyarat terhadap penginapan.** Penginapan dipilih di luar ILP sebagai titik acuan jarak. Pada pengujian atas 27 penginapan, pilihan sistem berada di peringkat 2 (satu skenario saja).
3. **Anggaran terlalu kecil** menghasilkan status `Infeasible` dengan pesan yang bisa dibaca. Sistem tidak menyusun rencana rekaan.
4. **Utilisasi anggaran konservatif** (rata-rata 44,3%), pilihan desain agar rencana aman saat pilihan ditukar.
5. **Tarif transportasi sebagian merupakan asumsi** (interpolasi dari rentang tarif feri).
6. **Ketergantungan pada server OSRM publik**; bila tidak terjangkau, jarak jatuh ke estimasi garis lurus dan ditandai pada hasil.
7. **Lapisan LLM non-deterministik.** Terjemahan Batak Toba belum diverifikasi penutur asli.
8. **Skala prototipe**: belum diuji untuk banyak pengguna serentak dan belum ada persistensi antar-sesi.

## Bagaimana AI dipakai dalam pengembangan

Ide, perumusan masalah, dan keputusan rancangan berasal dari tim: optimasi berbasis anggaran sebagai pendekatan inti, kriteria keberpihakan UMKM, dan alur pengalaman wisatawan. Asisten pemrograman AI dipakai untuk implementasi kode, antarmuka, dan dokumentasi, sementara arahan teknis, peninjauan, dan pengujian dipegang tim. Dataset tidak dihasilkan AI, dan angka evaluasi berasal dari eksekusi nyata.

<!-- TAMBAHKAN SATU KASUS NYATA di sini, tulis dengan kata-katamu sendiri:
**Saat AI salah:** [apa yang dihasilkan agent] -> [bagaimana kamu menyadarinya] -> [perbaikannya]. -->

## Tim

| Nama | Peran |
| --- | --- |
| Raphael Diovana Tarigan (ketua tim) | Full Stack Engineer, AI/Optimization |
| Michael Aaron Hutagaol | UI/UX Designer |
| Sinari Ilene Situmorang | Researcher dan QA |

