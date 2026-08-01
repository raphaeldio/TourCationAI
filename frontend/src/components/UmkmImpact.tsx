import { motion } from "framer-motion";
import { Store, UtensilsCrossed, Users, TrendingUp } from "lucide-react";
import type { DampakLokal } from "../types";
import { rp } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { UmkmVector } from "../vectors";
import CountUp from "./CountUp";
import { useT } from "../i18n";

interface Props {
  dampak: DampakLokal | undefined;
}

const METRICS = [
  {
    key: "umkm",
    icon: Store,
    label: "Usaha Lokal Otentik",
    value: (d: DampakLokal) => d.umkm_lokal_otentik,
    suffix: (d: DampakLokal) => `/${d.total_kunjungan_makan}`,
    desc: (d: DampakLokal) => `${d.proporsi_umkm}% dari kunjungan makan`,
    gradient: "from-brand-sage/25 to-brand-amber/10",
  },
  {
    key: "kuliner",
    icon: UtensilsCrossed,
    label: "Ragam Kuliner Khas",
    value: (d: DampakLokal) => d.ragam_kuliner_khas,
    suffix: () => " jenis",
    desc: () => "Masakan khas Batak yang bisa dicicipi",
    gradient: "from-brand-sand/25 to-brand-forest/10",
  },
  {
    key: "unik",
    icon: Users,
    label: "Usaha Unik Dikunjungi",
    value: (d: DampakLokal) => d.usaha_unik_dikunjungi,
    suffix: () => "",
    desc: () => "Tempat berbeda sepanjang perjalanan",
    gradient: "from-brand-sage/25 to-brand-sand/10",
  },
] as const;

function SectionHeading({ t }: { t: (s: string) => string }) {
  return (
    <div className="mb-6 flex items-center gap-3.5">
      <UmkmVector className="h-11 w-11 shrink-0" />
      <div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-brand-sand-ink">
          {t("Dampak Ekonomi Lokal")}
        </p>
        <h2 className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold tracking-tight text-ink">
          {t("Dampak")} <span className="gradient-text">UMKM</span>
        </h2>
        <div className="gorga-rule mt-4 max-w-[220px]" aria-hidden />
      </div>
    </div>
  );
}

export default function UmkmImpact({ dampak }: Props) {
  const t = useT();
  const ready = dampak?.status === "ok";

  return (
    <section id="umkm" className="mt-12 scroll-mt-24">
      <SectionHeading t={t} />

      {!ready || !dampak ? (
        // Selalu terlihat walau rencana belum dibuat, supaya bagian ini tidak
        // seolah-olah "hilang" sebelum solver berjalan.
        <Card variant="glow" className="p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <UmkmVector className="h-16 w-16 shrink-0 opacity-70" />
            <div>
              <h3 className="font-display text-lg font-bold text-ink">
                {t("Belum ada rencana untuk diukur")}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
                Setiap kali AI menyusun perjalanan, kami menghitung seberapa besar rencanamu
                berpihak pada usaha kecil di sekitar Danau Toba — berapa warung lokal yang
                dikunjungi, berapa ragam kuliner khas Batak yang dicicipi, dan perkiraan dana yang
                mengalir ke usaha setempat. Susun rencanamu untuk melihat angkanya.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="grid gap-4 sm:grid-cols-3">
            {METRICS.map(({ key, icon: Icon, label, value, suffix, desc, gradient }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09 }}
              >
                <Card
                  variant="glow"
                  className={`spotlight h-full overflow-hidden bg-gradient-to-br ${gradient}`}
                  onMouseMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-ink/[0.07]">
                        <Icon className="h-4 w-4 text-brand-sand-ink" strokeWidth={2} />
                      </div>
                      <CardTitle className="text-sm font-semibold text-ink">{t(label)}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="font-display text-3xl font-bold text-ink">
                      <CountUp value={value(dampak)} />
                      <span className="text-xl text-ink-soft">{suffix(dampak)}</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">{desc(dampak)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Proporsi UMKM sebagai bar, lebih terbaca daripada angka saja */}
          <div className="mt-5 rounded-2xl border border-ink/10 bg-ink/[0.03] p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-ink-soft">{t("Porsi kunjungan ke usaha lokal")}</p>
              <p className="font-display text-xl font-bold text-ink">
                <CountUp value={dampak.proporsi_umkm} />%
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-sage via-brand-amber to-emerald-400"
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.min(dampak.proporsi_umkm, 100)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          {dampak.daftar_kuliner_khas.length > 0 && (
            <div className="mt-5">
              <p className="mb-2.5 text-xs font-semibold text-ink-soft">
                {t("Kuliner khas Batak dalam rencana ini")}
              </p>
              <div className="flex flex-wrap gap-2">
                {dampak.daftar_kuliner_khas.map((k, i) => (
                  <motion.div
                    key={k}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Badge variant="outline">{k}</Badge>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3.5">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-ink-soft">
              Estimasi kasar dana ke usaha lokal{" "}
              <span className="font-semibold text-emerald-700">
                {rp(dampak.estimasi_kasar_ke_usaha_lokal)}
              </span>{" "}
              — hasil perkalian estimasi harga × kunjungan, bukan dampak ekonomi terverifikasi.
            </p>
          </div>
        </motion.div>
      )}
    </section>
  );
}
