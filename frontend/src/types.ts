/** Rincian keberpihakan UMKM satu tempat makan. */
export interface SinyalUmkm {
  /** 0.0 – 1.0 dari tiga sinyal berbobot. */
  skor: number;
  /** true bila skor >= 0.5 — ambang "UMKM lokal otentik". */
  kuat: boolean;
  /** Kuliner khas Batak yang terdeteksi di menunya. */
  kuliner_khas: string[];
  nama_lokal: boolean;
  harga_terjangkau: boolean;
}

export interface DampakLokal {
  status: string;
  total_kunjungan_makan: number;
  usaha_unik_dikunjungi: number;
  umkm_lokal_otentik: number;
  proporsi_umkm: number;
  ragam_kuliner_khas: number;
  daftar_kuliner_khas: string[];
  sebaran_merata: number;
  estimasi_kasar_ke_usaha_lokal: number;
}

export interface Place {
  name: string;
  type?: string | null;
  kategori: string;
  rating?: number | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  price_per_person: number;
  price_group: number;
  operational_hour?: string | null;
  /** Hanya ada pada tempat makan; null untuk wisata & hotel. */
  umkm?: SinyalUmkm | null;
  /** Jam buka versi kaya dari dataset waktu operasional (tahu hari). */
  opening_hours?: string | null;
  /** Hari libur mingguan, mis. ["Senin"]. Kosong bila buka tiap hari. */
  closed_days?: string[];
  /** "jadwal_mingguan" | "operational-hour" | null. */
  hours_source?: string | null;
  /** Peringatan tutup pada jam/hari kunjungan. */
  warning?: string | null;
}

export interface AgendaWisata {
  kind: "wisata";
  time: string;
  place: Place;
}

export interface AgendaMakan {
  kind: "makan";
  time: string;
  slot: string;
  options: Place[];
}

export type AgendaItem = AgendaWisata | AgendaMakan;

export interface NearbyPlace {
  name: string;
  lat: number;
  lon: number;
  km: number;
}

export interface Penyeberangan {
  dari: string;
  ke: string;
  keterangan: string | null;
}

/** Satu fasilitas umum: nama, alamat bila ada, dan kabupatennya. */
export interface Fasilitas {
  nama: string;
  alamat?: string | null;
  kabupaten: string;
}

/** Sekelompok fasilitas sejenis, mis. seluruh SPBU di kabupaten yang dilalui. */
export interface GrupFasilitas {
  kunci: string;
  label: string;
  /** Total di data — bisa lebih banyak dari `item` yang ditampilkan. */
  jumlah: number;
  item: Fasilitas[];
}

export interface DayPlan {
  day: number;
  /** Kabupaten yang dilalui hari ini, dideteksi dari alamat tempat. */
  kabupaten?: string[];
  /** Fasilitas umum di kabupaten tersebut. */
  fasilitas?: GrupFasilitas[];
  /** Nama hari, mis. "Senin". null bila tanggal mulai tidak diisi. */
  weekday?: string | null;
  distance_km: number | null;
  drive_minutes: number | null;
  n_wisata: number;
  agenda: AgendaItem[];
  nearby: NearbyPlace[];
  penyeberangan: Penyeberangan[];
}

/** Ringkasan kerja tiap modul engine.py, untuk section Analisis AI. */
export interface Analisis {
  solver_status: string;
  n_wisata_terpilih: number;
  n_resto_terpilih: number;
  total_min: number;
  total_max: number;
  hotel_gratis_pulang_hari: boolean;
  sumber_jarak: string;
  total_jarak_km: number;
  osrm_aktif: boolean;
  jam_agenda: string;
  n_agenda: number;
  total_penyeberangan: number;
  umkm_weight?: number;
  profil: string;
  profil_deskripsi: string;
}

export interface Summary {
  budget_total: number;
  total_estimasi: number;
  total_min: number;
  total_max: number;
  sisa_estimasi: number;
  persen_terpakai: number;
  per_hari: number;
  per_orang: number;
  n_days: number;
  n_nights: number;
  n_orang: number;
  profil: string;
  profil_deskripsi: string;
  minat: string[];
  umkm_weight?: number;
  /** true bila jarak nyata membuat rencana melewati budget. */
  lewat_budget?: boolean;
}

export interface Hotel {
  name: string;
  rating?: number | null;
  address?: string | null;
  price: number;
  lat?: number | null;
  lon?: number | null;
}

export type Moda = "jalan_kaki" | "motor" | "mobil" | "umum";

/** Rincian biaya transportasi. */
export interface Transport {
  moda: Moda;
  label: string;
  biaya_bbm: number;
  liter_bbm: number;
  biaya_darat: number;
  biaya_feri: number;
  total: number;
  tarif_per_km: number;
  tarif_umum_per_orang_per_hari: number;
  tarif_feri_satuan: number;
  n_penyeberangan: number;
  km_total: number;
  km_per_hari: number;
  /** false bila moda tidak masuk akal untuk jarak rencana ini. */
  realistis: boolean;
  batas_km_per_hari: number;
}

/** Pangkal rute harian: hotel acuan, atau lokasi turis bila tanpa penginapan. */
export interface TitikAcuan {
  "place-name": string;
  latitude: number;
  longitude: number;
  jenis: "hotel" | "lokasi_user";
}

/**
 * Kandidat penginapan beserta akibatnya pada rencana. `total_estimasi` dan
 * `jarak_rata2_wisata` adalah hasil ILP yang dijalankan untuk hotel ini.
 */
export interface HotelKandidat {
  name: string;
  rating: number | null;
  address: string | null;
  price: number;
  lat: number;
  lon: number;
  total_estimasi: number;
  jarak_rata2_wisata: number;
  terpilih: boolean;
}

export interface Itinerary {
  status: string;
  message?: string;
  summary: Summary;
  /** null saat penginapan tidak diikutkan — pakai `titik_acuan` sebagai gantinya. */
  hotel: Hotel | null;
  /** Kosong saat tanpa penginapan. */
  hotel_kandidat?: HotelKandidat[];
  /** "dipilih_sistem" = hasil pencarian; "pilihan_turis" = turis yang menentukan. */
  hotel_sumber?: "dipilih_sistem" | "pilihan_turis";
  titik_acuan?: TitikAcuan;
  transport?: Transport;
  days: DayPlan[];
  landmarks: Place[];
  analisis?: Analisis;
  dampak_lokal?: DampakLokal;
}

export interface MinatOption {
  key: string;
  /** Ikon digambar di sisi React (MinatIcon), backend tidak mengirim emoji. */
  deskripsi: string;
}

/** Bahasa yang didukung penerjemah. `stt` = kode BCP-47 untuk Web Speech API. */
export interface Bahasa {
  code: string;
  label: string;
  stt: string;
}

/** Gaya pengalaman; keempatnya setara, bukan tingkatan kualitas. */
export interface ProfilOption {
  key: string;
  deskripsi: string;
  umkm_weight: number;
}

/** Seberapa jauh turis rela pergi; bobot besar = makin menghindari jarak. */
export interface GayaJelajahOption {
  key: string;
  deskripsi: string;
  bobot: number;
}

export interface PlanForm {
  budget_total: number;
  n_days: number;
  n_orang: number;
  minat_wisata: string[];
  max_attractions_per_day: number;
  /** null = biarkan engine menyarankan dari budget per hari. */
  profil_pilihan: string | null;
  /** false = tanpa menginap: n_nights 0, rute berpangkal di `origin`. */
  include_penginapan: boolean;
  /** Koordinat turis, dipakai sebagai titik acuan saat tanpa penginapan. */
  origin: { lat: number; lon: number; label: string } | null;
  /** Moda transportasi; menentukan biaya BBM/tarif dan harga feri. */
  moda: Moda;
  /** null = sistem mencari sendiri. Mengubahnya menyusun ULANG rencana. */
  hotel_pilihan: string | null;
  /** "Dekat-dekat" | "Seimbang" | "Jelajah jauh"; null = default engine. */
  gaya_jelajah: string | null;
  /** "YYYY-MM-DD"; kosong = libur mingguan hanya dicatat, tidak dihindari. */
  tanggal_mulai: string | null;
}
