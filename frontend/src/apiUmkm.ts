/** Klien untuk endpoint /api/umkm/* (Fitur 3). */

import { kepalaAuth } from "./auth";
import type { HasilNarasi, NarasiAdvisor } from "./typesIntel";
import type {
  AnalisisKompetitor,
  DashboardUmkm,
  JenisEkspor,
  PaketPublik,
  Produk,
  ProdukReq,
  RiwayatUmkm,
  StatusLangganan,
  Usaha,
} from "./typesUmkm";

const BASE = "/api/umkm";

/**
 * Galat yang membawa konteks paket langganan.
 *
 * 402 dan 429 dari gerbang langganan mengirim `detail` berbentuk OBJEK, bukan
 * string — memuat `upgrade_url` supaya antarmuka bisa menawarkan jalan keluar
 * alih-alih sekadar menampilkan pesan buntu. Membedakan 402 dari 403 hanya
 * berguna kalau informasinya benar-benar sampai ke komponen.
 */
export class GalatApi extends Error {
  status: number;
  upgradeUrl?: string;
  paketSekarang?: string;

  constructor(pesan: string, status: number, ekstra?: Record<string, unknown>) {
    super(pesan);
    this.name = "GalatApi";
    this.status = status;
    this.upgradeUrl = ekstra?.upgrade_url as string | undefined;
    this.paketSekarang = ekstra?.paket_sekarang as string | undefined;
  }
}

async function lemparGalat(r: Response): Promise<never> {
  let pesan = r.statusText;
  let ekstra: Record<string, unknown> | undefined;
  try {
    const isi = await r.json();
    if (typeof isi?.detail === "string") {
      pesan = isi.detail;
    } else if (isi?.detail && typeof isi.detail === "object") {
      ekstra = isi.detail as Record<string, unknown>;
      pesan = (ekstra.pesan as string) ?? pesan;
    }
  } catch {
    /* body bukan JSON — pakai statusText */
  }
  if (r.status === 401) pesan = "Sesi Anda berakhir. Silakan masuk kembali.";
  throw new GalatApi(pesan, r.status, ekstra);
}

async function kirim<T>(jalur: string, metode: string, isi?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${jalur}`, {
    method: metode,
    headers: { "Content-Type": "application/json", ...(await kepalaAuth()) },
    body: isi === undefined ? undefined : JSON.stringify(isi),
  });
  if (!r.ok) await lemparGalat(r);
  return r.json() as Promise<T>;
}

export async function ambilDashboardUmkm(): Promise<DashboardUmkm> {
  const r = await fetch(`${BASE}/saya`, { headers: await kepalaAuth() });
  if (!r.ok) await lemparGalat(r);
  return r.json() as Promise<DashboardUmkm>;
}

export const perbaruiUsaha = (isi: Partial<Usaha>) =>
  kirim<{ usaha: Usaha }>("/usaha", "PATCH", isi);

export const tambahProduk = (isi: ProdukReq) =>
  kirim<{ produk: Produk }>("/produk", "POST", isi);

export const ubahProduk = (id: string, isi: Partial<ProdukReq> & { aktif?: boolean }) =>
  kirim<{ produk: Produk }>(`/produk/${id}`, "PATCH", isi);

export const nonaktifkanProduk = (id: string) =>
  kirim<{ status: string }>(`/produk/${id}`, "DELETE");

/** Penasihat bisnis AI. Selalu 200; `narasi: null` bila kunci OpenAI absen. */
export const ambilAdvisor = () =>
  kirim<HasilNarasi<NarasiAdvisor>>("/advisor", "POST");

/** Status paket usaha pemanggil + katalog tier. */
export const ambilLangganan = () =>
  kirim<{ langganan: StatusLangganan; paket: PaketPublik[] }>("/langganan", "GET");

/** Katalog harga publik — tidak butuh login, dipakai halaman /bisnis. */
export async function ambilPaketPublik(): Promise<PaketPublik[]> {
  const r = await fetch("/api/paket");
  if (!r.ok) await lemparGalat(r);
  return ((await r.json()) as { paket: PaketPublik[] }).paket;
}

/* ── Analisis & riwayat ─────────────────────────────────────────────────── */

/** 402 dengan `upgrade_url` bila paketnya FREE — lihat GalatApi di atas. */
export const ambilKompetitor = () => kirim<AnalisisKompetitor>("/kompetitor", "GET");

/** Selalu 200; jendelanya yang memendek pada paket bawah. */
export const ambilRiwayat = () => kirim<RiwayatUmkm>("/riwayat", "GET");

/**
 * Unduh CSV (tier PRO).
 *
 * Lewat fetch + blob, bukan `<a href>` biasa: endpointnya butuh header
 * Authorization, dan tautan langsung tidak bisa membawanya. Object URL-nya
 * dilepas segera setelah unduhan dipicu supaya blob tidak menetap di memori.
 */
export async function unduhEksporCsv(jenis: JenisEkspor): Promise<string> {
  const r = await fetch(`${BASE}/ekspor/${jenis}`, { headers: await kepalaAuth() });
  if (!r.ok) await lemparGalat(r);

  const blob = await r.blob();
  // Nama dari server bila header-nya terbaca; kalau tidak, susun sendiri —
  // berkas bernama "download" di folder Unduhan tidak bisa dikenali lagi
  // seminggu kemudian.
  const disposisi = r.headers.get("Content-Disposition") ?? "";
  const cocok = /filename="([^"]+)"/.exec(disposisi);
  const nama = cocok?.[1] ?? `tourcation_${jenis}_${new Date().toISOString().slice(0, 10)}.csv`;

  const url = URL.createObjectURL(blob);
  const tautan = document.createElement("a");
  tautan.href = url;
  tautan.download = nama;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  URL.revokeObjectURL(url);
  return nama;
}

export const beriSuara = (id: string, vote: -1 | 0 | 1, komentar?: string) =>
  kirim<{ suara: { setuju: number; total: number } }>(`/produk/${id}/suara`, "POST", {
    vote,
    komentar: komentar ?? null,
  });
