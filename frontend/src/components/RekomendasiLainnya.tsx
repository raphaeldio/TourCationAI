import { ChevronDown, HeartHandshake, Info, MapPin, Snowflake, Star } from "lucide-react";
import { useState } from "react";

import { simpanRating } from "../apiKomunitas";
import { useAuth } from "../auth";
import Bintang from "./Bintang";
import { useT } from "../i18n";
import Reveal from "./Reveal";
import SuaraHarga from "./SuaraHarga";
import type { RekomendasiLainnya as Blok } from "../typesKomunitas";

/**
 * Blok "Rekomendasi Lainnya" di bawah papan itinerary.
 *
 * Komponen TERPISAH, dirender sebagai saudara `ItineraryBoard`, bukan di
 * dalamnya. Dua alasan: `ItineraryBoard` (861 baris) sengaja tidak disentuh,
 * dan pemisahan ini mencerminkan pemisahan yang sama di backend — blok ini
 * ditempel setelah payload final dan tidak memengaruhi satu angka pun pada
 * rencana di atasnya.
 *
 * Pelabelannya sengaja terus terang. Menyamarkan usaha berskor rendah sebagai
 * rekomendasi utama akan merusak kepercayaan pada seluruh rekomendasi; menyebut
 * apa adanya justru membuat pemerataannya bisa diterima.
 */
export default function RekomendasiLainnya({ blok }: { blok?: Blok | null }) {
  const t = useT();
  const { sesi } = useAuth();
  const [nilai, setNilai] = useState<Record<string, number>>({});
  const [pesan, setPesan] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState<Record<string, boolean>>({});

  if (!blok || !blok.item?.length) return null;

  async function beri(businessId: string, n: number) {
    setNilai((v) => ({ ...v, [businessId]: n }));
    try {
      await simpanRating(businessId, n);
      setPesan((p) => ({ ...p, [businessId]: t("Penilaian tersimpan. Terima kasih!") }));
    } catch (e) {
      setPesan((p) => ({ ...p, [businessId]: (e as Error).message }));
    }
  }

  return (
    <Reveal>
      <section className="mt-5 rounded-2xl border border-brand-sand/30 bg-brand-sand/[0.06] p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
          <HeartHandshake className="h-5 w-5 text-brand-sand-ink" aria-hidden />
          {t("Rekomendasi Lainnya")}
        </h2>
        <p className="mt-1 flex items-start gap-2 text-[11px] leading-relaxed text-ink-soft sm:text-xs">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-sand-ink" aria-hidden />
          <span>{t(blok.keterangan)}</span>
        </p>

        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {blok.item.map((u) => (
            <li
              key={u.business_id}
              className="rounded-xl border border-ink/10 bg-white p-3.5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 font-display text-sm font-extrabold text-ink">
                  {u.nama}
                </p>
                {/* Selama dibekukan, label kepercayaan TIDAK ditampilkan:
                    pada usaha yang cuma belum dikenal, label itu menghukum
                    ketiadaan data dan meniadakan guna slot ini. */}
                <span
                  className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                    u.rating_dibekukan
                      ? "bg-ink/5 text-ink-faint"
                      : "bg-brand-sand/20 text-brand-sand-ink"
                  }`}
                >
                  {u.rating_dibekukan ? t("Rating dibekukan") : t(u.label_kepercayaan)}
                </span>
              </div>

              {u.kabupaten && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {u.kabupaten}
                  {u.jam_buka ? ` · ${u.jam_buka}` : ""}
                </p>
              )}

              {u.deskripsi && (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{u.deskripsi}</p>
              )}

              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
                {u.rating_dibekukan ? (
                  <>
                    <Snowflake className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    {u.catatan_rating ? t(u.catatan_rating) : t("Rating sedang dibekukan.")}
                  </>
                ) : (
                  <>
                    <Star className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    {u.n_rating === 0
                      ? t("Belum ada penilaian")
                      : `${u.rata_rating?.toFixed(1)} · ${u.n_rating} ${t("penilaian")}`}
                  </>
                )}
              </p>

              <p className="mt-2 rounded-lg bg-ink/[0.03] p-2 text-[11px] leading-relaxed text-ink-faint">
                {t(u.alasan_tampil)}
              </p>

              {/* Rating: satu akun satu penilaian, bisa diubah kapan saja. */}
              <div className="mt-2.5 border-t border-ink/5 pt-2.5">
                {sesi ? (
                  <>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                      {t("Beri penilaian")}
                    </p>
                    <Bintang
                      nilai={nilai[u.business_id] ?? 0}
                      onPilih={(n) => void beri(u.business_id, n)}
                      ukuran="md"
                    />
                    {pesan[u.business_id] && (
                      <p className="mt-1 text-[11px] text-ink-soft">{pesan[u.business_id]}</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] leading-relaxed text-ink-faint">
                    {t("Masuk untuk memberi penilaian — satu akun satu penilaian per usaha.")}
                  </p>
                )}
              </div>

              {/* Menu & penilaian harga: dimuat hanya saat dibuka. */}
              <div className="mt-2 border-t border-ink/5 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setMenu((m) => ({ ...m, [u.business_id]: !m[u.business_id] }))
                  }
                  aria-expanded={!!menu[u.business_id]}
                  className="sentuh flex w-full items-center justify-between gap-2 text-[11px] font-bold text-ink-soft hover:text-ink"
                >
                  {t("Menu & kewajaran harga")}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      menu[u.business_id] ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  />
                </button>
                {menu[u.business_id] && <SuaraHarga businessId={u.business_id} />}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Reveal>
  );
}
