# TourCation AI — Dokumentasi Produk

**AI-Powered Tourism Intelligence Platform untuk kawasan Danau Toba**

*Terakhir diperbarui: 17 Agustus 2026*

---

## 1. Apa ini

TourCation AI berangkat dari satu tesis:

> Setiap itinerary yang tersusun adalah **sinyal permintaan pariwisata**, dan sinyal itu harus dikembalikan kepada pihak yang bisa bertindak atasnya.

Wisatawan menyusun rencana perjalanan → data pola terkumpul → UMKM mendapat insight bisnis, pemerintah daerah mendapat insight kebijakan dan simulator dampak → keduanya bisa saling berkomunikasi.

```
                    Wisatawan menyusun itinerary
                              │
                    itinerary_log + itinerary_place
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
          Dashboard UMKM            Dashboard Pemerintah
       performa · harga · advisor   tren · gap · simulasi
                 │                         │
                 └──── aspirasi ──────────►│
                 │◄──── pengumuman ────────┘
                 │
            rating wisatawan → skor kepercayaan
```

### Dua disiplin yang membentuk seluruh arsitektur

**Semua aritmetika di Python; LLM hanya menjelaskan.** Model bahasa menerima blok `FAKTA` berisi angka yang sudah jadi, dengan instruksi *"jangan menghitung; setiap angka wajib disalin persis"*. Setiap endpoint numerik tetap membalas **200 dengan angka lengkap** tanpa `OPENAI_API_KEY` — hanya `narasi: null`. Kuota OpenAI habis saat demo menurunkan kualitas presentasi, bukan menggagalkannya.

**Tidak ada data sintetis.** Semua angka berasal dari 14 CSV di `data/`. Konsekuensinya, keterbatasan data ikut ditampilkan apa adanya: label wajib *"0 destinasi terdata"* bukan *"0 destinasi"*, dan seri ulasan selalu berlabel *"proksi permintaan, bukan jumlah kunjungan"*.

---

## 2. Peran & hak akses

| Peran | Bisa mengakses |
|---|---|
| **Publik** (tanpa akun) | Landing page, penyusun itinerary, galeri, penerjemah, halaman harga `/bisnis` |
| **USER** | Semua di atas + `/saya` (riwayat penilaian) + memberi rating UMKM |
| **UMKM** | Dashboard usaha, kelola produk & harga, AI Advisor (berbayar), kirim aspirasi, baca pengumuman, langganan |
| **GOV** | Dashboard intelijen, analisis kesenjangan, simulator kebijakan, kotak masuk aspirasi, terbitkan pengumuman |
| **ADMIN** | Semua di atas + setujui permohonan peran, tetapkan langganan, muat ulang solver |

Sumber kebenaran peran adalah tabel `profiles`, dibaca lewat cache 60 detik — **bukan** klaim JWT. Kalau peran hanya diambil dari token, persetujuan admin baru berlaku setelah token pengguna refresh, bisa satu jam.

**Cara memperoleh peran berbeda per peran:**

* **UMKM** — pengguna mengklaim usaha yang sudah terdaftar di dataset lewat halaman `/akun`, lalu ADMIN menyetujuinya. Kabupaten permohonan tidak diisi manual: ia mengikuti alamat usaha yang dipilih (`engine.deteksi_kabupaten`), dan pilihan manual hanya muncul bila alamat itu tidak bisa dipetakan.
* **GOV** — **tidak lewat permohonan sama sekali**; `/api/auth/klaim` menolak `requested_role=GOV`. Peran diberikan seketika saat masuk bila alamat surelnya ada di `GOV_EMAILS` atau domainnya (termasuk subdomain) ada di `GOV_EMAIL_DOMAINS` — bawaannya `go.id` saja (hanya bisa didaftarkan lembaga negara, jadi kepemilikannya sudah menjadi bukti). Domain uji coba sengaja tidak disediakan: sejak GOV berwenang memverifikasi usaha UMKM, domain yang bisa didaftarkan siapa saja menjadi jalur eskalasi. Untuk demo, daftarkan alamat persis di `GOV_EMAILS`. Alasannya: ADMIN tidak punya cara memverifikasi klaim "saya orang dinas" yang lebih baik daripada domain surelnya.

**Biodata pengguna.** Masuk hanya lewat Google OAuth, jadi tidak ada formulir pendaftaran yang bisa menanyakan apa pun — akibatnya `profiles` selama ini hanya berisi apa yang Google kirimkan, dan dua kolomnya (`full_name`, `avatar_url`) tidak pernah dibaca aplikasi. Sesudah login pertama pengguna diarahkan sekali ke `/biodata`; nama dan foto sudah terisi dari metadata Google, dan **hanya nama yang wajib**. Formulir yang menahan orang sampai delapan kolom terisi akan diisi asal-asalan, dan data karangan lebih buruk daripada kolom kosong.

Tiga hal yang menentukan di sini:

* **Pemicunya `biodata_lengkap_pada`, bukan "field masih kosong".** Memeriksa kekosongan membuat orang yang sengaja menghapus nomor teleponnya dianggap belum pernah onboarding, lalu dipaksa mengisi formulir yang sama berulang kali.
* **Gerbangnya GAGAL-TERBUKA.** Bila kolomnya belum dimigrasi, `/api/auth/saya` mengembalikan `biodata_lengkap: true`. Tanpa itu setiap pengguna tampak belum mengisi, `ProtectedRoute` memantulkan semuanya ke `/biodata`, dan penyimpanannya membalas 503 — seluruh aplikasi mati bagi semua yang sudah masuk, hanya karena satu migrasi belum dijalankan. Onboarding adalah kenyamanan antarmuka, bukan batas keamanan.
* **Kolom yang boleh ditulis adalah daftar putih**, bukan "semua kecuali". `profiles` juga memuat `role` dan `kabupaten`; satu kolom yang lupa dikecualikan berarti kenaikan peran lewat formulir biodata. Trigger `cegah_naik_peran` memang menahan jalur browser, tetapi backend memakai `service_role` dan justru dilewatkan trigger itu.

Kota asal, tanggal lahir, dan jenis kelamin hanya dipakai sebagai agregat demografi dan **tidak pernah ikut ke `itinerary_log`** yang dibaca dashboard pemerintah. Jenis kelamin selalu punya opsi "tidak disebutkan": memaksa memilih salah satu dari dua membuat sebagian orang mengisi data yang tidak benar, dan itu merusak agregatnya sendiri. Onboarding hanya sekali, tetapi biodata tetap bisa disunting dari `/akun` — data yang tidak bisa dikoreksi adalah cacat, bukan sifat.

---

## 3. Fitur

### 3.1 Penyusun Itinerary (inti, publik)

Wisatawan mengisi budget, durasi, jumlah orang, minat, gaya jelajah, dan moda transport. `engine.py` menjalankan **optimasi Integer Linear Programming (PuLP)** yang menghasilkan:

- Itinerary harian lengkap dengan jam dan urutan rute
- Pemilihan hotel + 8 kandidat alternatif
- Pilihan rumah makan per slot makan, berbobot ke UMKM lokal
- Deteksi penyeberangan feri, filter jam operasional dan hari libur
- Estimasi biaya yang **dijamin tidak melebihi budget**
- Analisis dampak ekonomi lokal

**Jaminan:** solver tidak pernah menghasilkan rencana di atas budget. Itu batasan ILP, bukan penyaringan setelahnya.

### 3.2 Dashboard Pemerintah — `/gov`

Destinasi & UMKM terdata per kabupaten, ranking tempat terpopuler, dan seri permintaan 12 bulan yang direkonstruksi dari tanggal relatif ulasan Google (`"6 months ago"` + `scraped-at` → perkiraan bulan).

**Aturan kejujuran yang ditegakkan kode:** ulasan `"a year ago"` (4.131) dan `"2 years ago"` (3.536) adalah *point mass* Google — tidak pernah disebar ke bulan, hanya dipakai sebagai penyebut YoY kasar.

Seri kedua dari log itinerary nyata ditampilkan **berdampingan, tidak pernah dijumlahkan** dengan seri ulasan: satuannya tidak sebanding.

### 3.3 Analisis Kesenjangan — `/gov/gap`

Skor gap tujuh sumbu (destinasi, UMKM, ragam kategori, budaya, keluarga, aktivitas malam, fasilitas), dinormalisasi min-max lintas 8 kabupaten:

```
GAP       = 0,22·g_destinasi + 0,20·g_umkm + 0,16·g_ragam + 0,12·g_budaya
          + 0,10·g_keluarga + 0,10·g_malam + 0,10·g_fasilitas
PRIORITAS = GAP × (0,5 + 0,5·norm(wisatawan_2024))
```

Temuan yang muncul dari rumus ini dan bisa dipertahankan di hadapan penguji:

- **Karo**: 2,3 juta kunjungan, **0 destinasi terdata**
- **Dairi & Humbang Hasundutan**: punya wisata, **0 UMKM kuliner terdata**

Kekosongan itu **dibingkai sebagai temuan pendataan**, bukan bukti tidak ada wisata — dan dibuktikan oleh baris `Attractions_Info` yang menunjukkan atraksinya memang ada.

### 3.4 Simulator Dampak Kebijakan — `/gov/simulasi`

Lima skenario, seluruhnya rule-based dengan panel **"Asumsi Model"** terbuka:

| Skenario | Mekanik utama |
|---|---|
| Festival daerah | `uplift = 0,06·skala·kesiapan·musim`, cap 0,15 |
| Program promosi | `0,04·√(anggaran/1e9)·jangkauan` — akar = diminishing returns |
| Pelatihan UMKM | Menaikkan **porsi belanja yang jatuh ke lokal**, bukan jumlah wisatawan |
| Tambah destinasi | Entropi kategori dihitung ulang — menambah Budaya ke Toba skornya jauh lebih tinggi daripada menambah Alam lagi |
| Pengembangan budaya | Dampak lewat **lama tinggal**, bukan headcount |

Setiap skenario mengembalikan `asumsi: [{parameter, nilai, sumber}]` dan pembanding **do-nothing**. Basis festival 0,06 **diturunkan dari data saat build** (bulan ulasan puncak Toba ÷ median trailing − 1, diklip `[0,03; 0,12]`), bukan dihardcode.

### 3.5 Dashboard UMKM — `/umkm`

Posisi usaha dalam ekosistem wisata wilayahnya, sinyal permintaan 12 bulan, pita harga p25/p50/p75 pembanding, dan peluang yang diturunkan dari data.

**Persentil disembunyikan bila n < 5** — pada sampel sekecil itu angkanya lebih menyesatkan daripada membantu.

### 3.6 Usaha & Produk — `/umkm/usaha`

CRUD produk dengan **validasi harga robust-z pada logaritma harga**:

```
x = ln(harga) ; med = median(ln harga sekabupaten) ; mad = median|ln h − med|
sigma = 1,4826·mad ; z = (x − med)/max(sigma; 0,15)
|z| < 2,5 OK · 2,5–3,5 SUSPECT · ≥ 3,5 FLAGGED
```

**Chokepoint harga** — bagian paling penting secara integritas. Harga kiriman pengguna hanya menyentuh DataFrame solver di **satu tempat**, [`solver_state._terapkan_override_harga`](../backend/app/services/solver_state.py), dengan syarat berlapis: skor verifikasi ≥ 0,7, status harga `OK`, produk aktif, dan diklip ke `[0,25×; 4×]` median grup.

Alasannya bisa dilacak ke `engine.py`: harga resto mengalir ke `ref_resto = restos["harga_min"].max()` yang menjadi **normalizer skor seluruh restoran**. Satu harga palsu Rp 50 juta yang lolos tidak merusak satu baris — ia merusak peringkat setiap restoran di delapan kabupaten sekaligus.

Harga ter-flag **tetap terlihat** pemiliknya dengan badge peringatan; ia hanya tidak pernah otoritatif.

### 3.7 AI Advisor — berbayar

Penasihat bisnis untuk usaha milik pemanggil saja. Ini satu-satunya endpoint AI yang mengonsumsi teks tulisan pengguna, jadi seluruh lapisan pertahanan prompt injection bertemu di sini — lihat §6.

### 3.8 Rating & Skor Kepercayaan

**Satu akun satu rating**, ditegakkan indeks unik `umkm_rating_satu_per_akun`. Ratingnya boleh **diubah**, tidak boleh ditumpuk. Pemilik tidak dapat menilai usahanya sendiri.

Skor kepercayaan tingkat usaha:

```
SKOR = 0,50·komunitas + 0,30·produk + 0,20·kelengkapan
```

`komunitas` adalah **batas bawah Wilson** atas proporsi rating ≥ 4 — bukan rata-rata, karena rata-rata memperlakukan satu bintang lima sama meyakinkannya dengan lima puluh bintang lima. Perilakunya terukur:

| Bukti | Skor komunitas |
|---|---|
| 0 dari 0 | 0,000 |
| 1 dari 1 puas | 0,167 |
| 5 dari 5 puas | 0,511 |
| 20 dari 20 puas | 0,810 |
| 0 dari 5 puas | 0,000 |

Label: **TERPERCAYA** ≥ 0,70 · **BERKEMBANG** 0,40–0,70 · **PERLU PEMBINAAN** < 0,40.

**Pemilik melihat ulasan yang masuk** di `/umkm/usaha` (kartu "Ulasan Masuk"): sebaran bintang 1–5, jumlah yang puas, dan komentar tertulisnya. Sumbernya `GET /api/umkm-publik/{id}` — endpoint publik yang sama dengan yang dibaca wisatawan, bukan jalur khusus pemilik, supaya tidak ada versi kedua yang bisa menyimpang. Identitas penilai tetap tidak ikut: router membuang `user_id` sebelum mengirim.

**Suara kewajaran harga** (`price_feedback`) adalah penilaian yang berbeda dari rating usaha: rating menjawab "usaha ini bagus?", suara menjawab "harga ini wajar?" — dan hanya yang kedua ikut menentukan apakah harga boleh dipakai mesin penyusun itinerary (§3.6). Wisatawan memberinya lewat blok Rekomendasi Lainnya: tiap kartu punya panel **"Menu & kewajaran harga"** yang memuat menu aktif saat dibuka, lalu tombol *Wajar* / *Kemahalan* memanggil `POST /api/umkm/produk/{id}/suara`. Satu akun satu suara, bisa diubah, menekan tombol yang sama dua kali berarti abstain, dan pemilik tidak boleh menilai produknya sendiri. Menu publik dirakit `services/umkm.produk_publik()` yang sengaja **tidak** meneruskan catatan internal pemilik (`harga_alasan`, `dipakai_rekomendasi`); median pembanding tetap dikirim supaya penilaian yang diminta punya dasar.

### 3.9 Simpan perjalanan — inbox wisatawan

Rencana yang sudah tersusun punya tombol **Simpan Perjalanan** di kepala kartu itinerary. Yang tersimpan muncul di `/saya` sebagai inbox, dibagi menurut apa yang bisa dilakukan terhadapnya — bukan menurut tanggal:

| Bagian | Isinya | Tindakan |
|---|---|---|
| Perjalanan Aktif | tersimpan, `AKAN_DATANG` atau `BERJALAN` | buka rencananya |
| Sudah selesai | tanggalnya lewat, belum diulas | beri ulasan |
| Riwayat | sisanya, termasuk yang tidak pernah disimpan | lihat / buka bila tersimpan |

**Dua tabel, dua niat.** `itinerary_log` mencatat bahwa rencana pernah disusun — jejak analitik yang terjadi tanpa pengguna memintanya. `itinerary_simpanan` mencatat bahwa pengguna **ingin** menyimpannya. Payload mentah sengaja TIDAK ditaruh di `itinerary_log`: tabel itu dibaca dashboard pemerintah dan aturannya sudah dinyatakan di §4.3 — "tanpa PII, tanpa payload mentah". Dashboard kebijakan tidak boleh punya jalan menuju isi rencana satu orang.

**Payload disimpan apa adanya; solver tidak pernah dipanggil ulang saat membuka.** Menyusun ulang akan menghasilkan rencana yang berbeda begitu dataset, harga acuan, atau bobot jarak berubah — dan `itinerary_log` bahkan tidak menyimpan `origin_lat`/`origin_lon`, jadi rekonstruksinya tidak akan pernah utuh. Rencana yang berubah sendiri setelah disimpan bukan rencana yang disimpan. Konsekuensinya diakui apa adanya di UI: rencana lama bisa memuat harga atau jam buka yang sudah bergeser, dan pergeseran itulah yang dilaporkan lewat ulasan.

**`itinerary_id` dan kenapa pencatatannya berubah jadi sinkron.** Tombol Simpan perlu sasaran, jadi `POST /api/itinerary` sekarang mengembalikan `itinerary_id` — tetapi hanya untuk pemanggil yang sudah masuk, dan hanya karena bagi mereka `catat_itinerary` dipanggil **langsung** alih-alih lewat `BackgroundTasks`. Kalau tetap di latar belakang, klien menerima rencana tanpa id dan menekan Simpan sedetik kemudian akan menabrak baris yang belum ada. Pemanggil anonim tetap dicatat di latar belakang seperti semula. Kegagalan mencatat tetap tidak fatal: `itinerary_id` bernilai null dan tombol Simpan sekadar tidak muncul.

> **Pernah rusak, dan gejalanya menyesatkan.** `planItinerary` di frontend tidak mengirim header `Authorization`, sehingga `pengguna_opsional` selalu None dan `itinerary_log.user_id` selalu NULL — 12 baris pertama tercatat anonim padahal penggunanya sudah masuk. Akibatnya tidak ada perjalanan yang punya pemilik, tidak bisa disimpan, dan tidak bisa diulas. Endpoint-nya memang publik, tapi publik bukan berarti tanpa identitas.

**Ekspor PDF digerbangi akun.** Bagi pemanggil anonim, `onExport` tidak diteruskan sama sekali ke `ItineraryBoard` — bukan sekadar tombolnya disembunyikan, karena menyembunyikan tombol meninggalkan jalur ekspornya tetap hidup di dalam komponen. Yang tampil sebagai gantinya satu ajakan masuk yang menyebut apa yang didapat; tombol yang hilang tanpa penjelasan terbaca sebagai fitur rusak.

### 3.10 Umpan balik pasca-perjalanan — satu formulir, tiga muara

Setelah perjalanan selesai, `/saya` menampilkan tombol **Beri Ulasan** menuju `/perjalanan/:id/ulasan`. Yang menentukan ke mana sebuah butir umpan balik pergi bukan siapa yang mengisinya, melainkan **siapa yang bisa memperbaikinya**:

| Yang dinilai wisatawan | Muara | Tabel | Efeknya |
|---|---|---|---|
| Rasa, layanan, kebersihan warung | UMKM | `umkm_rating` | skor kepercayaan |
| Harga sesuai/tidak | UMKM + GOV | `price_feedback` | `verification_score`, gerbang harga solver |
| Jalan, toilet, papan penunjuk, sinyal, pungli | GOV | `laporan_lapangan` | bukti lapangan untuk `gap.py` |
| Rencana meleset (biaya, kepadatan jadwal) | GOV | `perjalanan_ulasan` | akurasi estimasi sistem |

Menyatukan keempatnya jadi satu kolom akan membuat UMKM disalahkan atas jalan rusak, dan membuat dinas menerima keluhan "sambalnya kurang pedas".

**Kenapa laporan lapangan penting.** Tujuh sumbu `gap.py` seluruhnya diturunkan dari CSV, dan `analytics.py` sendiri menyebut kolom fasilitasnya "INDIKATOR KEBERADAAN, bukan cacah/sensus". Artinya rekomendasi prioritas pembangunan selama ini berdiri di atas dugaan yang belum pernah dibantah data lapangan. Laporan wisatawan adalah pengamatan langsung pertama yang bisa mengonfirmasinya — kolom "Konfirmasi fasilitas" di `/gov/lapangan` adalah jembatan itu.

**Penilaian bersaksi.** Sampai fitur ini ada, siapa pun yang punya akun bisa memberi bintang ke usaha mana pun tanpa pernah ke sana. Rating yang lahir dari ulasan pasca-perjalanan menyimpan `umkm_rating.itinerary_id`, jadi ia dipastikan berasal dari akun yang itinerary-nya memuat tempat itu dan tanggalnya sudah lewat. Kolom itu **murni pelabelan** — rumus `trust_score` tidak berubah sedikit pun, karena mengubah rumus kepercayaan berarti mengubah angka yang sudah terlanjur dijelaskan ke pemilik usaha.

**Pagar yang menjaganya tetap jujur.** Laporan `TARIF_TIDAK_RESMI` **tidak pernah** otomatis menandai harga usaha; keputusan OK/SUSPECT/FLAGGED tetap milik `price_check` yang murni statistik, karena keputusan yang bisa digerakkan sepuluh akun tidak bisa dipertanggungjawabkan ke pemilik warung yang ditandai. Laporan juga seri **ketiga** yang tidak pernah dijumlahkan dengan volume ulasan maupun cacah itinerary (`lapangan.AMBANG_BUKTI = 10`, sejajar `live.AMBANG_RANKING`). Dan pengirimannya hanya lewat `/api/perjalanan/{id}/ulasan` — tidak ada endpoint kirim yang berdiri sendiri, karena laporan yang tidak menempel pada perjalanan nyata kehilangan satu-satunya sifat yang membuatnya layak jadi bukti kebijakan.

**Lingkaran yang tertutup.** UMKM melihat laporan yang menyangkut tempatnya di `/umkm/umpan-balik` (anonim, tanpa pengaruh ke skornya) → meneruskan yang di luar kendalinya ke dinas lewat `POST /api/aspirasi` → dinas menanggapi dan menerbitkan `pengumuman`.

### 3.11 Rekomendasi Lainnya — pemerataan paparan

Dua UMKM berskor kepercayaan **terendah** di kabupaten yang dilalui rute ikut ditampilkan di bawah itinerary, ditandai jelas, supaya mereka punya kesempatan menerima kunjungan dan rating — jalan keluar dari lingkaran *"tidak punya rating karena tidak pernah muncul, tidak pernah muncul karena tidak punya rating"*.

Tiga pagar membuat mekanik ini tetap jujur:

1. **Tidak pernah menyentuh ILP.** Dilampirkan sebagai kunci baru di tingkat atas, setelah payload final. Rute, biaya, agenda, dan total jarak tidak berubah sedikit pun.
2. **Gerbang kelayakan.** Usaha yang skornya rendah karena **sudah banyak dinilai buruk** (≥ 5 rating, rerata < 2,5) dikecualikan. Yang lolos hanya yang rendah karena *belum dikenal*.
3. **Dicatat sebelum dilampirkan**, jadi paparan bantuan tidak pernah terbaca sebagai permintaan nyata di dashboard kebijakan.

**Rating dibekukan selama bukti masih tipis.** Selama penilaian usaha di slot ini < 5, ratingnya **tidak ditampilkan** ke wisatawan — badge kepercayaan diganti "Rating dibekukan" beserta alasannya. Gerbang kelayakan sudah menyingkirkan usaha yang skornya rendah karena benar-benar dinilai buruk, jadi yang tersisa rendah karena *belum dikenal*; menampilkan "PERLU PEMBINAAN" pada usaha semacam itu menghukumnya atas ketiadaan data dan meniadakan seluruh guna slot ini. Pembekuannya sementara dan syarat lepasnya eksplisit: pada penilaian ke-5 angkanya tampil apa adanya, bagus maupun tidak. Yang dibekukan hanya tampilan — penilaian tetap diterima, tercatat, dan menggerakkan skor seperti biasa.

> **Perbaikan bug (2026-08-16).** Blok ini sebelumnya **tidak pernah muncul**. `_kabupaten_rute()` membaca `agenda[].place.kabupaten`, kunci yang tidak pernah ada di payload — `_fmt_place()` tidak mengeluarkannya. Himpunan kabupaten selalu kosong, `pilih_umkm_berkembang()` selalu pulang lebih awal, dan tidak ada galat yang terlihat karena seluruh jalur ini memang dirancang gagal-diam. Sekarang sumbernya `days[].kabupaten` (sudah dihitung dari alamat seluruh agenda) ditambah kabupaten hotel dari alamatnya. Nama kabupaten juga dikutip di filter `in.()` — tiga dari delapan mengandung spasi.

### 3.12 Menilai UMKM pada rencana utama — tautan `place_name_norm`

Rumah makan pada rencana utama datang dari CSV dan hanya membawa nama, sehingga tidak ada `business_id` yang bisa dituju `PUT /api/umkm-publik/{id}/rating`; sebelumnya hanya kartu di slot pemerataan yang bisa dinilai. [`services/tautan_usaha.py`](../backend/app/services/tautan_usaha.py) menutup celah itu: nama tempat makan pada payload dinormalisasi dengan `analytics.kunci_nama()` lalu dicocokkan ke `umkm_business.place_name_norm` — **konvensi yang sama persis** dengan chokepoint harga di `solver_state`, jadi satu perubahan normalisasi harus mengubah keduanya. Baris lama yang `place_name_norm`-nya kosong tetap tertaut lewat normalisasi nama aslinya.

Hasilnya ditempel sebagai kunci baru `usaha_tertaut` (peta nama tempat → `business_id`, skor, jumlah rating, dan rating milik pemanggil bila sudah pernah memberi) — sama seperti slot pemerataan, **tanpa menyentuh** `days`, `agenda`, `summary`, maupun `hotel`, dan tidak pernah melempar.

Di UI, penilaiannya menempel **di dalam kartu agenda** itu sendiri: [`PenilaianTempat`](../frontend/src/components/PenilaianTempat.tsx) dirender di bawah daftar pilihan makan, membawa bintang dan panel kewajaran harga. Dua hal yang menentukan bentuknya:

* **Di bawah daftar pilihan, bukan di dalam tombolnya.** Bintang di dalam tombol pilihan berarti `<button>` bersarang — HTML tidak sah, dan kliknya saling rebut antara "pilih tempat ini" dan "beri empat bintang".
* **Yang dinilai selalu pilihan yang sedang aktif** pada slot itu. Menukar pilihan menukar tempat yang dinilai — yang masuk rencana turis itulah yang ia kunjungi.

Yang muncul hanya tempat yang sudah diklaim pemiliknya; sisanya tetap tempat CSV tanpa pemilik yang belum bisa menerima penilaian, dan kartunya tampil seperti sebelumnya. Ini satu-satunya penyuntingan pada `ItineraryBoard` — dua baris pemanggilan, tanpa menyentuh perhitungan mana pun di dalamnya.

### 3.13 Aspirasi & Pengumuman — jalur dua arah

**UMKM → Pemerintah:** kirim keluhan/usulan berkategori (infrastruktur, permodalan, pelatihan, promosi, perizinan, lainnya). Status bergerak `BARU → DIBACA → DITINDAKLANJUTI → SELESAI/DITOLAK`.

**Pemerintah → UMKM:** terbitkan kebijakan, program bantuan (dengan nilai & cara mendaftar), pelatihan, atau event. `kabupaten` kosong berarti berlaku nasional.

Pegawai GOV kabupaten hanya melihat aspirasi wilayahnya — **disaring di server**, bukan di UI; kalau di UI, datanya tetap terkirim ke browser lebih dulu.

### 3.14 Multibahasa

Kunci kamus adalah teks Indonesia itu sendiri, jadi terjemahan yang belum ada jatuh ke teks asli — bukan layar kosong. Inggris memakai kamus statis (instan, pasti benar); bahasa lain lewat AI sekali lalu di-cache.

**Kunci cache berversi otomatis** — `tourcation.dict.<kode>.v<sidik>` dengan sidik FNV-1a dari isi `STRING_UI`. Menambah satu string saja mengubah kuncinya dan memicu pengambilan ulang; tidak ada konstanta yang harus diingat untuk dinaikkan.

Kamus **662 string** dipecah per **150** entri per permintaan. Angkanya diukur, bukan ditebak: keluaran model memuat kunci *dan* terjemahannya (~2,2× karakter masukan), sehingga batch 300 menghasilkan ~4.850 token dan **terpotong diam-diam** pada plafon lama.

---

## 4. Arsitektur

### 4.1 Backend — FastAPI

```
backend/main.py                 re-export 2 baris (dipertahankan untuk render.yaml)
backend/app/
  main.py                       create_app(): CORS + include_router
  core/       paths, config, ratelimit, security, llm, sanitasi, constants
  db/         supabase.py        klien PostgREST tipis di atas httpx (~100 baris)
  schemas/    pydantic per fitur
  services/   analytics, gap, simulator, price_check, solver_state,
              itinerary_shape, review_dates, logging_service, live,
              ai_fakta, ai_insight, langganan, rating, aspirasi,
              rekomendasi_lainnya, umkm
  routers/    health, meta, languages, translate, itinerary, ai_search,
              intel, simulasi, umkm, auth, komunitas, admin
```

**52 berkas Python · 7.027 baris · 48 endpoint.**

`engine.py` (1.906 baris, di root repo) **tidak pernah disentuh** — seluruh modul mengimpornya read-only. Itu yang menjaga `evaluasi/`, `uji/`, dan `DOKUMENTASI_MODEL.md` tetap valid.

### 4.2 Frontend — Vite + React 18 + TypeScript strict

**71 berkas · 14.304 baris.** Route dashboard dimuat `React.lazy` supaya halaman `/` — yang pertama dibuka penguji — tidak menanggung bundle Recharts.

| Rute | Peran |
|---|---|
| `/` `/galeri/:slug` `/bisnis` | Publik |
| `/masuk` `/auth/callback` | Autentikasi |
| `/biodata` `/akun` `/saya` `/perjalanan/:id` `/perjalanan/:id/ulasan` | Semua yang sudah masuk |
| `/gov` `/gov/gap` `/gov/simulasi` `/gov/aspirasi` `/gov/lapangan` `/gov/pengumuman` | GOV, ADMIN |
| `/umkm` `/umkm/usaha` `/umkm/umpan-balik` `/umkm/analisis` `/umkm/suara` `/umkm/langganan` | UMKM, ADMIN |

### 4.3 Basis data — Supabase Postgres

20 tabel terpakai + 1 view, RLS aktif seluruhnya. Kelompoknya:

- **Identitas** — `profiles` (termasuk biodata), `role_requests`
- **UMKM** — `umkm_business`, `umkm_product`, `subscription`
- **Harga & kepercayaan** — `price_flag`, `price_feedback`, `verification_score`, `umkm_rating`, `trust_score`
- **Analitik** — `itinerary_log`, `itinerary_place`, `umkm_view_log`
- **AI & simulasi** — `simulation_run`, `ai_insight_cache`
- **Komunikasi** — `aspirasi`, `pengumuman`
- **Perjalanan wisatawan** — `itinerary_simpanan`, `perjalanan_ulasan`, `laporan_lapangan` (+ view `laporan_lapangan_gov`)

> **Tabel yatim.** `umkm_promo` masih ada di database tetapi **tidak lagi disentuh kode mana pun** — fitur promo dicabut beserta `services/promo.py`, endpoint `/api/umkm/promo`, dan kuota `promo_aktif` pada katalog paket. Tabelnya sengaja tidak di-`DROP` di migrasi: menghapus tabel tidak bisa dibatalkan, dan tabel kosong tanpa pembaca tidak merugikan apa pun. Hapus manual kalau memang sudah dipastikan tidak diperlukan.

**Strategi RLS.** FastAPI memakai `service_role` dan melewati RLS; RLS di sini adalah pertahanan berlapis untuk akses browser→Supabase langsung. Tabel analitik (`itinerary_log`, `itinerary_place`, `ai_insight_cache`, `perjalanan_ulasan`, `laporan_lapangan`) **tanpa policy sama sekali** — service_role saja, sehingga aturan peran hanya ada di satu tempat.

`itinerary_log` dirancang **tanpa PII sejak awal**, sehingga anonimisasi adalah properti skema, bukan tambalan di ujung. `laporan_lapangan` tidak bisa mengikuti pola itu bulat-bulat — ia butuh induk (`ulasan_id`) agar ikut terhapus saat wisatawan menarik ulasannya — jadi **jalur bacanya** yang dibatasi: dinas dan UMKM membaca lewat view `laporan_lapangan_gov` yang sengaja tidak memilih kolom itu. Kalau pembatasan ini hanya berupa daftar kolom di Python, satu `select=*` yang tidak sengaja akan membocorkannya tanpa ada yang menyadari.

**Perjalanan "selesai".** Tidak ada kolom status; ia diturunkan dari `tanggal_mulai + n_days` (lihat `services/perjalanan.status_perjalanan`). Itinerary tanpa `tanggal_mulai` berstatus `TANPA_TANGGAL` dan **tidak** dianggap selesai hasil menebak dari `created_at` — wisatawan sendiri yang menyatakannya lewat `jadi_berangkat`. Itinerary yang disusun tanpa login tidak akan pernah bisa diulas: `user_id`-nya null, dan mengaitkannya belakangan lewat tebakan akan merusak sifat anonim yang justru sengaja dipegang.

---

## 5. Model bisnis (ringkas)

| Tier UMKM | Harga | Produk | AI Advisor |
|---|---|---|---|
| Gratis | Rp 0 | 5 | — |
| Growth | Rp 49.000/bln | 25 | 1×/30 hari |
| Pro | Rp 149.000/bln | ∞ | 8×/30 hari |

Gating dibalas **402 Payment Required** + `upgrade_url`, bukan 403. Bedanya penting: 403 adalah jalan buntu yang tidak bisa diperbaiki pengguna; 402 adalah pintu.

> **Langganan TIDAK membeli peringkat.** Ditegakkan struktur kode: `services/langganan.py` hanya diimpor router UMKM dan admin, tidak pernah mesin itinerary.

**Slot bersponsor tidak ada** dan kodenya tidak ada di dalam produk. Lini M3 dicabut dari lingkup saat ini.

Detail lengkap: [MODEL_BISNIS.md](MODEL_BISNIS.md).

---

## 6. Keamanan

### Autentikasi

Supabase Auth + Google OAuth. Backend memverifikasi JWT dengan **PyJWT + PyJWKClient** terhadap JWKS project (ES256/RS256), memeriksa `exp`, `aud == "authenticated"`, dan `iss`.

### Prompt injection — lima lapis

Teks yang ditulis UMKM masuk ke prompt AI Advisor, jadi permukaan serangannya nyata:

1. **Sanitasi saat tulis** — [`core/sanitasi.py`](../backend/app/core/sanitasi.py) menolak frasa perintah dengan HTTP 400, membuang karakter kendali dan format tak terlihat (Unicode Cf), menetralkan urutan `===`.
2. **Pagar berdelimiter nonce acak per permintaan** — penyerang tidak bisa menutup pagarnya sendiri karena tidak tahu nilainya.
3. **JSON mode + validasi Pydantic** dengan `extra="ignore"` — kunci asing dibuang.
4. **Teks UMKM tidak pernah masuk prompt GOV.** Aturan tunggal ini menghapus seluruh jalur injeksi lintas-tenant.
5. **Kalimat penjaga** pada setiap system prompt.

Angka dan teks dipisah **secara fisik**: angka per produk masuk blok `FAKTA`, nama dan deskripsinya masuk blok berpagar, dijembatani kunci `produk_1`, `produk_2`, ….

### Pembatasan laju

Dua lapis: kuota per pemanggil per jam, dan pagu harian menyeluruh. Untuk pengguna yang sudah masuk, ember dihitung **per akun**, bukan per IP — di belakang NAT kampus saat penjurian, satu IP dipakai banyak orang.

Cache narasi diperiksa **sebelum** pembatasan laju, sehingga membuka halaman berulang kali tidak memakan kuota siapa pun.

---

## 7. Menjalankan

### Prasyarat

Python 3.12 · Node 18+ · (opsional) kunci OpenAI dan project Supabase

### Backend

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend && npm install && npm run dev
```

Vite mem-proxy `/api` ke `localhost:8000`, jadi tidak perlu mengurus CORS di dev.

### Variabel lingkungan

Salin `.env.example` → `.env` (root) dan `frontend/.env.example` → `frontend/.env`.

| Variabel | Wajib? | Tanpa ini |
|---|---|---|
| `OPENAI_API_KEY` | Tidak | Seluruh angka & grafik tetap tampil; hanya narasi AI mati |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Tidak | Endpoint publik normal; login & dashboard berperan membalas 401/503 |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Tidak | Halaman berperan tidak bisa dibuka |
| `ADMIN_EMAILS` | Tidak | Daftar bootstrap peran ADMIN |
| `GOV_EMAILS` (alias lama `GOV_DEMO_EMAILS`) / `GOV_EMAIL_DOMAINS` | Tidak | Tidak ada surel yang otomatis berperan GOV; bawaan domain `go.id` |

> ⚠ `SUPABASE_SERVICE_ROLE_KEY` melewati seluruh RLS. **Hanya boleh ada di server** — jangan pernah di berkas `frontend/` atau variabel `VITE_*`.

### Deploy

Backend di **Render** (`render.yaml`, `uvicorn backend.main:app`), frontend di **Vercel** dengan rewrite `/api/:path*` ke layanan Render.

---

## 8. Pengujian

Verifikasi memakai **compile & smoke test**, bukan preview peramban.

```bash
python -c "import backend.main"        # backend
cd frontend && npm run build           # tsc -b adalah gerbang sesungguhnya
```

Smoke test per fase yang sudah dijalankan:

| Fase | Cakupan | Hasil |
|---|---|---|
| 7 | Cache narasi, degradasi tanpa kunci OpenAI, 3 lapis anti-injeksi | 49/49 |
| 8 | Kamus lengkap lintas batch, versi cache, anti-truncation | 30/30 |
| 9 | Gating 402, kuota 429, cache hit tidak memotong kuota, integritas peringkat | 29/29 |

**Uji anti-truncation** layak disebut: 150 string dikirim ke 日本語, **150 kembali, nol hilang** — membuktikan pemotongan diam-diam yang jadi bug laten sudah tertutup.

---

## 9. Keterbatasan yang diketahui

Bagian ini sengaja ada. Produk yang menyembunyikan batasnya lebih sulit dipercaya daripada yang menyatakannya.

1. **Volume ulasan adalah proksi permintaan, bukan jumlah kunjungan.** Dilabeli di setiap tampilan.
2. **Karo & Pakpak Bharat punya 0 destinasi terdata.** Itu artefak cakupan dataset — dan justru direkomendasikan sebagai temuan pendataan.
3. **Cakupan pemetaan ulasan ke tempat 8.844 dari 12.691 baris (69,7%).** Angkanya ikut diterbitkan di payload, tidak disembunyikan.
4. **`Durasi Kunjungan` 1,31 hari hanya ada untuk Toba**, dipakai nasional dengan catatan sumber.
5. **Kolom fasilitas adalah indikator keberadaan, bukan sensus.** Memperlakukannya sebagai magnitudo akan jadi fabrikasi.
6. **Narasi AI belum ikut diterjemahkan.** Kerangka kartunya sudah; isi prosanya masih Bahasa Indonesia.
7. **Pembayaran belum diaktifkan.** Status langganan diatur manual ADMIN.
8. **Angka model bisnis adalah asumsi terbuka**, bukan proyeksi terverifikasi.
9. **Cold start Render free** — instance tidur setelah 15 menit; request pertama menanggung pembangunan solver. Ping URL sesaat sebelum demo.

---

## 10. Peta berkas kritis

| Berkas | Peran |
|---|---|
| `engine.py` | ILP + skor UMKM + deteksi kabupaten. **Read-only** |
| `backend/app/services/solver_state.py` | Chokepoint harga — satu-satunya titik merge |
| `backend/app/services/analytics.py` | Objek `Intelligence`, agregat 8 kabupaten |
| `backend/app/services/ai_fakta.py` | Seluruh aritmetika narasi AI |
| `backend/app/core/security.py` | Verifikasi JWT + RBAC + gating paket |
| `backend/app/core/sanitasi.py` | Lapisan pertama anti-injeksi |
| `frontend/src/i18n.tsx` | Kamus 662 string + versi cache otomatis |
| `frontend/src/components/ItineraryBoard.tsx` | 861 baris, sengaja tidak disentuh |
| `docs/MODEL_BISNIS.md` | Deliverable model bisnis |
