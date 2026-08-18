-- =====================================================================
-- Simpan itinerary — perjalanan milik wisatawan
-- =====================================================================
-- Sebelum ini, itinerary hanya tercatat sebagai efek samping analitik di
-- `itinerary_log`: tanpa payload, tanpa judul, dan tanpa niat pengguna. Yang
-- tersimpan cukup untuk menghitung agregat, tetapi tidak cukup untuk MEMBUKA
-- kembali rencananya.
--
-- KENAPA TABEL TERPISAH, bukan kolom `payload` di `itinerary_log`.
-- Berkas dokumentasi menyatakan aturannya terang-terangan: "Yang dicatat
-- sengaja dibatasi pada field permintaan, ringkasan respons, dan tabel fakta
-- tempat. Tanpa PII, tanpa payload mentah: anonimitas jadi sifat skema, bukan
-- tambalan saat laporan diekspor." Menambahkan payload mentah ke sana akan
-- melanggarnya secara langsung — dan `itinerary_log` dibaca dashboard
-- pemerintah, yang tidak boleh punya jalan menuju isi rencana satu orang.
--
-- Pembagian perannya jadi:
--
--   itinerary_log       identitas + fakta perjalanan, dibaca analitik  (anonim)
--   itinerary_simpanan  payload + judul, dibaca pemiliknya saja        (milik)
--
-- `perjalanan_ulasan` tetap menunjuk `itinerary_log`, bukan tabel ini: sebuah
-- perjalanan boleh diulas walau pemiliknya tidak pernah menekan Simpan.
-- =====================================================================

create table if not exists public.itinerary_simpanan (
  -- PK-nya itinerary_id, bukan id sendiri: satu itinerary punya paling banyak
  -- satu simpanan. Kalau PK-nya terpisah, "simpan" dua kali menghasilkan dua
  -- baris untuk rencana yang sama dan inbox menampilkannya berganda.
  itinerary_id  uuid primary key
                references public.itinerary_log (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,

  -- Nama yang diberi pengguna. Kosong berarti UI merangkainya dari kabupaten
  -- dan durasi — judul wajib akan memaksa orang mengarang nama sebelum boleh
  -- menyimpan, dan itu menghalangi tindakan yang seharusnya satu klik.
  judul         text,

  -- Rencana utuh sebagaimana dikirim ke klien: days, agenda, hotel, biaya,
  -- rute. Disimpan apa adanya, BUKAN disusun ulang dari parameter saat dibuka.
  --
  -- Alasannya menentukan: menyusun ulang lewat solver akan menghasilkan rencana
  -- yang BERBEDA begitu dataset, harga, atau bobot berubah — dan `itinerary_log`
  -- pun tidak menyimpan origin_lat/origin_lon, jadi rekonstruksinya tidak akan
  -- pernah utuh. Rencana yang berubah sendiri setelah disimpan bukan rencana
  -- yang disimpan.
  payload       jsonb not null,

  disimpan_pada timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists itinerary_simpanan_user_idx
  on public.itinerary_simpanan (user_id, disimpan_pada desc);

alter table public.itinerary_simpanan enable row level security;

comment on table public.itinerary_simpanan is
  'Rencana perjalanan yang disimpan wisatawan: payload utuh + judul. Terpisah '
  'dari itinerary_log supaya tabel analitik tetap tanpa payload mentah. RLS '
  'aktif tanpa policy - service_role saja, aturan peran ada di FastAPI.';

comment on column public.itinerary_simpanan.payload is
  'Payload itinerary apa adanya. Tidak pernah disusun ulang oleh solver saat '
  'dibuka: rencana yang berubah sendiri setelah disimpan bukan rencana yang '
  'disimpan.';


-- ---------------------------------------------------------------------
-- Verifikasi — hasilnya WAJIB dibaca
-- ---------------------------------------------------------------------
-- DDL tidak mengembalikan baris, sehingga "Success. No rows returned" muncul
-- baik ketika migrasi jalan MAUPUN ketika yang tereksekusi hanya blok komentar
-- (itu terjadi bila ada teks tersorot saat Run ditekan — SQL Editor menjalankan
-- seleksi, bukan seluruh berkas). SELECT ini memaksa jawabannya berupa data.
--
-- Yang benar: SATU baris, `ada` bernilai true.
select 'itinerary_simpanan' as objek,
       to_regclass('public.itinerary_simpanan') is not null as ada;
