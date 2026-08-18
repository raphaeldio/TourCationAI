/** Tipe untuk endpoint /api/intel/* (dashboard pemerintah & UMKM). */

export type StatusTren =
  | "NAIK CEPAT"
  | "TURUN"
  | "STABIL"
  | "DATA TIPIS"
  | "BARU MUNCUL"
  | "TERSENSOR";

export interface PitaHarga {
  n: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

export interface KabupatenAgregat {
  kabupaten: string;
  n_destinasi: number;
  n_umkm: number;
  n_umkm_kuat: number;
  tipe: Record<string, number>;
  entropi_kategori: number;
  rating_rata2_wisata: number | null;
  rating_rata2_umkm: number | null;
  pita_harga: PitaHarga;
  skor_fasilitas: number;
  fasilitas_ada: string[];
  rasio_malam: number;
  skor_malam: number;
  skor_keluarga: number;
  skor_budaya: number;
  wisatawan_2024: number | null;
  wisatawan_diimputasi: boolean;
  wisman_2024: number | null;
  budget_harian: [number, number] | null;
  durasi_kunjungan: number | null;
  musim_puncak: string | null;
  mice_event: string[];
  atraksi_terdokumentasi: { nama: string; deskripsi: string | null; harga_tiket: string | null }[];
  ulasan_bulanan: number[];
  ulasan_12_bulan: number;
  ulasan_6_terakhir: number;
  ulasan_6_sebelumnya: number;
  pertumbuhan: number;
  z: number;
  status_tren: StatusTren;
  yoy_kasar: number | null;
  tempat_tersensor: number;
}

export interface Ringkas {
  total_destinasi: number;
  total_umkm: number;
  total_umkm_kuat: number;
  total_kabupaten: number;
  kabupaten_tanpa_destinasi: string[];
  kabupaten_tanpa_umkm: string[];
  sebaran_kategori: Record<string, number>;
  total_ulasan_12_bulan: number;
  cakupan_ulasan: {
    baris_total: number;
    baris_terpetakan: number;
    rasio: number;
    label_tak_terbaca: number;
    tempat_tersensor: number;
    catatan_sensor: string;
  };
  tanpa_kabupaten: { wisata: number; umkm: number };
  dibangun: string;
  catatan: string[];
  sumber: string;
  peringatan_proksi: string;
}

export interface TempatRingkas {
  nama: string;
  kabupaten: string | null;
  kategori: string;
  rating: number | null;
  ulasan_12_bulan: number;
  status_tren: StatusTren;
}

export interface UmkmRingkas {
  nama: string;
  kabupaten: string | null;
  rating: number | null;
  skor_umkm: number | null;
  umkm_kuat: boolean | null;
  ulasan_12_bulan: number;
}

export interface IntelRingkas {
  ringkas: Ringkas;
  destinasi_populer: TempatRingkas[];
  umkm_populer: UmkmRingkas[];
}

export interface TempatTren {
  nama: string;
  kabupaten: string | null;
  kategori: string;
  pertumbuhan: number;
  z: number;
  ulasan_12_bulan: number;
  ulasan_6_terakhir: number;
  ulasan_6_sebelumnya: number;
  status_tren: StatusTren;
}

export interface IntelTren {
  seri_nasional: number[];
  label_seri: string[];
  tumbuh_cepat: TempatTren[];
  menurun: TempatTren[];
  per_kabupaten: {
    kabupaten: string;
    seri: number[];
    ulasan_12_bulan: number;
    pertumbuhan: number;
    status_tren: StatusTren;
  }[];
  metodologi: string;
}

/* ── Narasi AI (F1-F4) ──────────────────────────────────────────────── */

export interface ButirNarasi {
  judul: string;
  alasan: string;
  angka_pendukung: string[];
}

/** Bentuk umum balasan endpoint narasi.
 *
 * `narasi: null` bukan galat — itu keadaan sah saat OPENAI_API_KEY tidak
 * dipasang. Seluruh angka di halaman tetap lengkap; hanya paragrafnya absen.
 */
export interface HasilNarasi<T = Record<string, unknown>> {
  narasi: T | null;
  narasi_status: "ok" | "AI nonaktif";
  dari_cache: boolean;
  dibuat?: string;
  model?: string;
  catatan?: string;
}

export interface NarasiInsight {
  ringkasan: string;
  tren_muncul: ButirNarasi[];
  tumbuh_cepat: ButirNarasi[];
  menurun: ButirNarasi[];
  kategori_diminati: ButirNarasi[];
  analisis_umkm: string;
  rekomendasi_promosi: ButirNarasi[];
  rekomendasi_pembangunan: ButirNarasi[];
}

export interface NarasiGap {
  ringkasan: string;
  celah: ButirNarasi[];
  prioritas: ButirNarasi[];
  potensi_investasi: ButirNarasi[];
  rekomendasi: ButirNarasi[];
}

export interface NarasiSimulasi {
  ringkasan: string;
  insight: ButirNarasi[];
  tindak_lanjut: ButirNarasi[];
}

export interface NarasiAdvisor {
  ringkasan: string;
  produk_potensial: ButirNarasi[];
  saran_promo: ButirNarasi[];
  analisis_harga: string;
  prediksi_kunjungan: string;
  peluang: ButirNarasi[];
}

/** Seri KEDUA: perencanaan nyata dari log itinerary.
 *
 * Satuannya bukan ulasan dan tidak pernah dijumlahkan dengan IntelTren —
 * keduanya ditampilkan berdampingan, masing-masing dengan labelnya sendiri.
 * `aktif: false` berarti database belum siap; kartunya cukup disembunyikan.
 */
export type IntelLive =
  | { aktif: false; alasan: string }
  | {
      aktif: true;
      jendela_hari: number;
      total_itinerary: number;
      itinerary_jendela: number;
      itinerary_berhasil: number;
      itinerary_gagal: number;
      rerata_estimasi: number | null;
      ambang_ranking: number;
      cukup_untuk_ranking: boolean;
      seri_harian: { tanggal: string; itinerary: number }[];
      per_kabupaten: {
        kabupaten: string;
        itinerary: number;
        tempat_masuk_rencana: number;
      }[];
      tempat_teratas: {
        nama: string;
        masuk_rencana: number;
        kabupaten: string | null;
        jenis: string;
      }[];
      terpotong: boolean;
      diperbarui: string;
      catatan: string;
    };

export type KunciSumbu =
  | "destinasi"
  | "umkm"
  | "ragam"
  | "budaya"
  | "keluarga"
  | "malam"
  | "fasilitas";

export interface GapKabupaten {
  kabupaten: string;
  skor_gap: number;
  skor_prioritas: number;
  peringkat_prioritas: number;
  permintaan_ternormalisasi: number;
  sumbu: Record<KunciSumbu, number>;
  sumbu_label: Record<KunciSumbu, string>;
  bukti: {
    n_destinasi: number;
    n_umkm: number;
    n_umkm_kuat: number;
    entropi_kategori: number;
    skor_fasilitas: number;
    fasilitas_ada: string[];
    rasio_malam: number;
    wisatawan_2024: number | null;
    wisatawan_diimputasi: boolean;
    ulasan_12_bulan: number;
    mice_event: string[];
  };
  peta: { lat: number; lon: number; tanpa_data: boolean };
  atraksi_terdokumentasi: { nama: string; deskripsi: string | null; harga_tiket: string | null }[];
  rekomendasi: { sumbu: string; skor_gap: number; saran: string }[];
  catatan_data: string | null;
}

export interface IntelGap {
  kabupaten: GapKabupaten[];
  bobot: Record<KunciSumbu, number>;
  metodologi: string;
  ringkas: Ringkas;
}

/* ── Simulator dampak kebijakan (F4) ─────────────────────────────── */

export type KunciSkenario =
  | "festival"
  | "promosi"
  | "pelatihan_umkm"
  | "destinasi_baru"
  | "budaya";

export interface OpsiSimulasi {
  skenario: { kunci: KunciSkenario; label: string }[];
  kabupaten: {
    nama: string;
    wisatawan_2024: number | null;
    diimputasi: boolean;
    n_destinasi: number;
    n_umkm: number;
    n_umkm_kuat: number;
    musim_puncak: string | null;
  }[];
  profil: { kunci: string; umkm_weight: number; deskripsi: string }[];
  kategori: string[];
}

export interface SimulasiReq {
  skenario: KunciSkenario;
  kabupaten: string;
  profil?: string;
  skala?: "lokal" | "regional" | "nasional";
  waktu?: "puncak" | "biasa" | "sepi";
  anggaran?: number;
  jangkauan?: "lokal" | "nasional" | "internasional";
  n_terlatih?: number;
  n_destinasi_baru?: number;
  kategori_baru?: string;
  n_program?: number;
}

export interface HasilSimulasi {
  skenario: KunciSkenario;
  label_skenario: string;
  kabupaten: string;
  profil: string;
  uplift: number;
  dasar: {
    wisatawan: number;
    wisatawan_diimputasi: boolean;
    budget_harian: number;
    lama_tinggal: number;
    bagian_umkm: number;
    n_destinasi: number;
    n_umkm: number;
    n_umkm_kuat: number;
    ekonomi: number;
    transaksi_umkm: number;
  };
  dampak: {
    delta_wisatawan: number;
    wisatawan_sesudah: number;
    delta_ekonomi: number;
    delta_transaksi_umkm: number;
    delta_lama_tinggal: number;
    delta_bagian_umkm: number;
    delta_umkm_kuat?: number;
    potensi_umkm?: number;
    keandalan_data?: number;
    entropi_lama?: number;
    entropi_baru?: number;
    delta_skor_budaya?: number;
  };
  tanpa_intervensi: {
    wisatawan: number;
    pertumbuhan_dipakai: number;
    penjelasan: string;
  };
  seri: { bulan: string; dasar: number; intervensi: number }[];
  distribusi: {
    kabupaten: string;
    sebelum: number;
    sesudah: number;
    diimputasi: boolean;
  }[];
  asumsi: { parameter: string; nilai: string; sumber: string }[];
  catatan: string[];
  peringatan: string;
}

/* ── Seri keempat: selisih estimasi vs harga terlapor ───────────────────── */

export type PosisiHarga = "DI BAWAH" | "DI DALAM" | "DI ATAS";

/**
 * Cacah posisi selalu terbit pada n berapa pun — ia hitungan, bukan estimasi
 * sebaran. `selisih_*` null sampai `cukup_untuk_median` true.
 */
export interface SelisihBucket {
  kabupaten?: string;
  n_usaha: number;
  n_produk: number;
  posisi: Record<PosisiHarga, number>;
  selisih_rupiah: number | null;
  selisih_persen: number | null;
  cukup_untuk_median: boolean;
}

export interface SelisihUsaha {
  nama: string;
  kabupaten: string;
  n_produk: number;
  estimasi_min: number;
  estimasi_max: number;
  terlapor_median: number;
  posisi: PosisiHarga;
  selisih_rupiah: number;
  selisih_persen: number;
}

/**
 * Angka UTAMA di sini adalah `posisi`, bukan `selisih_rupiah`. Estimasi dataset
 * adalah pita harga makan per orang; harga terlapor adalah harga satu item
 * menu. Keduanya tidak sebanding langsung — tampilkan `metodologi` di dekat
 * angka apa pun yang diambil dari `selisih_*`.
 */
export type SelisihHarga =
  | { aktif: false; alasan: string }
  | {
      aktif: true;
      nasional: SelisihBucket;
      kabupaten: SelisihBucket[];
      urutan: string[];
      usaha: SelisihUsaha[];
      usaha_tanpa_pasangan_dataset: number;
      ambang: { skor_terverifikasi: number; min_usaha_median: number };
      metodologi: string;
    };
