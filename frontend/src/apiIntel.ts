/** Klien untuk endpoint /api/intel/*.
 *
 * Dipisah dari api.ts supaya berkas itu tidak membengkak dan konflik merge
 * saat dua fitur dikerjakan bersamaan tetap terbatas.
 */

import { kepalaAuth } from "./auth";
import type {
  HasilNarasi,
  HasilSimulasi,
  IntelGap,
  IntelLive,
  IntelRingkas,
  IntelTren,
  KabupatenAgregat,
  NarasiGap,
  NarasiInsight,
  NarasiSimulasi,
  OpsiSimulasi,
  SelisihHarga,
  SimulasiReq,
} from "./typesIntel";

const BASE = "/api";

/** Terjemahkan status HTTP jadi pesan yang bisa ditindaklanjuti pengguna. */
async function lemparGalat(r: Response): Promise<never> {
  let pesan = r.statusText;
  try {
    const isi = await r.json();
    if (typeof isi?.detail === "string") pesan = isi.detail;
  } catch {
    /* body bukan JSON — pakai statusText */
  }
  if (r.status === 401) {
    pesan = "Sesi Anda berakhir atau belum masuk. Silakan masuk kembali.";
  } else if (r.status === 403) {
    pesan = pesan || "Akun Anda tidak punya akses ke data ini.";
  }
  throw new Error(pesan);
}

async function ambil<T>(jalur: string): Promise<T> {
  const r = await fetch(`${BASE}${jalur}`, { headers: await kepalaAuth() });
  if (!r.ok) await lemparGalat(r);
  return r.json() as Promise<T>;
}

export const ambilIntelRingkas = () => ambil<IntelRingkas>("/intel/ringkas");
export const ambilIntelTren = () => ambil<IntelTren>("/intel/tren");
export const ambilIntelGap = () => ambil<IntelGap>("/intel/gap");
/** Seri kedua (log itinerary). Tidak pernah digabung dengan sinyal ulasan. */
export const ambilIntelLive = () => ambil<IntelLive>("/intel/live");
/**
 * Seri keempat: selisih estimasi dataset terhadap harga terlapor UMKM.
 *
 * `kabupaten` opsional — tanpa argumen, akun GOV otomatis dibatasi ke
 * wilayahnya sendiri oleh server; ADMIN mendapat nasional.
 */
export const ambilSelisihHarga = (kabupaten?: string) =>
  ambil<SelisihHarga>(
    kabupaten
      ? `/intel/selisih-harga?kabupaten=${encodeURIComponent(kabupaten)}`
      : "/intel/selisih-harga",
  );
export const ambilKabupaten = () =>
  ambil<{ kabupaten: KabupatenAgregat[]; urutan: string[]; peringatan_proksi: string }>(
    "/intel/kabupaten",
  );

/** Angka besar jadi ringkas: 2.595.069 -> "2,6 jt". Dipakai di sumbu grafik. */
export function ringkasAngka(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} rb`;
  return n.toLocaleString("id-ID");
}

/** Rupiah ringkas untuk sumbu grafik: 12450000 -> "Rp 12,5 jt". */
export function rupiahRingkas(n: number): string {
  return `Rp ${ringkasAngka(n)}`;
}

export const persen = (n: number, desimal = 1) =>
  `${(n * 100).toFixed(desimal).replace(".", ",")}%`;

/* ── Simulator (F4) ──────────────────────────────────────────────── */

export const ambilOpsiSimulasi = () => ambil<OpsiSimulasi>("/simulasi/opsi");

export async function jalankanSimulasi(req: SimulasiReq): Promise<HasilSimulasi> {
  const r = await fetch(`${BASE}/simulasi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await kepalaAuth()) },
    body: JSON.stringify(req),
  });
  if (!r.ok) await lemparGalat(r);
  return r.json() as Promise<HasilSimulasi>;
}

/** Rupiah penuh dengan pemisah ribuan Indonesia. */
export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

/* ── Narasi AI ───────────────────────────────────────────────────────
 * Semua endpoint di bawah selalu 200. Bila kunci OpenAI tidak dipasang,
 * balasannya `narasi: null` dengan status "AI nonaktif" — bukan galat, dan
 * halaman yang memanggilnya tetap menampilkan seluruh angkanya.
 */

async function kirim<T>(jalur: string, isi?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${jalur}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await kepalaAuth()) },
    body: isi === undefined ? undefined : JSON.stringify(isi),
  });
  if (!r.ok) await lemparGalat(r);
  return r.json() as Promise<T>;
}

export const ambilNarasiInsight = () =>
  kirim<HasilNarasi<NarasiInsight>>("/intel/insight");

export const ambilNarasiGap = () => kirim<HasilNarasi<NarasiGap>>("/intel/gap/narasi");

export const ambilNarasiSimulasi = (req: SimulasiReq) =>
  kirim<HasilNarasi<NarasiSimulasi> & { hasil: HasilSimulasi }>("/simulasi/narasi", req);
