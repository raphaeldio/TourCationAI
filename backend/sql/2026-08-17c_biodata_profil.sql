-- =====================================================================
-- Biodata pengguna
-- =====================================================================
-- Masuk hanya lewat Google OAuth, sehingga tidak ada formulir pendaftaran yang
-- bisa menanyakan apa pun. Akibatnya `profiles` selama ini hanya berisi apa
-- yang Google kirimkan — dan dua kolomnya, `full_name` dan `avatar_url`, tidak
-- pernah sekali pun dibaca atau ditulis aplikasi.
--
-- Migrasi ini menambahkan sisa biodata dan, yang lebih penting, satu penanda
-- yang menentukan kapan onboarding perlu ditampilkan.
--
-- KENAPA `biodata_lengkap_pada`, BUKAN memeriksa "full_name masih null".
-- Memeriksa kekosongan field membuat pengguna yang sengaja mengosongkan
-- nomor teleponnya dianggap belum pernah onboarding, lalu dipaksa mengisi
-- formulir yang sama berulang kali. Penanda waktu memisahkan dua hal yang
-- berbeda: "belum pernah mengisi" dan "mengisi lalu memilih mengosongkan".
--
-- CATATAN PRIVASI. Yang disimpan di sini adalah data pribadi, jadi seluruh
-- kolomnya NULLABLE dan tidak satu pun wajib di tingkat database. Kewajiban
-- hanya ada di formulir onboarding, dan hanya untuk nama. `tanggal_lahir` dan
-- `jenis_kelamin` ada karena diminta untuk segmentasi demografi dashboard
-- pemerintah — bila kelak segmentasi itu tidak dibangun, dua kolom ini
-- sebaiknya dicabut, bukan dibiarkan terisi tanpa pemakai.
--
-- Data ini TIDAK pernah masuk `itinerary_log`. Tabel itu dirancang tanpa PII
-- sejak awal dan dibaca dashboard pemerintah; agregat demografi apa pun harus
-- dihitung dengan join yang disengaja, bukan tersedia begitu saja.
-- =====================================================================

alter table public.profiles
  add column if not exists telepon      text,
  add column if not exists kota_asal    text,
  add column if not exists negara       text,
  add column if not exists bahasa_utama text,
  add column if not exists tanggal_lahir date,
  add column if not exists jenis_kelamin text,
  add column if not exists biodata_lengkap_pada timestamptz;

-- Batasan ditambahkan terpisah supaya migrasi tetap idempoten: `add column if
-- not exists` tidak menambahkan check bila kolomnya sudah ada dari percobaan
-- sebelumnya.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_jenis_kelamin_sah'
  ) then
    alter table public.profiles
      add constraint profiles_jenis_kelamin_sah
      check (jenis_kelamin is null or jenis_kelamin in
             ('LAKI_LAKI', 'PEREMPUAN', 'TIDAK_DISEBUTKAN'));
  end if;

  -- Tanggal lahir yang tidak mungkin biasanya salah ketik, bukan kecurangan.
  -- Ditolak di database supaya tahun 20226 tidak pernah masuk lalu merusak
  -- agregat umur yang menghitungnya sebagai umur negatif.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_tanggal_lahir_wajar'
  ) then
    alter table public.profiles
      add constraint profiles_tanggal_lahir_wajar
      check (tanggal_lahir is null
             or (tanggal_lahir > date '1900-01-01' and tanggal_lahir < current_date));
  end if;
end $$;

comment on column public.profiles.biodata_lengkap_pada is
  'Kapan pengguna menyelesaikan onboarding biodata. NULL = belum pernah, dan '
  'itulah satu-satunya pemicu halaman /biodata. Sengaja bukan pemeriksaan '
  '"full_name masih null": mengosongkan telepon tidak boleh membuat seseorang '
  'dipaksa onboarding ulang.';

comment on column public.profiles.jenis_kelamin is
  'LAKI_LAKI | PEREMPUAN | TIDAK_DISEBUTKAN. Opsi ketiga wajib ada dan bukan '
  'sekadar kesopanan: memaksa memilih salah satu dari dua membuat sebagian '
  'orang mengisi data yang tidak benar, dan itu merusak agregatnya sendiri.';

comment on column public.profiles.kota_asal is
  'Kota asal wisatawan. Dipakai agregat asal kunjungan di dashboard '
  'pemerintah; tidak pernah ditampilkan per orang.';


-- ---------------------------------------------------------------------
-- Verifikasi — hasilnya WAJIB dibaca
-- ---------------------------------------------------------------------
-- DDL tidak mengembalikan baris, sehingga "Success. No rows returned" muncul
-- baik ketika migrasi jalan MAUPUN ketika yang tereksekusi hanya blok komentar
-- (itu terjadi bila ada teks tersorot saat Run ditekan). SELECT di bawah
-- memaksa jawabannya berupa data.
--
-- Yang benar: TUJUH baris, `ada` semuanya true.
select k.kolom,
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles'
           and column_name = k.kolom
       ) as ada
from (values
  ('telepon'), ('kota_asal'), ('negara'), ('bahasa_utama'),
  ('tanggal_lahir'), ('jenis_kelamin'), ('biodata_lengkap_pada')
) as k(kolom);
