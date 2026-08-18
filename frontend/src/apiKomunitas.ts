/** Klien untuk rating publik, aspirasi, dan pengumuman. */

import { kepalaAuth } from "./auth";
import type {
  Aspirasi,
  JenisPengumuman,
  KategoriAspirasi,
  Pengumuman,
  ProfilPublik,
  RatingSaya,
  RingkasAspirasi,
  StatusAspirasi,
} from "./typesKomunitas";

async function lempar(r: Response): Promise<never> {
  let pesan = r.statusText;
  try {
    const isi = await r.json();
    if (typeof isi?.detail === "string") pesan = isi.detail;
    else if (isi?.detail?.pesan) pesan = isi.detail.pesan;
  } catch {
    /* body bukan JSON */
  }
  if (r.status === 401) pesan = "Sesi Anda berakhir. Silakan masuk kembali.";
  throw new Error(pesan);
}

async function minta<T>(jalur: string, metode = "GET", isi?: unknown): Promise<T> {
  const r = await fetch(jalur, {
    method: metode,
    headers: { "Content-Type": "application/json", ...(await kepalaAuth()) },
    body: isi === undefined ? undefined : JSON.stringify(isi),
  });
  if (!r.ok) await lempar(r);
  return r.json() as Promise<T>;
}

// ── Rating publik ─────────────────────────────────────────────────────────
export const ambilProfilPublik = (businessId: string) =>
  minta<ProfilPublik>(`/api/umkm-publik/${businessId}`);

/** PUT, bukan POST — satu akun satu rating, jadi operasinya idempoten. */
export const simpanRating = (businessId: string, rating: number, komentar?: string) =>
  minta<{ aksi: string; rating: number }>(
    `/api/umkm-publik/${businessId}/rating`,
    "PUT",
    { rating, komentar: komentar || null },
  );

export const hapusRating = (businessId: string) =>
  minta<{ status: string }>(`/api/umkm-publik/${businessId}/rating`, "DELETE");

export const ambilRatingSaya = () =>
  minta<{ rating: RatingSaya[] }>("/api/saya/rating");

// ── Aspirasi ──────────────────────────────────────────────────────────────
export const ambilAspirasiSaya = () =>
  minta<{ aspirasi: Aspirasi[] }>("/api/aspirasi/saya");

export const kirimAspirasi = (
  kategori: KategoriAspirasi,
  judul: string,
  isi: string,
) => minta<{ aspirasi: Aspirasi }>("/api/aspirasi", "POST", { kategori, judul, isi });

export const ambilKotakMasuk = (status = "SEMUA") =>
  minta<{ aspirasi: Aspirasi[]; ringkas: RingkasAspirasi; kabupaten: string | null }>(
    `/api/aspirasi?status=${encodeURIComponent(status)}`,
  );

export const tanggapiAspirasi = (
  id: string,
  status: StatusAspirasi,
  tanggapan?: string,
) =>
  minta<{ aspirasi: Aspirasi }>(`/api/aspirasi/${id}/tanggapan`, "POST", {
    status,
    tanggapan: tanggapan || null,
  });

// ── Pengumuman ────────────────────────────────────────────────────────────
export const ambilPengumuman = () =>
  minta<{ pengumuman: Pengumuman[] }>("/api/pengumuman");

export const ambilPengumumanKelola = () =>
  minta<{ pengumuman: Pengumuman[] }>("/api/pengumuman/kelola");

export interface PengumumanBaru {
  jenis: JenisPengumuman;
  judul: string;
  isi: string;
  instansi?: string | null;
  kabupaten?: string | null;
  nilai_bantuan?: number | null;
  cara_daftar?: string | null;
  tenggat?: string | null;
}

export const terbitkanPengumuman = (isi: PengumumanBaru) =>
  minta<{ pengumuman: Pengumuman }>("/api/pengumuman", "POST", isi);

export const ubahPengumuman = (id: string, aktif: boolean) =>
  minta<{ pengumuman: Pengumuman }>(`/api/pengumuman/${id}`, "PATCH", { aktif });
