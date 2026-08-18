# Cara Menguji Seluruh Fitur TourCation

Satu berkas untuk memverifikasi semuanya — dari cek yang jalan tanpa konfigurasi
apa pun sampai alur berperan yang butuh akun.

Yang penting dipahami lebih dulu: **aplikasi ini berlapis dan tiap lapis bisa
diuji sendiri.** Tanpa kunci API dan tanpa database, inti produk — penyusunan
itinerary, rute, biaya, dampak UMKM — tetap berjalan penuh. Kalau lapisan dasar
gagal, jangan lanjut ke lapisan atas; galatnya hampir selalu ada di bawah.

| Lapis | Butuh | Yang bisa diuji |
|---|---|---|
| 1 | tidak ada | Itinerary, rute, peta, biaya, dampak UMKM, semua dashboard CSV |
| 2 | Supabase | Login, peran, dashboard UMKM & GOV, verifikasi harga, selisih harga |
| 3 | `OPENAI_API_KEY` | AI Search, penerjemah, seluruh narasi AI |

---

## 0. Menjalankan

```bash
python -m venv .venv && ./.venv/Scripts/pip install -r backend/requirements.txt
```

Backend (dari root repo):

```bash
./.venv/Scripts/python -m uvicorn backend.main:app --reload --port 8000
```

Frontend (dari `frontend/`):

```bash
npm install && npm run dev
```

Buka `http://localhost:5173`. Vite mem-proxy `/api` ke `localhost:8000`, jadi
keduanya harus hidup bersamaan. Kalau UI menampilkan *"Pastikan backend berjalan
di port 8000"*, yang mati adalah uvicorn — bukan frontend.

Konfigurasi opsional: `cp .env.example .env` (root, untuk backend) dan
`cp frontend/.env.example frontend/.env` (untuk login). Keduanya boleh dilewati
untuk pengujian lapis 1.

---

## 1. Cek otomatis — tanpa akun, tanpa database

Jalankan keempatnya dari root repo. Semuanya harus lulus sebelum tes manual.

**Kompilasi backend**

```bash
./.venv/Scripts/python -m compileall -q backend/app engine.py
```

**Seluruh route ter-resolve** — menangkap galat impor yang tidak muncul saat
`compileall`, karena FastAPI baru menyusun skema saat diminta:

```bash
./.venv/Scripts/python -c "import sys; sys.path.insert(0,'.'); from backend.app.main import app; p=app.openapi()['paths']; print(f'{len(p)} route OK')"
```

Harus mencetak **63 route OK**. Angka yang lebih kecil berarti ada router gagal
terdaftar.

**Tipe & build frontend** (dari `frontend/`)

```bash
npm run typecheck && npm run build
```

Peringatan *"chunks are larger than 500 kB"* normal dan sudah dijelaskan di
`vite.config.ts` — jangan diperbaiki dengan `manualChunks`.

**Solver berdiri dan sebaran acuan terbangun**

```bash
./.venv/Scripts/python -c "import sys; sys.path.insert(0,'.'); from backend.app.services import solver_state as s, price_check as p; sol,_,_ = s.get_solver(); print(len(sol.restos),'resto'); print(sorted(p.referensi())); print(p.periksa(900000,'Samosir')['status'])"
```

Harus: **117 resto**, grup `['NASIONAL', 'Samosir', 'Simalungun', 'Toba']`, dan
status **FLAGGED** untuk harga Rp 900.000.

---

## 2. Lapis 1 — tanpa login

### 2.1 Penyusunan itinerary (inti produk)

```bash
curl -s -X POST http://localhost:8000/api/itinerary -H "Content-Type: application/json" -d "{\"budget_total\":3000000,\"n_days\":3,\"n_orang\":2,\"n_nights\":2,\"minat\":[\"Alam\"],\"moda\":\"mobil\"}" | head -c 400
```

Di UI: buka `/`, isi panel **Atur Perjalanan**, tekan **Susun Rencana**.

Yang harus benar:

- **Estimasi biaya tidak pernah melewati budget.** Ini jaminan keras ILP — kalau
  terlampaui, itu bug sungguhan, bukan pembulatan.
- Tiap slot makan menampilkan beberapa **pilihan sepadan**; menekan yang lain
  mengubah total biaya, dan selisihnya sudah tertera di tombolnya.
- Harga pada tombol pilihan berawalan **`est.`** — lihat §5 kenapa itu penting.
- Peta memuat penanda dan rute harian; **Perlu menyeberang** muncul bila rute
  melintasi danau.
- Ubah **Gaya Pengalaman** ke *Otentik Lokal* → porsi UMKM lokal pada kartu
  Dampak harus naik dibanding *General*.

Kasus batas yang wajib dicoba:

| Masukan | Yang benar |
|---|---|
| Budget sangat kecil (mis. Rp 200.000 / 3 hari) | Pesan jelas bahwa budget tak cukup, bukan halaman kosong atau 500 |
| `n_nights = 0` | Rencana tanpa penginapan; rute berpangkal di titik acuan |
| Moda `jalan_kaki` untuk rute jauh | Peringatan *"Jarak rencana ini terlalu jauh untuk moda tersebut"* |

### 2.2 Dashboard pemerintah, bagian CSV

Endpoint intel butuh peran GOV, jadi bagian ini diuji lewat UI setelah login
(§4). Tetapi datanya murni CSV — kalau §1 lulus, angkanya sudah pasti terbentuk.

### 2.3 Degradasi tanpa OpenAI

Tanpa `OPENAI_API_KEY`:

```bash
curl -s -X POST http://localhost:8000/api/ai-search -H "Content-Type: application/json" -d "{\"pertanyaan\":\"apa itu Samosir\"}"
```

Harus **HTTP 400 dengan pesan jelas** — bukan 500, bukan menggantung. Di UI,
setiap kartu narasi AI harus menampilkan *"Angka di halaman ini sudah lengkap
tanpa AI"* dan seluruh angka tetap tampil.

---

## 3. Lapis 2 — menyiapkan akun & peran

Isi `.env` (root) dan `frontend/.env` sesuai `.env.example`. Migrasi SQL ada di
`backend/sql/`; cek koneksi dengan:

```bash
./.venv/Scripts/python backend/sql/cek_koneksi.py
```

**Migrasi yang belum dijalankan tidak menghasilkan 500.** `services/migrasi.py`
menjaga fitur yang tabelnya mungkin belum ada (`perjalanan_ulasan`,
`laporan_lapangan`, kolom `umkm_rating.itinerary_id`) dan membalas **503 dengan
pesan yang menyebut berkas migrasinya**. Jadi kalau ulasan perjalanan, laporan
lapangan, atau umpan balik UMKM membalas 503, bacalah pesannya — itu petunjuk,
bukan kerusakan.

Cara peran diberikan — ini sumber kebingungan yang paling sering:

| Peran | Cara mendapat |
|---|---|
| USER | otomatis begitu masuk |
| **GOV** | **dari domain surel, bukan persetujuan admin.** Surel yang cocok dengan `GOV_EMAIL_DOMAINS` (bawaan: `go.id` saja) atau terdaftar persis di `GOV_EMAILS` langsung aktif saat masuk. **Tidak ada domain demo** — lihat §5 |
| UMKM | ajukan klaim usaha di `/akun`, lalu **disetujui ADMIN** |
| ADMIN | surel terdaftar di `ADMIN_EMAILS` |

`POST /api/auth/klaim` **menolak** permohonan GOV — itu perilaku yang benar, dan
alasannya ada di `.env.example`: admin tidak punya cara memverifikasi klaim
"saya orang dinas" yang lebih baik daripada domain surelnya.

**Token untuk curl.** Setelah masuk di peramban, buka DevTools → Application →
Local Storage → cari kunci Supabase, ambil `access_token`. Lalu:

```bash
curl -s http://localhost:8000/api/auth/saya -H "Authorization: Bearer TOKEN_ANDA"
```

Balasannya memuat peran efektif Anda. Kalau perannya bukan yang diharapkan,
berhenti di sini — seluruh tes berperan di bawah akan menyesatkan.

---

## 4. Lapis 2 — per peran

### 4.1 Wisatawan (USER)

| Fitur | Cara | Yang harus terlihat |
|---|---|---|
| Beri rating tempat | Susun rencana → pilih satu tempat makan → bintang di bawah daftar pilihan | Tersimpan; satu akun satu rating per usaha, bisa diubah |
| Menu & kewajaran harga | Pada kartu yang sama, buka **Menu & kewajaran harga** | Daftar menu + tombol **Wajar** / **Kemahalan** |
| Tarik suara | Tekan tombol yang sama dua kali | Menjadi abstain, bukan menumpuk suara kedua |
| Suara produk sendiri | Masuk sebagai pemilik, coba menilai menunya sendiri | **HTTP 403** — pemilik tidak boleh menilai harga sendiri |
| Jejak & ulasan perjalanan | `/saya`, lalu `/perjalanan/:id/ulasan` | Riwayat rencana dan formulir ulasan pasca-perjalanan |

**Penting:** panel penilaian **hanya muncul untuk tempat yang sudah diklaim akun
UMKM**. Rumah makan dataset tanpa pemilik tidak menampilkan panel apa pun. Itu
bukan bug. Untuk demo, pastikan beberapa tempat pada rencana contoh sudah
diklaim dan menunya terisi — kalau tidak, seluruh lapisan harga terlapor tidak
akan kelihatan.

### 4.2 UMKM

Di `/umkm`:

| Fitur | Cara | Yang harus terlihat |
|---|---|---|
| Tambah produk | `/umkm/usaha` → formulir | Harga langsung dinilai; status **OK / SUSPECT / FLAGGED** muncul seketika |
| Harga wajar | mis. Rp 25.000 | OK, dan lencana **harga terverifikasi** setelah skor ≥ 0,7 |
| Harga ekstrem | mis. Rp 5.000.000 | **FLAGGED** dengan alasan bersigma, mis. *"4,8 sigma di atas median…"* |
| Harga di luar batas | Rp 500 atau Rp 90.000.000 | FLAGGED lewat `batas_absolut`, bukan jalur statistik |
| Batas paket | Tambah produk melebihi batas paket | **HTTP 402** dengan `upgrade_url`, bukan 400 |
| Batas paket via PATCH | Nonaktifkan satu produk, buat baru, lalu hidupkan kembali yang nonaktif | **402 juga.** Ini bekas celah yang sudah ditutup — kalau lolos, celahnya kembali |
| Riwayat | `/umkm` → kartu riwayat | Jendela mengikuti paket: 1 / 12 / 24 bulan |
| Analisis kompetitor | `/umkm/analisis` | Butuh GROWTH/PRO; FREE dapat **402** |
| Ekspor CSV | `GET /api/umkm/ekspor/produk` (PRO) | Berkas terunduh, **terbuka rapi di Excel** (BOM UTF-8), dan **tidak memuat identitas penilai** |
| AI Advisor | `/umkm/analisis` → Penasihat Bisnis | Kuota per paket; kuota habis → **429**. Membuka halaman berulang **tidak** memakan kuota (hasil di-cache) |
| Umpan balik | `/umkm/umpan-balik` | Laporan lapangan yang menyebut usaha Anda |

Jenis ekspor: `produk`, `penilaian`, `riwayat`.

### 4.3 Pemerintah (GOV)

Di `/gov`:

| Halaman | Yang harus terlihat |
|---|---|
| **Ikhtisar** | KPI kawasan, destinasi & UMKM populer, semua dari CSV |
| **Kesenjangan** | Prioritas pengembangan per kabupaten + tabel skor |
| **Simulasi** | Ubah parameter → seri dasar vs intervensi bergerak; `asumsi` dan `peringatan` selalu tampil |
| **Aspirasi** | Kotak masuk aspirasi UMKM; balas → status berubah |
| **Laporan Lapangan** | Jendela 180 hari; n kecil ditandai *"belum cukup untuk bukti"*, bukan disembunyikan |
| **Selisih Harga** | Lihat di bawah |
| **Pengumuman** | Terbitkan → muncul di sisi UMKM |

**Selisih Harga** (`/gov/selisih-harga`) adalah yang paling baru dan paling mudah
disalahbaca. Yang harus benar:

- **Peringatan satuan tampil di atas semua angka**, bukan sebagai catatan kaki.
- Angka utamanya **cacah posisi** (di bawah / di dalam / di atas pita), bukan
  besaran rupiah.
- **Median selisih ditahan** selama usaha terpasangkan < 3, dengan pesan
  *"n terlalu kecil"* — sementara cacah posisi tetap terbit.
- Usaha yang namanya tidak ada di dataset dihitung terpisah di catatan bawah,
  **tidak hilang diam-diam**.
- Produk **SUSPECT/FLAGGED tidak ikut** sama sekali.

Uji cepat tanpa menyiapkan data:

```bash
curl -s "http://localhost:8000/api/intel/selisih-harga" -H "Authorization: Bearer TOKEN_GOV" | head -c 500
```

Tanpa database: `{"aktif": false, "alasan": "..."}` dan kartunya tersembunyi —
dashboard lain tetap utuh.

Akun GOV tanpa `kabupaten` melihat data nasional; yang punya `kabupaten`
otomatis dibatasi ke wilayahnya. Tambahkan `?kabupaten=Samosir` untuk memaksa.

### 4.3b Verifikasi usaha oleh dinas

Menu **Verifikasi Usaha** di `/gov/verifikasi`. Ini satu-satunya halaman dinas
yang MENULIS, dan yang ditulisnya menyangkut akun orang lain — jadi paling
penting diuji batas kewenangannya, bukan sekadar tombolnya jalan.

| Uji | Cara | Yang harus terjadi |
|---|---|---|
| **Gagal tertutup** | Akun GOV yang belum ditetapkan kabupatennya membuka halaman | **403 dengan pesan yang menyebut tindakan** ("hubungi admin untuk menetapkan kabupaten"), bukan daftar kosong |
| Tetapkan wilayah | `POST /api/admin/gov/wilayah` `{"user_id":"...","kabupaten":"Samosir"}` | Berlaku seketika — cache peran dibuang, tidak perlu menunggu 60 detik |
| **Lintas kabupaten** | Petugas Samosir memverifikasi usaha di Toba | **403** dengan sebutan kedua wilayahnya |
| Verifikasi | Isi catatan, tekan **Ya, tandai terverifikasi** | `verified=true`, kolom audit terisi, skor produk dihitung ulang seketika |
| Pengaruhnya kecil | Lihat skor produk sebelum & sesudah | Naik **0,05**, bukan melonjak. Verifikasi bernilai seperempat komponen kelengkapan |
| Pencabutan | Tekan **Cabut verifikasi** | `verified=false`, `verified_at` dikosongkan, alasan tercatat permanen |
| **Akses tidak tersentuh** | Cek usaha yang belum terverifikasi | Tetap bisa menambah menu dan tetap muncul di platform. Verifikasi menahan lencana, bukan hak berusaha |
| Admin menembus batas | Akun ADMIN memverifikasi usaha kabupaten mana pun | Boleh — tetap tercatat lengkap di kolom audit |

Notifikasinya:

| Uji | Yang harus terjadi |
|---|---|
| Setujui klaim UMKM baru sebagai admin | Muncul pemberitahuan **VERIFIKASI_TERTUNDA** di kotak masuk dinas kabupaten itu |
| Tanpa `SMTP_HOST` | Status **ANTRE** + lencana *"Surel belum aktif"*. Isinya tetap terbaca — SMTP mati tidak boleh terlihat sama dengan tidak ada kabar |
| Setujui klaim yang sama dua kali | Tetap satu pemberitahuan. Indeks unik menolak yang kedua, dan itu bukan galat |
| `POST /api/admin/notifikasi/kirim` | Menyiram antrean setelah SMTP diperbaiki |

**Satu email hanya satu akun.** Keunikan surel dijamin Supabase Auth
(`auth.users.email`), dan migrasi `2026-08-17d` menambahkan indeks unik pada
`umkm_business.owner_id`. Jadi satu alamat surel = satu akun = satu usaha.
Untuk mengujinya: coba setujui dua klaim untuk pemohon yang sama — yang kedua
tidak boleh membuat usaha kedua.

### 4.4 Admin

| Fitur | Endpoint | Catatan |
|---|---|---|
| Permohonan peran | `GET/POST /api/admin/permohonan` | Setujui klaim UMKM di sini |
| Atur langganan | `POST /api/admin/langganan` | Pengganti payment gateway; upsert, jadi memanggil dua kali aman |
| Tetapkan wilayah GOV | `POST /api/admin/gov/wilayah` | Satu-satunya jalur penulisan `profiles.kabupaten`. Tanpa ini petugas tidak bisa memverifikasi apa pun |
| Siram antrean surel | `POST /api/admin/notifikasi/kirim` | Untuk SMTP yang sempat mati lalu hidup lagi |
| Muat ulang data | `POST /api/admin/solver/reload` | Memuat ulang CSV tanpa restart. **Bukan** lagi "terapkan override harga" — override sudah dicabut |

---

## 5. Yang paling mudah dianggap bug (padahal benar)

**Harga UMKM tidak mengubah itinerary — sama sekali.** Ini disengaja dan baru
diubah. Menu dan harga pemilik tampil ke wisatawan di panel usaha, tetapi tidak
pernah masuk ke solver. Kalau Anda menambah menu murah lalu mengharap peringkat
naik, itu tidak akan terjadi — dan itulah yang benar. Alasan lengkapnya di
[ARSITEKTUR_HARGA.md](ARSITEKTUR_HARGA.md).

Konsekuensinya, dua angka harus dibaca berbeda:

| Di layar | Artinya | Sumber |
|---|---|---|
| `est. Rp 35.000` pada tombol pilihan | **estimasi kisaran** — perkiraan makan per orang dari bucket harga Google | dataset CSV |
| `Rp 28.000` pada menu di panel usaha | **harga terlapor** — harga satu item menu, dinilai komunitas | pemilik usaha |

Keduanya tidak sebanding, dan sengaja tidak pernah dilebur.

**Lencana "harga terverifikasi" tidak berarti "dipakai rekomendasi".** Nama lama
itu sudah dihapus. Yang ditentukan skor verifikasi ada dua: apakah harga ditandai
terverifikasi kepada wisatawan, dan apakah ia ikut dihitung di **Selisih Harga**.

**Selisih Rp 0 bukan berarti gagal.** Median berpasangan bisa memang nol kalau
sebaran selisihnya simetris.

**Angka live/lapangan yang kecil bukan data hilang.** Nol berarti belum pernah
masuk rencana siapa pun — itu sendiri informasi.

**Produk FLAGGED tetap tampil di halaman pemiliknya.** Ia hanya tidak ditandai
terverifikasi dan tidak masuk statistik daerah.

---

## 6. Daftar periksa sebelum demo

- [ ] Empat cek otomatis di §1 lulus, termasuk **55 route**
- [ ] Itinerary tersusun dan **tidak melewati budget**
- [ ] Minimal 2–3 tempat pada rencana contoh sudah **diklaim akun UMKM dengan menu terisi** — tanpa ini lapisan harga terlapor tidak terlihat
- [ ] Minimal 3 usaha punya harga terverifikasi agar **median Selisih Harga terbit**
- [ ] Satu produk sengaja dibiarkan FLAGGED, untuk menunjukkan gerbangnya bekerja
- [ ] Satu akun tiap peran siap: USER, UMKM, GOV, ADMIN
- [ ] Ada suara komunitas masuk agar skor verifikasi bergerak di depan penonton
- [ ] Kalau `OPENAI_API_KEY` tidak dipakai, sebutkan di awal bahwa seluruh angka tetap utuh tanpanya

---

## 7. Kalau ada yang gagal

| Gejala | Periksa |
|---|---|
| Route < 55 | Jalankan cek OpenAPI di §1 — pesannya menyebut modul yang gagal impor |
| 401 di semua endpoint berperan | Token kedaluwarsa; masuk ulang dan ambil `access_token` baru |
| 503 dari endpoint UMKM/GOV | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` belum terisi |
| 503 khusus di ulasan perjalanan / laporan lapangan / umpan balik | Skema belum dimigrasi. Pesannya menyebut berkas SQL-nya; jalankan yang ada di `backend/sql/` |
| 503 di Verifikasi Usaha | `2026-08-17d_verifikasi_usaha.sql` belum dijalankan |
| 403 "belum ditetapkan wilayah kerjanya" | Akun GOV belum punya kabupaten. `POST /api/admin/gov/wilayah` |
| Notifikasi berstatus ANTRE terus | SMTP belum dikonfigurasi. Itu bukan kerusakan — isinya tetap terbaca di dashboard |
| Peran bukan yang diharapkan | `GET /api/auth/saya`; untuk GOV, cocokkan surel dengan `GOV_EMAIL_DOMAINS` |
| 402 padahal paket sudah PRO | `POST /api/admin/langganan` lalu muat ulang halaman |
| Dashboard UMKM 404 | Klaim usaha belum disetujui ADMIN |
| Selisih Harga kosong | Belum ada usaha yang **sekaligus** punya harga terverifikasi dan nama yang cocok dengan dataset |
| Harga tidak mengubah itinerary | Bukan bug — lihat §5 |
