/** Klien untuk perjalanan, ulasan pasca-perjalanan, dan laporan lapangan. */

import { kepalaAuth } from "./auth";
import type {
  AgregatLapangan,
  DetailUlasan,
  HasilUlasan,
  KategoriMeta,
  Laporan,
  Perjalanan,
  PerjalananTersimpan,
  StatusLaporan,
  UlasanBaru,
  UlasanPerjalanan,
  UmpanBalikUmkm,
} from "./typesPerjalanan";

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

// ── Sisi wisatawan ─────────────────────────────────────────────────────────
export const ambilPerjalananSaya = () =>
  minta<{ perjalanan: Perjalanan[] }>("/api/saya/perjalanan");

/** PUT, bukan POST — satu itinerary satu simpanan, jadi operasinya idempoten. */
export const simpanPerjalanan = (
  itineraryId: string,
  payload: unknown,
  judul?: string,
) =>
  minta<{ aksi: string; itinerary_id: string; judul: string }>(
    `/api/perjalanan/${itineraryId}/simpan`,
    "PUT",
    { payload, judul: judul || null },
  );

export const bukaPerjalanan = (itineraryId: string) =>
  minta<PerjalananTersimpan>(`/api/perjalanan/${itineraryId}`);

export const hapusSimpanan = (itineraryId: string) =>
  minta<{ status: string }>(`/api/perjalanan/${itineraryId}/simpan`, "DELETE");

export const ambilUlasanSaya = () =>
  minta<{ ulasan: UlasanPerjalanan[] }>("/api/saya/ulasan-perjalanan");

export const ambilDetailUlasan = (itineraryId: string) =>
  minta<DetailUlasan>(`/api/perjalanan/${itineraryId}/ulasan`);

/** 409 bila perjalanan sudah pernah diulas — ulasan tidak bisa ditulis ulang. */
export const kirimUlasan = (itineraryId: string, isi: UlasanBaru) =>
  minta<HasilUlasan>(`/api/perjalanan/${itineraryId}/ulasan`, "POST", isi);

// ── Sisi pemerintah ────────────────────────────────────────────────────────
export const ambilAgregatLapangan = (hari = 180) =>
  minta<AgregatLapangan>(`/api/intel/lapangan?hari=${hari}`);

export const ambilLaporanMasuk = (status = "SEMUA", kategori = "SEMUA") =>
  minta<{
    laporan: Laporan[];
    kabupaten: string | null;
    kategori: KategoriMeta[];
    status_tersedia: StatusLaporan[];
  }>(
    `/api/laporan?status=${encodeURIComponent(status)}&kategori=${encodeURIComponent(kategori)}`,
  );

export const tanggapiLaporan = (
  id: string,
  status: StatusLaporan,
  tanggapan?: string,
) =>
  minta<{ laporan: Laporan }>(`/api/laporan/${id}/tanggapan`, "POST", {
    status,
    tanggapan: tanggapan || null,
  });

// ── Sisi UMKM ──────────────────────────────────────────────────────────────
export const ambilUmpanBalikUmkm = () =>
  minta<UmpanBalikUmkm>("/api/umkm/umpan-balik");
