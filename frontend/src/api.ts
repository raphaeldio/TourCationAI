import { kepalaAuth } from "./auth";
import type {
  Bahasa, Itinerary, MinatOption, PlanForm, ProfilOption,
  GayaJelajahOption,
} from "./types";

// Di dev, Vite mem-proxy /api -> http://localhost:8000.
const BASE = "/api";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* biarkan detail apa adanya */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function fetchMeta(): Promise<{
  minat: MinatOption[];
  profil: ProfilOption[];
  gaya_jelajah: GayaJelajahOption[];
}> {
  return jsonOrThrow(await fetch(`${BASE}/meta`));
}

/** Malam = hari − 1 otomatis; 0 bila penginapan tidak diikutkan. */
export function hitungMalam(form: PlanForm): number {
  if (!form.include_penginapan) return 0;
  return Math.max(form.n_days - 1, 0);
}

export async function planItinerary(form: PlanForm): Promise<Itinerary> {
  const body = {
    budget_total: form.budget_total,
    n_days: form.n_days,
    n_nights: hitungMalam(form),
    n_orang: form.n_orang,
    minat_wisata: form.minat_wisata.length ? form.minat_wisata : null,
    max_attractions_per_day: form.max_attractions_per_day,
    profil_pilihan: form.profil_pilihan,
    use_osrm: true,
    // Hanya relevan saat turis tidak menginap.
    origin_lat: !form.include_penginapan && form.origin ? form.origin.lat : null,
    origin_lon: !form.include_penginapan && form.origin ? form.origin.lon : null,
    moda: form.moda,
    // Mengaktifkan penghindaran destinasi yang libur mingguan.
    tanggal_mulai: form.tanggal_mulai || null,
    gaya_jelajah: form.gaya_jelajah,
    hotel_pilihan: form.include_penginapan ? form.hotel_pilihan : null,
  };
  // Header auth dikirim meski endpoint ini PUBLIK dan tetap melayani permintaan
  // anonim. Tanpa header, `pengguna_opsional` di server selalu None dan
  // `itinerary_log.user_id` selalu NULL — akibatnya perjalanan tidak punya
  // pemilik, tidak bisa disimpan, dan tidak bisa diulas. Itu keadaan yang
  // sempat terjadi: 12 dari 12 baris pertama tercatat anonim padahal
  // penggunanya sudah masuk.
  return jsonOrThrow(
    await fetch(`${BASE}/itinerary`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await kepalaAuth()) },
      body: JSON.stringify(body),
    }),
  );
}

/** Itinerary boleh null; `picks` dikirim agar biaya makan ikut pilihan turis. */
export async function askAI(
  question: string,
  itinerary: Itinerary | null,
  picks?: Record<string, number>,
): Promise<string> {
  const res = await jsonOrThrow<{ answer: string }>(
    await fetch(`${BASE}/ai-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, itinerary, picks: picks ?? {} }),
    }),
  );
  return res.answer;
}

export async function fetchLanguages(): Promise<Bahasa[]> {
  const r = await jsonOrThrow<{ languages: Bahasa[] }>(await fetch(`${BASE}/languages`));
  return r.languages;
}

/** Terjemahan lewat model OpenAI yang sama dengan asisten perjalanan. */
export async function translateText(
  text: string,
  source: string,
  target: string,
): Promise<string> {
  const r = await jsonOrThrow<{ translatedText: string }>(
    await fetch(`${BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source, target }),
    }),
  );
  return r.translatedText;
}

/**
 * Ukuran satu permintaan terjemahan antarmuka.
 *
 * Kamusnya kini melewati 500 entri setelah empat dashboard masuk, sedangkan
 * satu balasan model dibatasi max_tokens. Meminta semuanya sekaligus membuat
 * JSON-nya terpotong di tengah — dan potongannya tidak menimbulkan galat,
 * hanya string yang diam-diam tidak pernah diterjemahkan.
 *
 * Angkanya diukur, bukan ditebak. Keluaran model memuat kunci (disalin persis)
 * DAN terjemahannya, jadi ~2,2x karakter masukan:
 *
 *     batch 300 -> ~4.850 token keluaran  (melewati plafon, terpotong)
 *     batch 150 -> ~2.450 token keluaran  (aman)
 *
 * 150 dipilih agar tetap aman ketika kamus bertambah lagi. Plafon di sisi
 * server juga dinaikkan supaya bukan dia yang jadi pengikat lebih dulu.
 */
const UKURAN_BATCH = 150;

async function kirimBatch(
  strings: string[],
  target: string,
): Promise<Record<string, string>> {
  const r = await jsonOrThrow<{ map: Record<string, string> }>(
    await fetch(`${BASE}/translate-ui`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strings, target }),
    }),
  );
  return r.map;
}

/** Terjemahkan label antarmuka; hanya teks statis yang dikirim ke model. */
export async function translateUI(
  strings: string[],
  target: string,
): Promise<Record<string, string>> {
  const unik = [...new Set(strings.map((s) => s.trim()).filter(Boolean))];
  if (!unik.length) return {};

  const potongan: string[][] = [];
  for (let i = 0; i < unik.length; i += UKURAN_BATCH) {
    potongan.push(unik.slice(i, i + UKURAN_BATCH));
  }

  // allSettled, bukan all: satu batch gagal (rate limit, timeout) sebaiknya
  // menyisakan bagian yang berhasil — string yang tak punya terjemahan jatuh
  // ke teks Indonesia aslinya, jauh lebih baik daripada seluruh antarmuka
  // kembali ke bahasa dasar.
  const hasil = await Promise.allSettled(potongan.map((p) => kirimBatch(p, target)));

  const gabungan: Record<string, string> = {};
  let sukses = 0;
  for (const h of hasil) {
    if (h.status === "fulfilled") {
      Object.assign(gabungan, h.value);
      sukses += 1;
    }
  }

  // Semua batch gagal berarti gangguan sungguhan — lempar supaya banner galat
  // di I18nProvider tetap muncul alih-alih diam dengan kamus kosong.
  if (!sukses) {
    const pertama = hasil.find((h) => h.status === "rejected");
    throw pertama && pertama.status === "rejected"
      ? (pertama.reason as Error)
      : new Error("Gagal memuat terjemahan.");
  }
  return gabungan;
}

export function rp(n: number | null | undefined): string {
  if (n == null) return "—";
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}
