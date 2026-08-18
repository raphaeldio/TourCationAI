/** Tipe untuk rating publik, aspirasi UMKM, dan pengumuman pemerintah. */

export type KategoriAspirasi =
  | "INFRASTRUKTUR"
  | "PERMODALAN"
  | "PELATIHAN"
  | "PROMOSI"
  | "PERIZINAN"
  | "LAINNYA";

export type StatusAspirasi =
  | "BARU"
  | "DIBACA"
  | "DITINDAKLANJUTI"
  | "SELESAI"
  | "DITOLAK";

export type JenisPengumuman =
  | "KEBIJAKAN"
  | "BANTUAN"
  | "PELATIHAN"
  | "EVENT"
  | "LAINNYA";

export type LabelTrust = "TERPERCAYA" | "BERKEMBANG" | "PERLU PEMBINAAN";

export interface Trust {
  skor: number;
  label: LabelTrust;
  n_rating: number;
  rata_rating: number | null;
  komponen?: Record<string, number>;
}

export interface Ulasan {
  id: string;
  rating: number;
  komentar: string | null;
  created_at: string;
  updated_at: string;
}

export interface RingkasRating {
  n: number;
  rata: number | null;
  n_puas: number;
  sebaran: Record<string, number>;
}

/** Suara kewajaran harga: +1 wajar, -1 kemahalan, 0 abstain. */
export type Suara = 1 | 0 | -1;

export interface RekapSuara {
  setuju: number;
  total: number;
  suara_saya: Suara | null;
}

/** Produk sebagaimana terlihat publik — tanpa catatan internal pemilik. */
export interface ProdukPublik {
  id: string;
  nama: string;
  deskripsi: string | null;
  harga: number;
  kategori: string | null;
  is_kuliner_khas: boolean;
  label_verifikasi: string | null;
  skor_verifikasi: number | null;
  harga_median_referensi: number | null;
  suara: RekapSuara;
}

export interface ProfilPublik {
  usaha: {
    id: string;
    place_name: string;
    kabupaten: string | null;
    alamat: string | null;
    deskripsi: string | null;
    jam_buka: string | null;
    verified: boolean;
  };
  trust: Trust;
  ringkas_rating: RingkasRating;
  ulasan: Ulasan[];
  produk: ProdukPublik[];
  rating_saya: { rating: number; komentar: string | null } | null;
}

export interface RatingSaya {
  business_id: string;
  nama_usaha: string | null;
  kabupaten: string | null;
  rating: number;
  komentar: string | null;
  updated_at: string;
}

export interface Aspirasi {
  id: string;
  business_id: string;
  nama_usaha?: string | null;
  kabupaten: string | null;
  kategori: KategoriAspirasi;
  judul: string;
  isi: string;
  status: StatusAspirasi;
  tanggapan: string | null;
  ditanggapi_pada: string | null;
  created_at: string;
}

export interface RingkasAspirasi {
  total: number;
  belum_ditangani: number;
  per_status: Record<StatusAspirasi, number>;
  per_kategori: Record<KategoriAspirasi, number>;
}

export interface Pengumuman {
  id: string;
  instansi: string | null;
  kabupaten: string | null;
  jenis: JenisPengumuman;
  judul: string;
  isi: string;
  nilai_bantuan: number | null;
  cara_daftar: string | null;
  tenggat: string | null;
  aktif: boolean;
  created_at: string;
}

/** Blok "Rekomendasi Lainnya" pada payload itinerary. */
export interface UmkmBerkembang {
  business_id: string;
  nama: string;
  kabupaten: string | null;
  alamat: string | null;
  deskripsi: string | null;
  jam_buka: string | null;
  skor_kepercayaan: number;
  label_kepercayaan: LabelTrust;
  n_rating: number;
  rata_rating: number | null;
  alasan_tampil: string;
  /** Rating disembunyikan selama penilaian belum cukup untuk menggambarkannya. */
  rating_dibekukan?: boolean;
  catatan_rating?: string;
}

/** Tempat makan pada rencana utama yang sudah diklaim satu akun UMKM. */
export interface UsahaTertaut {
  business_id: string;
  nama: string;
  kabupaten: string | null;
  skor_kepercayaan: number;
  label_kepercayaan: LabelTrust;
  n_rating: number;
  rata_rating: number | null;
  /** Penilaian pemanggil sendiri, bila sudah pernah memberi. */
  rating_saya: number | null;
}

export interface RekomendasiLainnya {
  judul: string;
  keterangan: string;
  item: UmkmBerkembang[];
}
