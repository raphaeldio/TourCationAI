/**
 * Label tampilan dan warna lencana untuk umpan balik perjalanan.
 *
 * Dikumpulkan di satu berkas karena ketiga halaman yang memakainya —
 * UlasanPerjalanan (wisatawan), GovLapangan (dinas), UmkmUmpanBalik (pemilik) —
 * harus menyebut hal yang sama dengan kata yang sama. Kalau masing-masing
 * halaman menyimpan petanya sendiri, "TARIF_TIDAK_RESMI" akan berakhir sebagai
 * tiga istilah berbeda dan wisatawan yang melapor tidak akan mengenali
 * laporannya sendiri di tanggapan dinas.
 *
 * Kode enum TIDAK pernah ditampilkan apa adanya. `SINYAL_KOMUNIKASI` yang lolos
 * ke layar terbaca sebagai kebocoran isi database, dan garis bawahnya membuat
 * kalimat di sekitarnya ikut terlihat tidak selesai.
 */

import type {
  AkurasiBiaya,
  AkurasiWaktu,
  KategoriLaporan,
  StatusLaporan,
  StatusPerjalanan,
  TingkatLaporan,
} from "./typesPerjalanan";

export const LABEL_KATEGORI: Record<KategoriLaporan, string> = {
  AKSES_JALAN: "Akses jalan",
  FASILITAS_UMUM: "Fasilitas umum",
  KEBERSIHAN: "Kebersihan",
  PAPAN_PENUNJUK: "Papan penunjuk arah",
  SINYAL_KOMUNIKASI: "Sinyal komunikasi",
  KEAMANAN: "Keamanan",
  TARIF_TIDAK_RESMI: "Tarif tidak resmi",
  JAM_OPERASIONAL: "Jam buka tidak sesuai",
  LAINNYA: "Lainnya",
};

export const LABEL_TINGKAT: Record<TingkatLaporan, string> = {
  RINGAN: "Ringan",
  SEDANG: "Sedang",
  BERAT: "Berat",
};

export const LABEL_STATUS_LAPORAN: Record<StatusLaporan, string> = {
  BARU: "Baru",
  DIBACA: "Dibaca",
  DITINDAKLANJUTI: "Ditindaklanjuti",
  SELESAI: "Selesai",
  DITOLAK: "Ditolak",
};

export const LABEL_BIAYA: Record<AkurasiBiaya, string> = {
  JAUH_LEBIH_MURAH: "Jauh lebih murah",
  LEBIH_MURAH: "Lebih murah",
  SESUAI: "Sesuai perkiraan",
  LEBIH_MAHAL: "Lebih mahal",
  JAUH_LEBIH_MAHAL: "Jauh lebih mahal",
};

export const LABEL_WAKTU: Record<AkurasiWaktu, string> = {
  TERLALU_PADAT: "Terlalu padat",
  PAS: "Pas",
  TERLALU_LONGGAR: "Terlalu longgar",
};

export const LABEL_STATUS_PERJALANAN: Record<StatusPerjalanan, string> = {
  AKAN_DATANG: "Akan datang",
  BERJALAN: "Sedang berjalan",
  SELESAI: "Selesai",
  TANPA_TANGGAL: "Tanpa tanggal",
};

export const WARNA_STATUS_LAPORAN: Record<StatusLaporan, string> = {
  BARU: "bg-brand-amber/20 text-brand-amber-ink",
  DIBACA: "bg-ink/5 text-ink-soft",
  DITINDAKLANJUTI: "bg-brand-sage/15 text-brand-sage-ink",
  SELESAI: "bg-brand-sage/25 text-brand-sage-ink",
  DITOLAK: "bg-rose-100 text-rose-700",
};

/** Merah hanya untuk BERAT: kalau setiap tingkat berwarna, tidak ada yang menonjol. */
export const WARNA_TINGKAT: Record<TingkatLaporan, string> = {
  RINGAN: "bg-ink/5 text-ink-soft",
  SEDANG: "bg-brand-amber/15 text-brand-amber-ink",
  BERAT: "bg-rose-100 text-rose-700",
};
