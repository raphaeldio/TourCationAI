import { motion } from "framer-motion";
import {
  Calculator,
  Route,
  Clock,
  Ship,
  Store,
  CircleAlert,
} from "lucide-react";
import type { DampakLokal, Itinerary } from "../types";
import { rp } from "../api";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import CountUp from "./CountUp";
import { useT } from "../i18n";

interface Props {
  itinerary: Itinerary | null;
  onTanya: (q: string) => void;
  /** Dampak UMKM yang sudah mengikuti pilihan makan turis. */
  dampak?: DampakLokal;
}

interface Modul {
  no: number;
  icon: typeof Calculator;
  nama: string;
  sub: string;
  /** Angka utama; string agar bisa memuat satuan. */
  nilai: string;
  detail: string[];
  tanya: string;
  ring: string;
}

/**
 * Section "Analisis AI" — memperlihatkan hasil kerja kelima modul di engine.py
 * dengan angka nyata dari rencana yang sedang tampil. Menggantikan kartu
 * "Coming soon" yang sebelumnya tidak terhubung ke apa pun.
 */
export default function AiAnalysis({ itinerary, onTanya, dampak }: Props) {
  const t = useT();
  const a = itinerary?.analisis;
  const dl = dampak ?? itinerary?.dampak_lokal;
  const s = itinerary?.summary;

  const moduls: Modul[] = a && s
    ? [
        {
          no: 1,
          icon: Calculator,
          nama: "Budget Solver",
          sub: "Integer Linear Programming",
          nilai: rp(s.total_estimasi),
          detail: [
            `Status solver: ${a.solver_status}`,
            `${a.n_wisata_terpilih} wisata & ${a.n_resto_terpilih} resto terpilih`,
            `Rentang biaya ${rp(a.total_min)} – ${rp(a.total_max)}`,
            a.hotel_gratis_pulang_hari
              ? "Trip pulang-hari — hotel tidak dibiayai"
              : `Hotel dihitung ${s.n_nights} malam`,
          ],
          tanya: "Kenapa solver memilih tempat-tempat ini dalam budget saya?",
          ring: "from-brand-sage/70 to-brand-amber/40",
        },
        {
          no: 2,
          icon: Route,
          nama: "Route Optimizer",
          sub: "Nearest-neighbour per hari",
          nilai: `${a.total_jarak_km} km`,
          detail: [
            a.osrm_aktif
              ? "Jarak dari rute jalan asli (OSRM)"
              : "OSRM tidak terjangkau — pakai garis lurus (haversine)",
            `Sumber jarak: ${a.sumber_jarak}`,
            `Urutan kunjungan dioptimalkan tiap hari`,
          ],
          tanya: "Bagaimana urutan kunjungan hariannya ditentukan?",
          ring: "from-brand-sand/70 to-brand-sage/40",
        },
        {
          no: 3,
          icon: Clock,
          nama: "Time-Aware Filter",
          sub: "Validasi jam operasional",
          nilai: `${a.n_agenda} agenda`,
          detail: [
            `Jendela harian ${a.jam_agenda}`,
            "Tempat tutup disaring sebelum dijadwalkan",
            "Slot makan disisipkan pagi, siang, malam",
          ],
          tanya: "Tempat mana yang buka paling pagi di rencana ini?",
          ring: "from-brand-forest/70 to-brand-sand/40",
        },
        {
          no: 4,
          icon: Ship,
          nama: "Ferry Detector",
          sub: "Penyeberangan Samosir",
          nilai:
            a.total_penyeberangan > 0
              ? `${a.total_penyeberangan} penyeberangan`
              : "Tanpa feri",
          detail:
            a.total_penyeberangan > 0
              ? [
                  "Rute melintasi danau — perlu naik feri",
                  "Ongkos & jam feri tampil di kartu peta",
                  "Waktu tempuh belum termasuk antre feri",
                ]
              : [
                  "Semua titik terhubung jalur darat",
                  "Tidak ada penyeberangan yang terdeteksi",
                ],
          tanya: "Apa yang perlu saya siapkan untuk menyeberang ke Samosir?",
          ring: "from-brand-amber/70 to-brand-sage/40",
        },
        {
          no: 5,
          icon: Store,
          nama: "UMKM Scorer",
          sub: "Keberpihakan usaha lokal",
          nilai: `${dl?.proporsi_umkm ?? 0}%`,
          detail: [
            `Profil: ${a.profil}`,
            a.profil_deskripsi,
            `Bobot UMKM di fungsi objektif: ${Math.round((a.umkm_weight ?? 0) * 100)}%`,
            `${dl?.umkm_lokal_otentik ?? 0} dari ${dl?.total_kunjungan_makan ?? 0} kunjungan makan ke usaha lokal`,
          ],
          tanya: "Bagaimana rencana ini mendukung UMKM lokal?",
          ring: "from-brand-sage/70 to-brand-sand/40",
        },
      ]
    : [];

  return (
    <section id="ai" className="mt-12 scroll-mt-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-brand-sand-ink">
          {t("Di balik layar")}
        </p>
        <h2 className="mt-2 font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold tracking-tight text-ink">
          {t("Analisis")} <span className="gradient-text">AI</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
          Rencanamu bukan hasil tebakan. Lima modul di engine bekerja berurutan — dari
          optimasi budget sampai skoring keberpihakan pada usaha lokal.
        </p>
      </div>

      {!moduls.length ? (
        <Card variant="glow" className="mt-8 p-8 text-center">
          <p className="text-sm leading-relaxed text-ink-soft">
            Susun rencana untuk melihat hasil kerja tiap modul — status solver, sumber jarak,
            penyeberangan feri, dan bobot UMKM yang dipakai.
          </p>
        </Card>
      ) : (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {moduls.map(({ no, icon: Icon, nama, sub, nilai, detail, tanya, ring }, i) => (
              <motion.div
                key={no}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className={`rounded-[22px] bg-gradient-to-br p-px ${ring}`}
              >
                <div className="grain relative flex h-full flex-col rounded-[21px] bg-white/95 p-5 backdrop-blur-xl">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-sage to-brand-sage/70 shadow-md shadow-brand-sage/25">
                      <Icon className="h-5 w-5 text-white" strokeWidth={1.8} />
                    </div>
                    <Badge variant="outline">{t("Modul")} {no}</Badge>
                  </div>

                  <h3 className="mt-4 font-display text-lg font-bold text-ink">{t(nama)}</h3>
                  <p className="text-[0.72rem] uppercase tracking-wider text-ink-faint">{sub}</p>

                  <p className="mt-3 font-display text-2xl font-bold text-ink">{nilai}</p>

                  <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                    {detail.filter(Boolean).map((d) => (
                      <li key={d} className="flex gap-2 text-[0.78rem] leading-snug text-ink-soft">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-amber" />
                        {d}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => onTanya(tanya)}
                    className="mt-4 rounded-xl border border-ink/10 bg-ink/[0.04] px-3 py-2 text-left text-[0.74rem] font-medium text-ink-soft transition hover:border-brand-sage/40 hover:text-ink"
                  >
                    {t("Tanya AI")}: “{tanya}”
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {!a?.osrm_aktif && (
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-3.5">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-ink-soft">
                Server rute OSRM tidak terjangkau saat rencana ini dibuat, jadi jarak dihitung
                sebagai garis lurus antar titik. Jarak jalan sebenarnya biasanya lebih panjang.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-ink/10 bg-ink/[0.03] px-4 py-3.5">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
            <p className="text-xs leading-relaxed text-ink-faint">
              Semua angka di atas berasal dari dataset aplikasi dan hasil perhitungan solver —
              bukan tarif resmi. Harga, jam buka, dan jadwal feri sebaiknya diverifikasi ulang
              sebelum berangkat.
            </p>
          </div>

          {/* Statistik ringkas di bawah kartu */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: t("Wisata terpilih"), v: a!.n_wisata_terpilih },
              { k: t("Resto terpilih"), v: a!.n_resto_terpilih },
              { k: t("Total agenda"), v: a!.n_agenda },
              { k: t("Ragam kuliner khas"), v: dl?.ragam_kuliner_khas ?? 0 },
            ].map(({ k, v }) => (
              <div
                key={k}
                className="rounded-2xl border border-ink/10 bg-ink/[0.04] p-3.5 text-center"
              >
                <p className="font-display text-2xl font-bold text-ink">
                  <CountUp value={v} />
                </p>
                <p className="mt-0.5 text-[0.66rem] uppercase tracking-wider text-ink-faint">{k}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
