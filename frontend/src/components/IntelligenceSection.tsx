import { ArrowRight, BarChart3, Landmark, Radar, Store, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

import Reveal from "./Reveal";
import { useT } from "../i18n";

const PINTU = [
  {
    ke: "/gov",
    ikon: Landmark,
    judul: "Dashboard Pemerintah",
    ringkas: "Statistik, tren, dan kesenjangan wilayah",
    poin: ["Destinasi & UMKM terdata per kabupaten", "Tren permintaan 12 bulan", "Prioritas pengembangan wilayah"],
  },
  {
    ke: "/umkm",
    ikon: Store,
    judul: "Dashboard UMKM",
    ringkas: "Performa usaha dan peluang pasar",
    poin: ["Posisi harga terhadap UMKM sejenis", "Sinyal permintaan wilayah", "Peluang berbasis data, bukan tebakan"],
  },
] as const;

/**
 * Pintu masuk ke lapisan intelijen.
 *
 * Ini bukan sekadar navigasi: inilah bagian yang menjelaskan bahwa data
 * perjalanan wisatawan berubah menjadi insight bagi UMKM dan pemerintah —
 * pembeda produk ini dari perencana itinerary biasa.
 *
 * Sengaja memakai <Link> biasa, bukan komponen dropdown: menu berbasis Radix
 * menambah ~32 KB gz ke halaman depan hanya untuk dua tautan.
 */
export default function IntelligenceSection() {
  const t = useT();

  return (
    <section id="intelligence" className="scroll-mt-24 py-14 sm:py-20">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-sage/15 px-3 py-1 text-xs font-bold text-brand-sage-ink">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            {t("Tourism Intelligence")}
          </span>
          <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
            {t("Dari rencana perjalanan menjadi")}{" "}
            <span className="gradient-text">{t("keputusan berbasis data")}</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
            {t(
              "Setiap itinerary yang tersusun menambah gambaran tentang ke mana wisatawan pergi dan apa yang mereka cari. Gambaran itu dikembalikan kepada UMKM dan pemerintah daerah sebagai insight yang bisa ditindaklanjuti.",
            )}
          </p>
        </div>
      </Reveal>

      <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2">
        {PINTU.map((p, i) => (
          <Reveal key={p.ke} index={i}>
            <Link
              to={p.ke}
              className="group flex h-full flex-col rounded-2xl border border-ink/10 bg-white p-5 no-underline shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-sage/40 hover:shadow-xl hover:shadow-brand-forest/10 sm:p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-sage-ink">
                <p.ikon className="h-5 w-5 text-on-sage-ink" aria-hidden />
              </span>

              <h3 className="mt-4 font-display text-lg font-extrabold text-ink">{t(p.judul)}</h3>
              <p className="mt-1 text-sm text-ink-faint">{t(p.ringkas)}</p>

              <ul className="mt-4 flex-1 space-y-2">
                {p.poin.map((poin) => (
                  <li key={poin} className="flex items-start gap-2 text-xs text-ink-soft sm:text-sm">
                    <TrendingUp
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-sage-ink"
                      aria-hidden
                    />
                    <span>{t(poin)}</span>
                  </li>
                ))}
              </ul>

              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-sage-ink">
                {t("Buka dashboard")}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden
                />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <p className="mx-auto mt-6 flex max-w-2xl items-start justify-center gap-2 rounded-xl bg-brand-amber/10 p-3 text-center text-[11px] leading-relaxed text-ink-soft sm:text-xs">
          <Radar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber-ink" aria-hidden />
          <span>
            {t(
              "Seluruh angka dihitung langsung dari dataset kawasan Danau Toba — tanpa data sintetis. Keterbatasan datanya ikut ditampilkan apa adanya di setiap dashboard.",
            )}
          </span>
        </p>
      </Reveal>
    </section>
  );
}
