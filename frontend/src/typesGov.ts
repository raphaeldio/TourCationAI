/** Tipe untuk tindakan dinas: verifikasi usaha dan kotak masuk pemberitahuan. */

export interface UsahaVerifikasi {
  id: string;
  place_name: string;
  place_name_norm: string | null;
  kabupaten: string | null;
  alamat: string | null;
  telepon: string | null;
  jam_buka: string | null;
  deskripsi: string | null;
  verified: boolean | null;
  verified_at: string | null;
  verifikasi_catatan: string | null;
  verifikasi_oleh_kabupaten: string | null;
  created_at: string;
}

/**
 * `wilayah` null berarti pemanggilnya ADMIN — ia melihat seluruh kabupaten.
 * Untuk GOV nilainya selalu terisi, karena petugas tanpa wilayah tidak pernah
 * sampai ke sini: servernya membalas 403 dengan pesan yang bisa ditindaklanjuti.
 */
export interface DaftarVerifikasi {
  wilayah: string | null;
  usaha: UsahaVerifikasi[];
  ringkas: {
    n_usaha: number;
    n_terverifikasi: number;
    n_menunggu: number;
  };
  catatan: string;
}

export type JenisNotifikasi = "VERIFIKASI_TERTUNDA" | "USAHA_TERVERIFIKASI";
export type StatusNotifikasi = "ANTRE" | "TERKIRIM" | "GAGAL";

export interface NotifikasiGov {
  id: string;
  jenis: JenisNotifikasi;
  judul: string;
  isi: string;
  kabupaten: string | null;
  business_id: string | null;
  status: StatusNotifikasi;
  created_at: string;
  terkirim_at: string | null;
}

/**
 * `pengiriman_surel_aktif` false berarti SMTP belum dikonfigurasi. Pemberitahuan
 * tetap tercatat dan tetap terbaca di sini — hanya surelnya yang tidak berangkat.
 * Bedakan keduanya di layar; SMTP mati yang disembunyikan terlihat persis sama
 * dengan tidak ada kabar apa pun.
 */
export interface KotakMasukGov {
  wilayah: string | null;
  notifikasi: NotifikasiGov[];
  pengiriman_surel_aktif: boolean;
}
