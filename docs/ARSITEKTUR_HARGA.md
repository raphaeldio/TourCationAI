# Arsitektur Harga: Dua Lapisan yang Tidak Menimpa

> Status: **diterapkan** (17 Agustus 2026). Seluruh butir yang menyangkut harga
> sudah selesai; yang tersisa hanya rancangan paket langganan — lihat
> "Sisa pekerjaan".

## Masalah yang diselesaikan

Sistem lama menimpa harga dataset dengan harga produk UMKM terverifikasi
(`solver_state._terapkan_override_harga`). Pita harga sebuah usaha dihitung
`min()`/`max()` atas seluruh produknya yang lolos verifikasi, lalu ditulis ke
`solver.restos` — DataFrame yang dibaca `engine.py`.

Tiga akibat, semuanya nyata dan sudah diverifikasi di kode:

1. **Satu menu baru mengubah seluruh pita.** Es teh Rp 3.000 menurunkan
   `harga_min` warung itu dari, misalnya, Rp 30.000 ke Rp 3.000. Bukan sedikit
   — seluruhnya.

2. **Batas produk per paket langganan ikut menentukan peringkat.** `min`/`max`
   berjalan monoton terhadap jumlah produk. Paket yang mengizinkan lebih banyak
   produk menghasilkan `harga_min` lebih rendah, dan `harga_min` dibaca
   `engine.py` di empat tempat:

   | Lokasi | Peran | Arah pengaruh |
   |---|---|---|
   | `engine.py:1600` | Sinyal "murah", ambang keras Rp 25.000 | Bernilai `0,2 x 5,0 x umkm_w` di objective — sampai 0,50 poin pada profil Otentik Lokal |
   | `engine.py:336` | Skor kualitas, harga masuk positif | Berlawanan arah: `0,3 x (Δharga / ref) x 5,0` |
   | `engine.py:616-619` | Suku biaya ILP lewat `harga_tengah` | Searah, tanpa penyeimbang |
   | `engine.py:587` | `ref_resto = harga_min.max()`, normalizer global | Menggeser skor kualitas SELURUH restoran |

   Resultan dua efek pertama berbalik arah tergantung profil turis. Itu bukan
   desain — itu dua efek yang tidak pernah dijumlahkan.

   Konsekuensinya: aturan "langganan tidak membeli peringkat" **tidak bisa**
   ditegakkan hanya dengan memeriksa daftar impor, sebagaimana yang tertulis di
   `services/langganan.py`. Langganan tidak perlu menyentuh engine; cukup
   mengendalikan sebuah kuantitas yang engine baca lewat `min`/`max`.

3. **Ongkos penjagaan yang besar.** Agar aman, override menuntut baseline
   snapshot, klip 0,25x–4x median grup, ambang skor 0,7, TTL lima menit, dan
   siklus impor `solver_state` ↔ `price_check` yang harus diputus di dalam
   fungsi.

## Keputusan

Cabut override. Harga UMKM tidak pernah menyentuh `solver.restos`.

Alasannya bukan penjagaannya lemah — justru penjagaannya berlapis. Premisnya
yang keliru: menimpa mencampur dua jenis angka yang tidak sebanding.

| | Isi | Sifat | Sebutan di UI |
|---|---|---|---|
| `solver.restos` | Midpoint bucket harga Google | Perkiraan, bukan hasil ukur | **estimasi kisaran** (`est.`) |
| `umkm_product` | Harga menu sungguhan, dinilai komunitas | Laporan | **harga terlapor** |

Menggabungkan keduanya menghasilkan satu angka yang bukan keduanya, sekaligus
menghapus selisih antara keduanya — padahal selisih itulah temuan yang berguna
bagi pemerintah.

### Apa yang dilihat masing-masing peran

**Wisatawan** melihat keduanya berdampingan, dengan asal-usul yang jelas:

> **Rumah Makan Tigaraja** — est. Rp 35.000/orang
> Harga terlapor pemilik: ikan mas arsik Rp 28.000 · 12 dari 14 suara menilai wajar

**Pemerintah** mendapat selisihnya, yang sebelumnya justru terhapus:

> Samosir: estimasi kisaran bermedian Rp 37.500. Harga terlapor terverifikasi
> bermedian Rp 24.000 dari 18 usaha. Selisih −36%.

**UMKM** tetap punya alasan masuk: menunya tampil ke wisatawan, dinilai
komunitas, dan menyumbang ke statistik daerah.

### Fungsi baru suara komunitas

Suara tidak lagi menjadi gerbang ke solver. Ia menentukan dua hal yang lebih
langsung terlihat:

- **Apa yang dilihat wisatawan berikutnya** — harga terlapor dengan dukungan
  suara tampil sebagai terverifikasi; yang FLAGGED tidak.
- **Angka mana yang masuk hitungan pemerintah** — hanya harga terlapor
  terverifikasi yang menyumbang ke median "harga terlapor".

`price_check.py` dan skor verifikasi Wilson tetap hidup penuh. Keduanya berhenti
menjaga pintu ke solver, dan mulai menjaga pintu ke mata wisatawan serta laporan
pemerintah.

## Yang sudah diterapkan

| Berkas | Perubahan |
|---|---|
| `services/solver_state.py` | Ditulis ulang. `_harga_layak`, `_terapkan_override_harga`, `_baseline`, `KLIP_BAWAH`, `KLIP_ATAS`, `AMBANG_SKOR`, `_TTL_OVERRIDE` dihapus. `harga_dasar_restos()` kini mengembalikan `solver.restos` langsung. `muat_ulang_solver()` dialihkan jadi pemuat ulang CSV. Siklus impor ke `price_check` hilang. |
| `routers/admin.py` | `muat_ulang_harga` → `muat_ulang_data`; docstring disesuaikan. Route `/api/admin/solver/reload` tidak berubah. |
| `services/tautan_usaha.py` | Rujukan docstring ke chokepoint diarahkan ke `services/kompetitor.py`, pemakai kedua konvensi `kunci_nama`. |
| `components/ItineraryBoard.tsx` | Harga dataset diberi awalan `est.` + tooltip. |
| `i18n.tsx`, `locales/en.ts` | `"dipakai rekomendasi"`/`"belum dipakai"` → `"harga terverifikasi"`/`"belum terverifikasi"`. `"Dipakai rekomendasi"` → `"Harga terverifikasi"`. Kalimat yang mengklaim pengaruh ke mesin itinerary diganti. String `est.` ditambahkan. |
| `pages/UsahaSaya.tsx` | Label mengikuti kunci i18n baru. |

Verifikasi: `py_compile` bersih, smoke test solver hijau (117 restoran, 4 grup
acuan, `periksa()` mengembalikan OK/FLAGGED sesuai harapan, `muat_ulang_solver`
membangun acuan identik), `tsc --noEmit` exit 0, skema OpenAPI resolve penuh.

## Sisa pekerjaan

1. ~~Ganti nama `dipakai_rekomendasi`.~~ **Selesai.** Kini `harga_terverifikasi`
   di seluruh 8 titik: `services/umkm.py`, `routers/umkm.py`, `services/ekspor.py`
   (header kolom CSV ikut), `services/ai_fakta.py`, `typesUmkm.ts`,
   `pages/UsahaSaya.tsx`. Ringkasan dashboard jadi `n_harga_terverifikasi`.
   `ai_fakta` juga mendapat field `akibat_terverifikasi` yang menyatakan
   eksplisit bahwa status ini tidak mempengaruhi peringkat — supaya AI Advisor
   tidak mengarang bahwa menaikkan skor menaikkan posisi di itinerary.

2. ~~`SuaraHarga.tsx`.~~ **Selesai.** Docstring kini menyebut dua pintu yang
   sebenarnya dijaga suara komunitas.

3. ~~Analisis selisih untuk pemerintah.~~ **Selesai** — lihat bagian di bawah.

4. **Estimator pita, jika lapisan terlapor kelak diringkas.** Kalau suatu saat
   harga terlapor perlu diringkas jadi satu pita per usaha (mis. untuk
   ditampilkan atau diagregasi), jangan pakai `min`/`max`. Aturannya:
   **estimator tidak boleh bergantung pada berapa banyak produk yang dimiliki
   sebuah usaha.** p25/p75 atas hidangan utama dengan minimum 3 produk memenuhi
   syarat itu; `min`/`max` tidak, karena nilainya monoton terhadap `n`.

5. **Desain paket langganan.** Masih rancangan, belum diterapkan. Angka
   sebenarnya tetap `FREE(advisor 0, produk 5, riwayat 1)` /
   `GROWTH(1, 25, 12)` / `PRO(8, tak terbatas, 24)`. Yang sudah berubah hanya
   `promo_aktif`, yang hilang karena `promo.py` dihapus. Sejak `batas_produk`
   tidak lagi menyentuh peringkat, membukanya jadi tak terbatas kini murni
   keputusan komersial — jauh lebih aman daripada saat rancangan ini dibahas.

## Verifikasi dinas dan kaitannya dengan skor

Sejak `umkm_business.verified` punya pemiliknya sendiri
(`services/verifikasi.py`, dinas kabupaten), satu komponen skor verifikasi harga
kini digerakkan manusia — dan itu perlu dibaca bersama arsitektur di atas.

`usaha_terverifikasi` bernilai seperempat dari komponen kelengkapan, yang
berbobot 0,20. Jadi **0,05 dari total**. Sisanya — 0,45 statistik dan 0,35
komunitas — tidak bisa disentuh petugas.

Kekecilan itu disengaja dan penting justru karena adanya `selisih_harga.py`:
pemerintah membaca statistik yang disusun dari harga terverifikasi. Kalau
verifikasi dinas berbobot besar, pihak yang diukur bisa menyetel alat ukurnya
sendiri. Dengan 0,05, petugas yang berpihak pun tidak bisa membuat harga janggal
menjadi terverifikasi.

Dua pemisahan lain yang menjaga hal serupa:

- **Verifikasi bukan pemberian akses.** Baris `umkm_business` tetap dibuat saat
  ADMIN menyetujui klaim, jadi usaha bisa langsung mengisi menu. Menahan
  verifikasi hanya menahan lencana, bukan hak berusaha — tanpa pemisahan ini,
  petugas cukup tidak menekan tombol untuk mengucilkan pesaing.
- **Wilayah tidak bisa dipilih sendiri.** `profiles.kabupaten` hanya ditulis
  lewat jalur admin; endpoint biodata sengaja tidak memuatnya. Petugas tanpa
  wilayah tidak bisa memverifikasi apa pun — gagal tertutup, bukan terbuka.

## Catatan untuk demo

`PenilaianTempat` hanya muncul untuk tempat yang sudah diklaim akun UMKM
(`tautan_usaha.py`). Rumah makan CSV tanpa pemilik tidak menampilkan panel apa
pun — pastikan beberapa tempat pada itinerary contoh sudah punya akun terklaim
dan menu terisi, atau seluruh lapisan kedua tidak akan terlihat.
