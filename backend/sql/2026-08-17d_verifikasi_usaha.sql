-- =====================================================================
-- Verifikasi usaha oleh pemerintah + antrean notifikasi
-- =====================================================================
-- Sampai sekarang `umkm_business.verified` hanya PERNAH DIBACA — di
-- `services/umkm.py` (0,05 dari skor verifikasi harga) dan `services/rating.py`
-- (skor kepercayaan). Tidak ada satu pun endpoint yang menyetelnya, jadi
-- nilainya hanya bisa diubah langsung di database. Migrasi ini memberinya
-- pemilik: petugas dinas di kabupaten usaha tersebut.
--
-- KENAPA PEMERINTAH, BUKAN ADMIN PLATFORM. Admin tidak punya cara memverifikasi
-- "saya pemilik Rumah Makan Tigaraja" yang lebih baik daripada percaya begitu
-- saja. Dinas kabupaten punya: data NIB/izin usaha, dan kemampuan datang ke
-- lokasi. Argumen yang sama sudah dipakai untuk peran GOV itu sendiri
-- (`routers/auth.py` menolak permohonan GOV karena domain surel dinas adalah
-- bukti yang lebih baik daripada penilaian admin).
--
-- YANG SENGAJA TIDAK DIPINDAHKAN KE PEMERINTAH: pemberian akses. Baris
-- `umkm_business` tetap dibuat saat ADMIN menyetujui klaim, sehingga pemilik
-- warung bisa langsung mengisi menu tanpa menunggu dinas. Kalau verifikasi dan
-- akses digabung, petugas yang menahan permohonan bisa mengucilkan pesaing —
-- dan pengucilan itu tidak diredam bobot skor mana pun. Dipisah begini,
-- menahan verifikasi hanya menahan lencana, bukan hak berusaha.
-- =====================================================================

-- --- 1. Jejak audit verifikasi ---------------------------------------------
-- Keputusan verifikasi kini politis, bukan administratif: ia dibuat pejabat
-- daerah atas warga daerahnya. Karena itu harus bisa ditelusuri siapa, kapan,
-- dan atas dasar apa — pola yang sama dengan `role_requests.reviewed_by`.
alter table public.umkm_business
  add column if not exists verified_by        uuid references auth.users(id),
  add column if not exists verified_at        timestamptz,
  add column if not exists verifikasi_catatan text,
  add column if not exists verifikasi_oleh_kabupaten text;

-- --- 2. Satu akun, satu usaha ----------------------------------------------
-- Sudah ditegakkan di `routers/admin.py` lewat pemeriksaan "sudah ada?" sebelum
-- insert, tetapi pemeriksaan-lalu-tulis punya jendela balapan: dua permohonan
-- yang disetujui bersamaan bisa menghasilkan dua usaha untuk satu pemilik.
-- Batasan di database menutup jendela itu, dan sekaligus menutup jalur sockpuppet
-- yang paling murah: satu akun tidak bisa memegang beberapa usaha sekaligus.
--
-- Keunikan SUREL sendiri sudah dijamin Supabase Auth (`auth.users.email`), jadi
-- satu alamat surel = satu akun = satu usaha.
create unique index if not exists umkm_business_owner_unik
  on public.umkm_business (owner_id);

-- --- 3. Antrean notifikasi ---------------------------------------------------
-- Outbox, bukan pengiriman langsung. Alasannya: pengiriman surel bisa gagal
-- karena hal-hal di luar kendali aplikasi (SMTP mati, kredensial salah, kuota
-- habis), dan kegagalan itu TIDAK BOLEH menggagalkan persetujuan yang sudah
-- sah. Barisnya ditulis lebih dulu; pengiriman menyusul dan boleh gagal berkali
-- kali tanpa kehilangan apa pun.
--
-- Konsekuensi yang disengaja: tanpa SMTP terkonfigurasi pun sistem tetap utuh.
-- Notifikasi menumpuk berstatus ANTRE dan tetap bisa dibaca dinas sebagai kotak
-- masuk di dashboard — surel hanyalah salah satu cara mengantarkannya.
create table if not exists public.notifikasi_gov (
  id            uuid primary key default gen_random_uuid(),
  jenis         text not null check (jenis in ('VERIFIKASI_TERTUNDA', 'USAHA_TERVERIFIKASI')),
  kabupaten     text,
  business_id   uuid references public.umkm_business(id) on delete cascade,
  tujuan_email  text not null,
  judul         text not null,
  isi           text not null,
  status        text not null default 'ANTRE'
                check (status in ('ANTRE', 'TERKIRIM', 'GAGAL')),
  percobaan     int  not null default 0,
  galat         text,
  created_at    timestamptz not null default now(),
  terkirim_at   timestamptz
);

create index if not exists notifikasi_gov_antre
  on public.notifikasi_gov (status, created_at)
  where status = 'ANTRE';

create index if not exists notifikasi_gov_kabupaten
  on public.notifikasi_gov (kabupaten, created_at desc);

-- Satu usaha tidak boleh mengantre dua notifikasi "menunggu verifikasi" yang
-- sama ke alamat yang sama. Persetujuan yang dijalankan dua kali — atau admin
-- yang menekan tombol berulang — tidak boleh membanjiri kotak masuk dinas.
create unique index if not exists notifikasi_gov_tanpa_ganda
  on public.notifikasi_gov (jenis, business_id, tujuan_email)
  where status <> 'GAGAL';

alter table public.notifikasi_gov enable row level security;

-- Tidak ada policy sama sekali: tabel ini hanya disentuh server lewat
-- service_role, yang memang melewati RLS. Klien browser tidak punya urusan
-- membaca antrean surel milik dinas.
