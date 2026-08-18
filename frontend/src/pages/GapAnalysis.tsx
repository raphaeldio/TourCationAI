import { AlertTriangle, Info, Lightbulb, MapPin, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { useT } from "../i18n";
import KabupatenMap from "../components/KabupatenMap";
import NarasiAI from "../components/NarasiAI";
import Reveal from "../components/Reveal";
import { ambilIntelGap, ambilNarasiGap } from "../apiIntel";
import { SERI_CHART, TINTA_SUMBU } from "../palette";
import type { GapKabupaten, IntelGap, KunciSumbu } from "../typesIntel";

/** Warna prioritas: makin mendesak makin pekat. */
function nadaPrioritas(peringkat: number, total: number) {
  const rasio = peringkat / total;
  if (rasio <= 0.25) return "bg-rose-100 text-rose-700 border-rose-200";
  if (rasio <= 0.5) return "bg-brand-amber/20 text-brand-amber-ink border-brand-amber/30";
  if (rasio <= 0.75) return "bg-brand-sand/15 text-brand-sand-ink border-brand-sand/25";
  return "bg-brand-sage/15 text-brand-sage-ink border-brand-sage/25";
}

export default function GapAnalysis() {
  const t = useT();
  const [data, setData] = useState<IntelGap | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [dipilih, setDipilih] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambilIntelGap()
      .then((d) => {
        if (batal) return;
        setData(d);
        setDipilih(d.kabupaten[0]?.kabupaten ?? null);
      })
      .catch((e: Error) => !batal && setGalat(e.message));
    return () => {
      batal = true;
    };
  }, []);

  const aktif: GapKabupaten | null = useMemo(
    () => data?.kabupaten.find((k) => k.kabupaten === dipilih) ?? null,
    [data, dipilih],
  );

  const dataRadar = useMemo(() => {
    if (!aktif) return [];
    return (Object.keys(aktif.sumbu) as KunciSumbu[]).map((k) => ({
      sumbu: t(aktif.sumbu_label[k]),
      nilai: Number((aktif.sumbu[k] * 100).toFixed(1)),
    }));
  }, [aktif, t]);

  if (galat) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="flex items-center gap-2 font-display font-extrabold text-rose-800">
          <AlertTriangle className="h-5 w-5" aria-hidden /> {t("Gagal memuat data")}
        </p>
        <p className="mt-1 text-sm text-rose-700">{galat}</p>
      </div>
    );
  }

  if (!data || !aktif) {
    return (
      <div className="space-y-4">
        <div className="skel h-8 w-64 rounded-xl" />
        <div className="skel h-64 rounded-2xl" />
        <div className="skel h-72 rounded-2xl" />
      </div>
    );
  }

  const total = data.kabupaten.length;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {t("Analisis Kesenjangan")}
        </h1>
        <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
          {t("Prioritas pengembangan wilayah berdasarkan tujuh sumbu terukur")}
        </p>
      </div>

      {/* ── Peringkat prioritas: gulir mendatar di layar sempit ────── */}
      <div className="gulir-x -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 pb-1 sm:grid sm:grid-cols-2 xl:grid-cols-4">
          {data.kabupaten.map((k, i) => (
            <Reveal key={k.kabupaten} index={i} className="w-[240px] shrink-0 sm:w-auto">
              <button
                type="button"
                onClick={() => setDipilih(k.kabupaten)}
                className={`h-full w-full rounded-2xl border p-4 text-left transition-all ${
                  k.kabupaten === dipilih
                    ? "border-brand-sage-ink bg-white shadow-md ring-1 ring-brand-sage-ink"
                    : "border-ink/10 bg-white shadow-sm hover:border-ink/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${nadaPrioritas(
                      k.peringkat_prioritas,
                      total,
                    )}`}
                  >
                    {t("PRIORITAS")} #{k.peringkat_prioritas}
                  </span>
                  {k.catatan_data && (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-brand-amber-ink" aria-hidden />
                  )}
                </div>
                <p className="mt-2 truncate font-display text-base font-extrabold text-ink">
                  {k.kabupaten}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  {k.bukti.n_destinasi} {t("destinasi")} &middot; {k.bukti.n_umkm} UMKM
                </p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/5">
                  <div
                    className="h-full rounded-full bg-brand-sage-ink"
                    style={{ width: `${k.skor_prioritas * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {t("Skor prioritas")} {(k.skor_prioritas * 100).toFixed(0)}/100
                </p>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── Peta + radar ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Reveal>
          <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-1 font-display text-base font-extrabold text-ink sm:text-lg">
              {t("Sebaran Prioritas")}
            </h2>
            <p className="mb-3 text-xs text-ink-faint">
              {t("Ukuran titik mengikuti skor prioritas. Ketuk untuk memilih kabupaten.")}
            </p>
            <KabupatenMap
              data={data.kabupaten}
              dipilih={dipilih}
              onPilih={setDipilih}
            />
          </section>
        </Reveal>

        <Reveal index={1}>
          <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">
              {t("Profil Kesenjangan")} &mdash; {aktif.kabupaten}
            </h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              {t("Makin luas areanya, makin besar kesenjangannya")}
            </p>
            <div className="h-64 w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={dataRadar} outerRadius="72%">
                  <PolarGrid stroke="rgba(12,59,46,0.12)" />
                  <PolarAngleAxis
                    dataKey="sumbu"
                    tick={{ fontSize: 10, fill: TINTA_SUMBU }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: TINTA_SUMBU }}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="nilai"
                    stroke={SERI_CHART[0]}
                    fill={SERI_CHART[1]}
                    fillOpacity={0.45}
                    isAnimationActive={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(12,59,46,0.12)",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v}/100 ${t("kesenjangan")}`, ""]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </Reveal>
      </div>

      {/* ── Bukti + rekomendasi ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal>
          <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-display text-base font-extrabold text-ink sm:text-lg">
              {t("Bukti Angka")}
            </h2>
            <dl className="grid grid-cols-2 gap-3">
              {[
                { k: t("Destinasi terdata"), v: aktif.bukti.n_destinasi },
                { k: t("UMKM terdata"), v: aktif.bukti.n_umkm },
                { k: t("UMKM lokal-otentik"), v: aktif.bukti.n_umkm_kuat },
                { k: t("Sinyal ulasan 12 bln"), v: aktif.bukti.ulasan_12_bulan },
                {
                  k: t("Wisatawan 2024"),
                  v: aktif.bukti.wisatawan_2024?.toLocaleString("id-ID") ?? "-",
                  catatan: aktif.bukti.wisatawan_diimputasi ? t("imputasi") : undefined,
                },
                {
                  k: t("Fasilitas tercatat"),
                  v: `${aktif.bukti.fasilitas_ada.length}/9`,
                },
              ].map((b) => (
                <div key={b.k} className="rounded-xl bg-surface-2/70 p-3">
                  <dt className="text-[11px] font-semibold text-ink-faint">{b.k}</dt>
                  <dd className="mt-0.5 font-display text-lg font-extrabold tabular-nums text-ink">
                    {b.v}
                    {b.catatan && (
                      <span className="ml-1 align-middle text-[10px] font-bold text-brand-amber-ink">
                        ({b.catatan})
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            {aktif.bukti.mice_event.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold text-ink-faint">{t("Event tercatat")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {aktif.bukti.mice_event.map((e) => (
                    <span
                      key={e}
                      className="rounded-lg bg-brand-sand/15 px-2 py-1 text-[11px] font-semibold text-brand-sand-ink"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {aktif.catatan_data && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-amber/10 p-3 text-[11px] leading-relaxed text-ink-soft">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber-ink"
                  aria-hidden
                />
                <span>{t(aktif.catatan_data)}</span>
              </p>
            )}
          </section>
        </Reveal>

        <Reveal index={1}>
          <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-display text-base font-extrabold text-ink sm:text-lg">
              {t("Rekomendasi Pengembangan")}
            </h2>
            {aktif.rekomendasi.length === 0 ? (
              <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">
                {t("Tidak ada sumbu yang tertinggal signifikan di wilayah ini.")}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {aktif.rekomendasi.map((rk) => (
                  <li
                    key={rk.sumbu}
                    className="flex items-start gap-3 rounded-xl border border-ink/5 bg-surface-2/60 p-3"
                  >
                    <Lightbulb
                      className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber-ink"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-extrabold text-ink">{t(rk.sumbu)}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                        {t(rk.saran)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {aktif.atraksi_terdokumentasi.length > 0 && (
              <div className="mt-4 border-t border-ink/10 pt-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink-faint">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {t("ATRAKSI TERDOKUMENTASI")}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {aktif.atraksi_terdokumentasi.map((a) => (
                    <li key={a.nama} className="text-xs text-ink-soft">
                      <strong className="text-ink">{a.nama}</strong>
                      {a.harga_tiket && ` — ${a.harga_tiket}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </Reveal>
      </div>

      {/* ── Metodologi ─────────────────────────────────────────────── */}
      <Reveal>
        <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-2 flex items-center gap-2 font-display text-base font-extrabold text-ink">
            <TrendingUp className="h-4 w-4 text-brand-sage-ink" aria-hidden />
            {t("Metodologi")}
          </h2>
          <p className="text-xs leading-relaxed text-ink-soft sm:text-sm">{t(data.metodologi)}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(data.bobot).map(([k, v]) => (
              <span
                key={k}
                className="rounded-lg bg-ink/5 px-2 py-1 text-[11px] font-semibold text-ink-soft"
              >
                {t(data.kabupaten[0].sumbu_label[k as KunciSumbu])} {(v * 100).toFixed(0)}%
              </span>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-amber/10 p-3 text-[11px] leading-relaxed text-ink-soft">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber-ink" aria-hidden />
            <span>{t(data.ringkas.peringatan_proksi)}</span>
          </p>
        </section>
      </Reveal>

      <Reveal>
        <NarasiAI
          judul="Pembacaan AI atas Kesenjangan"
          sub="Urutan prioritas tetap mengikuti skor yang sudah dihitung"
          muat={ambilNarasiGap}
          otomatis
          bagian={[
            { kunci: "celah", label: "Celah utama" },
            { kunci: "prioritas", label: "Prioritas penanganan" },
            { kunci: "potensi_investasi", label: "Potensi investasi" },
            { kunci: "rekomendasi", label: "Rekomendasi" },
          ]}
        />
      </Reveal>
    </div>
  );
}
