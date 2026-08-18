/** Klien untuk tindakan dinas: verifikasi usaha dan kotak masuk pemberitahuan.
 *
 * Dipisah dari `apiIntel.ts` mengikuti pemisahan yang sama di sisi server:
 * `/api/intel/*` hanya membaca angka, `/api/gov/*` menulis dan yang ditulisnya
 * menyangkut akun orang lain.
 */

import { kepalaAuth } from "./auth";
import type { DaftarVerifikasi, KotakMasukGov, UsahaVerifikasi } from "./typesGov";

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

export const ambilDaftarVerifikasi = (hanyaBelum = false) =>
  minta<DaftarVerifikasi>(`/api/gov/verifikasi?hanya_belum=${hanyaBelum}`);

/**
 * Tandai atau cabut verifikasi. `catatan` sangat dianjurkan saat mencabut —
 * pemilik usaha berhak tahu dasarnya, dan kolom audit tanpa alasan tidak bisa
 * dipertanggungjawabkan ketika ada sengketa.
 */
export const putuskanVerifikasi = (
  businessId: string,
  setuju: boolean,
  catatan?: string,
) =>
  minta<{ usaha: UsahaVerifikasi; verified: boolean }>(
    `/api/gov/verifikasi/${businessId}`,
    "POST",
    { setuju, catatan: catatan?.trim() || null },
  );

export const ambilKotakMasukGov = (batas = 50) =>
  minta<KotakMasukGov>(`/api/gov/notifikasi?batas=${batas}`);
