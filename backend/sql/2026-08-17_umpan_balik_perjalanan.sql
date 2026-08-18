-- =====================================================================
-- Umpan balik pasca-perjalanan
-- =====================================================================
-- Satu formulir di sisi wisatawan, tiga muara yang berbeda. Yang menentukan
-- ke mana sebuah butir pergi bukan siapa yang mengisinya, melainkan SIAPA
-- YANG BISA MEMPERBAIKINYA:
--
--   rasa/layanan/kebersihan warung  -> umkm_rating      (tabel lama)
--   harga sesuai/tidak              -> price_feedback   (tabel lama)
--   jalan, toilet, papan, pungli    -> laporan_lapangan (BARU, muara GOV)
--   rencana meleset (biaya/waktu)   -> perjalanan_ulasan(BARU, muara GOV)
--
-- Menyatukan keempatnya jadi satu kolom akan membuat UMKM disalahkan atas
-- jalan rusak, dan membuat dinas menerima keluhan "sambalnya kurang pedas".
--
-- Dua aturan lama yang ikut dipegang berkas ini:
--   1. Tabel analitik memakai RLS aktif TANPA policy -> service_role saja,
--      sehingga aturan peran tetap hanya ada di satu tempat (FastAPI).
--   2. Anonimitas adalah properti skema, bukan tambalan di ujung. Lihat
--      view `laporan_lapangan_gov` di bagian bawah.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. perjalanan_ulasan — ulasan tingkat PERJALANAN, bukan tingkat usaha
-- ---------------------------------------------------------------------
-- Ini yang menjawab "apakah rencana yang disusun mesin cocok dengan
-- kenyataan di lapangan" — pertanyaan yang tidak punya rumah di skema lama.
-- umkm_rating menilai usaha; tabel ini menilai RENCANA.
create table if not exists public.perjalanan_ulasan (
  id                uuid primary key default gen_random_uuid(),

  -- Satu perjalanan satu ulasan. Kunci uniknya di itinerary_id saja, bukan
  -- (itinerary_id, user_id): satu baris itinerary_log hanya pernah punya
  -- satu pemilik, jadi kunci gabungan cuma akan membuka celah duplikasi.
  itinerary_id      uuid not null unique
                    references public.itinerary_log (id) on delete cascade,
  user_id           uuid not null
                    references auth.users (id) on delete cascade,

  skor_keseluruhan  smallint not null check (skor_keseluruhan between 1 and 5),

  -- Dua sumbu akurasi rencana. Sengaja kategorik, bukan angka: wisatawan
  -- tidak menghitung selisih rupiah, ia hanya tahu "lebih mahal dari dugaan".
  akurasi_biaya     text check (akurasi_biaya in
                    ('JAUH_LEBIH_MURAH','LEBIH_MURAH','SESUAI',
                     'LEBIH_MAHAL','JAUH_LEBIH_MAHAL')),
  akurasi_waktu     text check (akurasi_waktu in
                    ('TERLALU_PADAT','PAS','TERLALU_LONGGAR')),

  -- Apakah perjalanan benar-benar dijalankan. Ulasan "batal jalan" tetap
  -- berharga (ia menjelaskan kenapa rencana tidak terpakai) tetapi TIDAK
  -- boleh ikut menjadi bukti lapangan.
  jadi_berangkat    boolean not null default true,

  catatan           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists perjalanan_ulasan_user_idx
  on public.perjalanan_ulasan (user_id, created_at desc);
create index if not exists perjalanan_ulasan_dibuat_idx
  on public.perjalanan_ulasan (created_at desc);

alter table public.perjalanan_ulasan enable row level security;

comment on table public.perjalanan_ulasan is
  'Ulasan tingkat perjalanan (bukan tingkat usaha): seberapa cocok rencana '
  'yang disusun mesin dengan kenyataan. RLS aktif tanpa policy — service_role '
  'saja, aturan peran ada di FastAPI.';


-- ---------------------------------------------------------------------
-- 2. laporan_lapangan — pengamatan yang menjadi tanggung jawab PEMERINTAH
-- ---------------------------------------------------------------------
-- Air Terjun Sipiso-piso tidak punya akun UMKM. Sebelum tabel ini, semua
-- keluhan tentang destinasi wisata — jalan, toilet, papan penunjuk — tidak
-- punya satu pun jalan masuk ke sistem.
--
-- Tabel ini juga satu-satunya sumber kebenaran lapangan untuk gap.py, yang
-- tujuh sumbunya seluruhnya diturunkan dari CSV. analytics.py sendiri
-- menyebut kolom fasilitasnya "INDIKATOR KEBERADAAN, bukan sensus".
create table if not exists public.laporan_lapangan (
  id              uuid primary key default gen_random_uuid(),

  -- Induknya ulasan, bukan pengguna. Lihat catatan anonimitas di view bawah.
  ulasan_id       uuid not null
                  references public.perjalanan_ulasan (id) on delete cascade,
  -- Didenormalisasi supaya kueri dinas tidak perlu menyentuh tabel yang
  -- memuat user_id sama sekali.
  itinerary_id    uuid not null
                  references public.itinerary_log (id) on delete cascade,

  place_name      text not null,
  -- Kunci join ke umkm_business.place_name_norm dan itinerary_place.
  -- Konvensinya sama persis (normalkan_nama); kalau suatu saat berubah,
  -- ketiganya harus berubah bersama.
  place_name_norm text generated always as (normalkan_nama(place_name)) stored,
  kabupaten       text,
  jenis           text check (jenis in ('wisata','resto','hotel')),

  kategori        text not null default 'LAINNYA' check (kategori in (
                    'AKSES_JALAN',       -- jalan rusak, sempit, tidak beraspal
                    'FASILITAS_UMUM',    -- toilet, parkir, tempat ibadah
                    'KEBERSIHAN',        -- sampah, sanitasi
                    'PAPAN_PENUNJUK',    -- rambu/penunjuk arah hilang
                    'SINYAL_KOMUNIKASI', -- tidak ada sinyal seluler
                    'KEAMANAN',          -- rawan, tidak ada penjagaan
                    'TARIF_TIDAK_RESMI', -- pungli, parkir liar, tarif dadakan
                    'JAM_OPERASIONAL',   -- tutup padahal jadwal bilang buka
                    'LAINNYA')),
  tingkat         text not null default 'SEDANG'
                  check (tingkat in ('RINGAN','SEDANG','BERAT')),
  isi             text,

  -- Siklus hidup yang sama persis dengan aspirasi, supaya petugas dinas
  -- tidak perlu mempelajari dua kosakata status untuk dua kotak masuk.
  status          text not null default 'BARU' check (status in
                  ('BARU','DIBACA','DITINDAKLANJUTI','SELESAI','DITOLAK')),
  tanggapan       text,
  ditanggapi_oleh uuid references auth.users (id),
  ditanggapi_pada timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists laporan_lapangan_ulasan_idx
  on public.laporan_lapangan (ulasan_id);
create index if not exists laporan_lapangan_kabupaten_idx
  on public.laporan_lapangan (kabupaten, kategori, created_at desc);
create index if not exists laporan_lapangan_status_idx
  on public.laporan_lapangan (status, created_at desc);
-- Dipakai UMKM untuk menemukan laporan yang menyangkut tempat yang ia klaim.
create index if not exists laporan_lapangan_norm_idx
  on public.laporan_lapangan (place_name_norm);

alter table public.laporan_lapangan enable row level security;

comment on table public.laporan_lapangan is
  'Pengamatan lapangan wisatawan yang menjadi tanggung jawab pemerintah, '
  'bukan UMKM. Dibaca dinas lewat view laporan_lapangan_gov yang tidak '
  'membawa ulasan_id. RLS aktif tanpa policy — service_role saja.';


-- ---------------------------------------------------------------------
-- 3. Anonimitas sebagai properti skema
-- ---------------------------------------------------------------------
-- itinerary_log sudah dirancang tanpa PII sejak awal. Laporan lapangan tidak
-- bisa mengikuti pola itu bulat-bulat — ia butuh induk agar bisa ikut terhapus
-- saat wisatawan menarik ulasannya — jadi jalur bacanya yang dibatasi.
--
-- View ini SENGAJA tidak memilih `ulasan_id`. Dinas membaca dari sini, bukan
-- dari tabel dasar, sehingga tidak ada satu pun kueri sisi pemerintah yang
-- punya jalan menuju identitas pelapor. Kalau pembatasan ini hanya ditulis
-- sebagai daftar kolom di Python, satu `select=*` yang tidak sengaja akan
-- membocorkannya tanpa ada yang menyadari.
create or replace view public.laporan_lapangan_gov
with (security_invoker = true) as
select
  id, itinerary_id, place_name, place_name_norm, kabupaten, jenis,
  kategori, tingkat, isi, status, tanggapan, ditanggapi_oleh, ditanggapi_pada,
  created_at, updated_at
from public.laporan_lapangan;

comment on view public.laporan_lapangan_gov is
  'Jalur baca laporan lapangan untuk dinas dan UMKM. Tidak memuat ulasan_id, '
  'sehingga tidak ada rute apa pun dari kotak masuk menuju identitas pelapor.';


-- ---------------------------------------------------------------------
-- 4. Penilaian bersaksi
-- ---------------------------------------------------------------------
-- Sampai sekarang siapa pun yang punya akun bisa memberi bintang ke usaha
-- mana pun tanpa pernah ke sana. Kolom ini menandai rating yang lahir dari
-- perjalanan nyata: itinerary-nya ada, tanggalnya sudah lewat, dan tempat itu
-- memang tercatat di itinerary_place.
--
-- CATATAN PENTING: kolom ini TIDAK mengubah bobot apa pun pada rumus
-- trust_score. Rumus 0,50·komunitas + 0,30·produk + 0,20·kelengkapan tetap
-- utuh dan tetap seperti yang didokumentasikan. Kolom ini murni pelabelan,
-- karena mengubah rumus kepercayaan berarti mengubah angka yang sudah
-- terlanjur dijelaskan ke pemilik usaha. Bobot boleh menyusul kalau memang
-- diputuskan, tapi itu keputusan tersendiri — bukan efek samping migrasi.
alter table public.umkm_rating
  add column if not exists itinerary_id uuid
  references public.itinerary_log (id) on delete set null;

create index if not exists umkm_rating_itinerary_idx
  on public.umkm_rating (itinerary_id);

comment on column public.umkm_rating.itinerary_id is
  'Terisi bila rating berasal dari ulasan pasca-perjalanan (penilaian '
  'bersaksi). Tidak memengaruhi bobot trust_score — hanya pelabelan.';


-- ---------------------------------------------------------------------
-- 5. Verifikasi — WAJIB dibaca hasilnya
-- ---------------------------------------------------------------------
-- Blok ini ada karena "berhasil" dan "tidak melakukan apa-apa" terlihat sama
-- di SQL Editor. Seluruh berkas ini terdiri dari DDL, dan DDL tidak
-- mengembalikan baris — jadi editor melaporkan "Success. No rows returned"
-- baik ketika migrasinya jalan MAUPUN ketika yang tereksekusi hanya blok
-- komentar di atas (itu terjadi bila ada teks yang tersorot saat Run ditekan;
-- SQL Editor menjalankan seleksi, bukan seluruh berkas).
--
-- SELECT di bawah memaksa jawabannya berupa data. Yang benar: EMPAT baris,
-- semuanya bernilai true. Kalau yang muncul "No rows returned", migrasinya
-- TIDAK jalan — pastikan tidak ada teks yang tersorot, lalu Run ulang.
select 'perjalanan_ulasan' as objek,
       to_regclass('public.perjalanan_ulasan') is not null as ada
union all
select 'laporan_lapangan',
       to_regclass('public.laporan_lapangan') is not null
union all
select 'laporan_lapangan_gov (view)',
       to_regclass('public.laporan_lapangan_gov') is not null
union all
select 'umkm_rating.itinerary_id', exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name = 'umkm_rating'
    and column_name = 'itinerary_id'
);
