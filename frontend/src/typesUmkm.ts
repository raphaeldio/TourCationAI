/** Tipe untuk fitur UMKM (F3). */

export type StatusHarga = "OK" | "SUSPECT" | "FLAGGED";
export type LabelVerifikasi = "TERVERIFIKASI" | "PERLU DITINJAU" | "DIRAGUKAN";

export interface Usaha {
  id: string;
  owner_id: string;
  place_name: string;
  place_name_norm: string | null;
  kabupaten: string | null;
  alamat: string | null;
  deskripsi: string | null;
  telepon: string | null;
  jam_buka: string | null;
  lat: number | null;
  lon: number | null;
  verified: boolean;
}

export interface KomponenVerifikasi {
  statistik: number;
  komunitas: number;
  kelengkapan: number;
  n_suara: number;
  n_setuju: number;
  status?: StatusHarga;
  label?: LabelVerifikasi;
  robust_z?: number | null;
  n_referensi?: number;
}

export interface Produk {
  id: string;
  business_id: string;
  nama: string;
  deskripsi: string | null;
  harga: number;
  kategori: string | null;
  is_kuliner_khas: boolean;
  aktif: boolean;
  harga_status: StatusHarga | null;
  harga_alasan: string | null;
  robust_z: number | null;
  harga_median_referensi: number | null;
  skor_verifikasi: number | null;
  label_verifikasi: LabelVerifikasi | null;
  komponen_verifikasi: KomponenVerifikasi | null;
  /** Satu-satunya penanda yang benar-benar menentukan: apakah harga ini
   *  boleh mempengaruhi mesin penyusun itinerary. */
  harga_terverifikasi: boolean;
}

export interface ReferensiHarga {
  grup: string;
  n: number;
  n_titik_harga: number;
  median: number;
  p25: number;
  p75: number;
}

export interface DashboardUmkm {
  usaha: Usaha;
  produk: Produk[];
  referensi_harga: ReferensiHarga | null;
  ringkas: {
    n_produk: number;
    n_harga_terverifikasi: number;
    n_bermasalah: number;
    skor_rata2: number | null;
  };
  catatan_harga: string;
}

export interface ProdukReq {
  nama: string;
  harga: number;
  deskripsi?: string | null;
  kategori?: string | null;
  is_kuliner_khas?: boolean;
}

export type KunciPaket = "FREE" | "GROWTH" | "PRO";

/** Satu tier pada katalog harga publik (GET /api/paket). */
export interface PaketPublik {
  kunci: KunciPaket;
  nama: string;
  harga_bulanan: number;
  kuota_advisor: number;
  /** 0 berarti tak terbatas. */
  batas_produk: number;
  riwayat_bulan: number;
  ekspor_csv: boolean;
  analisis_kompetitor: boolean;
}

/**
 * Status langganan usaha pemanggil (GET /api/umkm/langganan).
 *
 * Sengaja TIDAK meng-extend PaketPublik: katalog memakai `kunci`, sedangkan
 * status memakai `plan`. Menyatukannya lewat pewarisan akan memaksa salah satu
 * sisi membawa field yang tidak pernah diisinya.
 */
export interface StatusLangganan {
  plan: KunciPaket;
  nama: string;
  harga_bulanan: number;
  status: string;
  mulai: string | null;
  selesai: string | null;
  kuota_advisor: number;
  kuota_terpakai: number;
  kuota_sisa: number;
  /** 0 berarti tak terbatas. */
  batas_produk: number;
  riwayat_bulan: number;
  ekspor_csv: boolean;
  analisis_kompetitor: boolean;
  catatan: string | null;
  upgrade_url: string;
}

/* ── Analisis kompetitor sekabupaten, anonim (GROWTH & PRO) ─────────────── */

export interface PosisiProduk {
  id: string;
  nama: string;
  harga: number;
  persentil: number | null;
  posisi: string;
  status: StatusHarga | null;
}

export interface PosisiHarga {
  tersedia: boolean;
  alasan?: string;
  grup?: string;
  n_pembanding?: number;
  n_titik_harga?: number;
  median_wilayah?: number;
  p25?: number;
  p75?: number;
  median_saya: number | null;
  persentil_saya?: number | null;
  posisi?: string;
  per_produk: PosisiProduk[];
  metode?: string;
}

export interface PosisiPermintaan {
  tersedia: boolean;
  alasan?: string;
  n_pembanding?: number;
  sinyal_median?: number | null;
  sinyal_tertinggi?: number;
  rating_rata2_wilayah?: number | null;
  tertaut_dataset?: boolean;
  catatan?: string;
  sinyal_saya?: number;
  rating_saya?: number | null;
  peringkat?: number;
  dari?: number;
  persentil?: number;
  status_tren?: string;
  tersensor?: boolean;
}

/** Agregat usaha terdaftar sekabupaten. `tersedia: false` = disupresi k-min. */
export interface AgregatTerdaftar {
  tersedia: boolean;
  n_usaha: number;
  alasan?: string | null;
  n_produk?: number;
  median_harga_terdaftar?: number | null;
  kategori_ramai?: { kategori: string; n_usaha: number }[];
  n_kategori_disupresi?: number;
  share_kuliner_khas?: number | null;
}

export interface CelahMenu {
  tersedia: boolean;
  n_khas_kawasan?: number;
  sudah_ditawarkan: string[];
  belum_ditawarkan: string[];
  skor_umkm?: number;
  umkm_kuat?: boolean;
  komponen?: { kuliner_khas: boolean; nama_lokal: boolean; harga_terjangkau: boolean };
  catatan?: string;
}

export interface AnalisisKompetitor {
  kabupaten: string | null;
  n_produk_saya: number;
  posisi_harga: PosisiHarga;
  permintaan: PosisiPermintaan;
  terdaftar: AgregatTerdaftar;
  celah_menu: CelahMenu;
  operasional: {
    rasio_malam_wilayah: number | null;
    jam_buka_saya: string | null;
    musim_puncak: string | null;
    catatan: string;
  };
  anonimitas: { k_min: number; aturan: string };
  netralitas: string;
  paket: { plan: KunciPaket };
}

/* ── Riwayat statistik — jendela mengikuti paket ────────────────────────── */

export interface BulanRiwayat {
  bulan: string;
  dilihat: number;
  n_rating: number;
  rata_rating: number | null;
  n_suara: number;
  n_setuju: number;
  n_penilaian_harga: number;
  n_ditandai: number;
}

export interface RiwayatUmkm {
  plan: KunciPaket;
  jendela_bulan: number;
  jendela_maksimum: number;
  dibatasi_paket: boolean;
  bulan_tersembunyi: number;
  mulai: string;
  bulan: BulanRiwayat[];
  total: {
    dilihat: number;
    n_rating: number;
    rata_rating: number | null;
    n_suara: number;
    n_setuju: number;
    n_penilaian_harga: number;
    n_ditandai: number;
  };
  kosong: boolean;
  catatan: string;
}

/** Jenis berkas yang bisa diunduh tier PRO. */
export type JenisEkspor = "produk" | "penilaian" | "riwayat";
