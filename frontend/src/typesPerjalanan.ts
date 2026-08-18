/** Tipe untuk perjalanan wisatawan, ulasan pasca-perjalanan, dan laporan lapangan. */

export type StatusPerjalanan =
  | "AKAN_DATANG"
  | "BERJALAN"
  | "SELESAI"
  | "TANPA_TANGGAL";

export type AkurasiBiaya =
  | "JAUH_LEBIH_MURAH"
  | "LEBIH_MURAH"
  | "SESUAI"
  | "LEBIH_MAHAL"
  | "JAUH_LEBIH_MAHAL";

export type AkurasiWaktu = "TERLALU_PADAT" | "PAS" | "TERLALU_LONGGAR";

export type KategoriLaporan =
  | "AKSES_JALAN"
  | "FASILITAS_UMUM"
  | "KEBERSIHAN"
  | "PAPAN_PENUNJUK"
  | "SINYAL_KOMUNIKASI"
  | "KEAMANAN"
  | "TARIF_TIDAK_RESMI"
  | "JAM_OPERASIONAL"
  | "LAINNYA";

export type TingkatLaporan = "RINGAN" | "SEDANG" | "BERAT";

export type StatusLaporan =
  | "BARU"
  | "DIBACA"
  | "DITINDAKLANJUTI"
  | "SELESAI"
  | "DITOLAK";

export interface Perjalanan {
  id: string;
  created_at: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  tanggal_diperkirakan: boolean;
  mungkin_selesai?: boolean;
  status: StatusPerjalanan;
  n_days: number | null;
  n_nights: number | null;
  n_orang: number | null;
  budget_total: number | null;
  total_estimasi: number | null;
  profil: string | null;
  kabupaten_tersentuh: string[] | null;
  hotel_name: string | null;
  n_agenda: number | null;
  /** true bila pengguna menekan Simpan — hanya yang ini bisa dibuka kembali. */
  disimpan: boolean;
  judul: string | null;
  disimpan_pada: string | null;
  sudah_diulas: boolean;
  skor_ulasan: number | null;
  boleh_diulas: boolean;
  boleh_dibuka: boolean;
}

/** Rencana tersimpan, apa adanya seperti saat disimpan. */
export interface PerjalananTersimpan {
  itinerary_id: string;
  judul: string | null;
  /** Payload itinerary utuh; bentuknya sama dengan respons POST /api/itinerary. */
  payload: unknown;
  disimpan_pada: string;
  updated_at: string;
  status: StatusPerjalanan;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  tanggal_diperkirakan: boolean;
  mungkin_selesai?: boolean;
  sudah_diulas: boolean;
  skor_ulasan: number | null;
  boleh_diulas: boolean;
}

export interface TempatPerjalanan {
  jenis: "wisata" | "resto" | "hotel";
  place_name: string;
  kabupaten: string | null;
  hari: number | null;
  slot: string | null;
  place_type: string | null;
}

export interface UsahaTertautPerjalanan {
  business_id: string;
  nama: string;
  kabupaten: string | null;
  rating_saya: number | null;
  komentar_saya: string | null;
}

export interface UlasanPerjalanan {
  id: string;
  itinerary_id: string;
  skor_keseluruhan: number;
  akurasi_biaya: AkurasiBiaya | null;
  akurasi_waktu: AkurasiWaktu | null;
  jadi_berangkat: boolean;
  catatan: string | null;
  created_at: string;
}

export interface Laporan {
  id: string;
  place_name: string;
  kabupaten: string | null;
  jenis: string | null;
  kategori: KategoriLaporan;
  tingkat: TingkatLaporan;
  isi: string | null;
  status: StatusLaporan;
  tanggapan: string | null;
  ditanggapi_pada: string | null;
  created_at: string;
}

/** Metadata kategori dari server — termasuk sumbu gap.py yang dikonfirmasinya. */
export interface KategoriMeta {
  kode: KategoriLaporan;
  label: string;
  sumbu: string | null;
  pendataan: boolean;
  petunjuk: string;
}

export interface DetailUlasan {
  perjalanan: Perjalanan;
  boleh_diulas: boolean;
  tempat: TempatPerjalanan[];
  usaha_tertaut: Record<string, UsahaTertautPerjalanan>;
  ulasan: UlasanPerjalanan | null;
  laporan: Laporan[];
  pilihan: {
    akurasi_biaya: AkurasiBiaya[];
    akurasi_waktu: AkurasiWaktu[];
    kategori_laporan: KategoriMeta[];
    tingkat: TingkatLaporan[];
  };
}

export interface LaporanBaru {
  place_name: string;
  kategori: KategoriLaporan;
  tingkat: TingkatLaporan;
  isi?: string | null;
}

export interface PenilaianBaru {
  business_id: string;
  rating: number;
  komentar?: string | null;
}

export interface UlasanBaru {
  skor_keseluruhan: number;
  akurasi_biaya?: AkurasiBiaya | null;
  akurasi_waktu?: AkurasiWaktu | null;
  jadi_berangkat: boolean;
  catatan?: string | null;
  laporan?: LaporanBaru[];
  penilaian?: PenilaianBaru[];
}

export interface HasilUlasan {
  ulasan: UlasanPerjalanan;
  n_laporan: number;
  n_penilaian: number;
  penilaian_ditolak: string[];
  catatan: string;
}

// ── Sisi pemerintah ────────────────────────────────────────────────────────
export interface RekapKategori {
  kode: KategoriLaporan;
  label: string;
  n: number;
  sumbu_gap: string | null;
  pendataan: boolean;
}

export interface RekapKabupatenLapangan {
  kabupaten: string;
  n: number;
  indeks_tekanan: number;
  n_berat: number;
  belum_ditangani: number;
  kategori_teratas: KategoriLaporan | null;
  n_konfirmasi_fasilitas: number;
  n_masalah_pendataan: number;
  cukup_untuk_bukti: boolean;
}

export interface AkurasiRencana {
  n_ulasan: number;
  rata_skor: number | null;
  biaya: Partial<Record<AkurasiBiaya, number>>;
  waktu: Partial<Record<AkurasiWaktu, number>>;
  porsi_lebih_mahal: number | null;
  cukup_untuk_kesimpulan: boolean;
}

export interface AgregatLapangan {
  aktif: boolean;
  alasan?: string;
  jendela_hari?: number;
  total?: number;
  belum_ditangani?: number;
  ambang_bukti?: number;
  cukup_untuk_bukti?: boolean;
  per_kategori?: RekapKategori[];
  per_kabupaten?: RekapKabupatenLapangan[];
  tempat_teratas?: { nama: string; n_laporan: number; kabupaten: string | null; jenis: string | null }[];
  akurasi_rencana?: AkurasiRencana;
  terpotong?: boolean;
  diperbarui?: string;
  metodologi?: string;
}

// ── Sisi UMKM ──────────────────────────────────────────────────────────────
export interface PenilaianBersaksi {
  rating: number;
  komentar: string | null;
  created_at: string;
  updated_at: string;
}

export interface UmpanBalikUmkm {
  penilaian_bersaksi: PenilaianBersaksi[];
  n_bersaksi: number;
  laporan: Laporan[];
  ringkas_laporan: {
    total: number;
    belum_ditanggapi: number;
    bisa_saya_perbaiki: number;
    per_kategori: { kode: KategoriLaporan; label: string; n: number }[];
  };
  catatan: string;
}
