import type { DampakLokal, Itinerary } from "./types";

/** Kunci pilihan makan: satu slot per hari. */
export const slotKey = (day: number, slot: string) => `${day}-${slot}`;

/**
 * Selisih biaya makan terhadap opsi ke-0 yang dipakai solver, atas seluruh slot.
 *
 * Ditaruh di sini — bukan sebagai `useMemo` lokal di ItineraryBoard — karena
 * ADA DUA pembaca yang harus setuju: papan itinerary di layar dan ekspor PDF.
 * Sebelumnya hanya papan yang menghitungnya, sedangkan PDF memakai
 * `summary.total_estimasi` mentah dari server. Akibatnya begitu turis menukar
 * satu rumah makan, PDF mencetak biaya yang berbeda dari yang baru saja ia
 * lihat di layar — dan tidak ada di antara keduanya yang menandai selisihnya.
 */
export function hitungDeltaMakan(
  itinerary: Itinerary | null,
  pick: Record<string, number>,
): number {
  if (!itinerary) return 0;
  let d = 0;
  for (const day of itinerary.days) {
    for (const a of day.agenda) {
      if (a.kind !== "makan" || !a.options.length) continue;
      const sel = pick[slotKey(day.day, a.slot)] ?? 0;
      if (sel === 0) continue;
      d += (a.options[sel]?.price_group ?? 0) - (a.options[0]?.price_group ?? 0);
    }
  }
  return d;
}

/**
 * Biaya yang benar-benar ditampilkan, sesudah pilihan makan turis.
 *
 * Satu tempat menghitung keempat turunan biaya, supaya "Per Hari" dan
 * "per orang" tidak bisa lagi memakai penyebut yang berbeda tanpa disadari.
 * Perhatikan `per_orang_per_hari`: itu penyebut GABUNGAN (hari x orang), dan
 * itulah satu-satunya angka yang sah dipakai sebagai keterangan di bawah
 * sebuah nilai harian. `per_orang` adalah biaya satu orang untuk SELURUH
 * perjalanan — bukan per hari — dan mencampur keduanya membuat keterangannya
 * bisa lebih besar daripada nilai yang diterangkan.
 */
export function hitungBiaya(itinerary: Itinerary, pick: Record<string, number>) {
  const s = itinerary.summary;
  const delta = hitungDeltaMakan(itinerary, pick);
  const total = s.total_estimasi + delta;
  const hari = Math.max(s.n_days, 1);
  const orang = Math.max(s.n_orang, 1);

  return {
    delta,
    total,
    sisa: s.budget_total - total,
    persen: s.budget_total ? Math.round((total / s.budget_total) * 1000) / 10 : 0,
    lewat: s.budget_total - total < 0,
    /** Seluruh rombongan, satu hari. */
    per_hari: Math.round(total / hari),
    /** Satu orang, seluruh perjalanan. */
    per_orang: Math.round(total / orang),
    /** Satu orang, satu hari. */
    per_orang_per_hari: Math.round(total / (hari * orang)),
  };
}

/**
 * Hitung ulang dampak UMKM dari tempat makan yang benar-benar dipilih turis.
 *
 * Menyalin `analisis_dampak_lokal()` di engine memakai sinyal `umkm` yang ikut
 * dikirim tiap opsi, sehingga untuk pilihan bawaan hasilnya sama dengan server.
 */
export function hitungDampak(
  itinerary: Itinerary | null,
  pick: Record<string, number>,
): DampakLokal | undefined {
  const asli = itinerary?.dampak_lokal;
  if (!itinerary || !asli) return asli;

  // Tanpa penukaran, pakai angka server apa adanya.
  if (!Object.values(pick).some((v) => v > 0)) return asli;

  const terpilih: { nama: string; kuat: boolean; khas: string[]; harga: number }[] = [];

  for (const day of itinerary.days) {
    for (const a of day.agenda) {
      if (a.kind !== "makan" || !a.options.length) continue;
      const sel = pick[slotKey(day.day, a.slot)] ?? 0;
      const o = a.options[sel] ?? a.options[0];
      terpilih.push({
        nama: o.name,
        kuat: o.umkm?.kuat ?? false,
        khas: o.umkm?.kuliner_khas ?? [],
        harga: o.price_group ?? 0,
      });
    }
  }

  if (!terpilih.length) return asli;

  const total = terpilih.length;
  const kuat = terpilih.filter((x) => x.kuat);
  const namaUnik = new Set(terpilih.map((x) => x.nama));
  const khasUnik = new Set(terpilih.flatMap((x) => x.khas));

  return {
    ...asli,
    total_kunjungan_makan: total,
    usaha_unik_dikunjungi: namaUnik.size,
    umkm_lokal_otentik: kuat.length,
    proporsi_umkm: Math.round((kuat.length / total) * 1000) / 10,
    ragam_kuliner_khas: khasUnik.size,
    daftar_kuliner_khas: [...khasUnik].sort(),
    sebaran_merata: namaUnik.size / total,
    // price_group sudah dikali jumlah orang di backend, jadi tidak dikali lagi.
    estimasi_kasar_ke_usaha_lokal: kuat.reduce((n, x) => n + x.harga, 0),
  };
}
