import type { DampakLokal, Itinerary } from "./types";

/** Kunci pilihan makan: satu slot per hari. */
export const slotKey = (day: number, slot: string) => `${day}-${slot}`;

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
