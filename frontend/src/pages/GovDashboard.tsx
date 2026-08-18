import {
  AlertTriangle,
  Building2,
  Info,
  Landmark,
  MapPinned,
  MessageSquareText,
  Store,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useT } from "../i18n";
import NarasiAI from "../components/NarasiAI";
import Reveal from "../components/Reveal";
import StatTile from "../components/StatTile";
import {
  ambilIntelLive,
  ambilIntelRingkas,
  ambilIntelTren,
  ambilNarasiInsight,
  ringkasAngka,
  rupiah,
} from "../apiIntel";
import { KISI_CHART, SERI_CHART, TINTA_SUMBU } from "../palette";
import type { IntelLive, IntelRingkas, IntelTren, StatusTren } from "../typesIntel";

const WARNA_STATUS: Record<StatusTren, string> = {
  "NAIK CEPAT": "bg-brand-sage/15 text-brand-sage-ink",
  TURUN: "bg-rose-100 text-rose-700",
  STABIL: "bg-ink/5 text-ink-soft",
  "DATA TIPIS": "bg-ink/5 text-ink-faint",
  "BARU MUNCUL": "bg-brand-amber/20 text-brand-amber-ink",
  TERSENSOR: "bg-ink/5 text-ink-faint",
};

function LencanaStatus({ status }: { status: StatusTren }) {
  const t = useT();
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-lg px-2 py-0.5 text-[10px] font-bold ${WARNA_STATUS[status]}`}
    >
      {t(status)}
    </span>
  );
}

/** Kotak catatan metodologi. Angka tanpa keterangan asalnya mudah disalahbaca. */
function Catatan({ anak }: { anak: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-brand-amber/10 p-3 text-[11px] leading-relaxed text-ink-soft sm:text-xs">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber-ink" aria-hidden />
      <span>{anak}</span>
    </p>
  );
}

function Kartu({
  judul,
  sub,
  aksi,
  children,
  className = "",
}: {
  judul: string;
  sub?: string;
  aksi?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  // Judul dan subjudul diterjemahkan di sini supaya setiap pemanggil Kartu
  // ikut tercakup tanpa perlu membungkus t() satu per satu.
  const t = useT();
  return (
    <section
      className={`rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">{t(judul)}</h2>
          {sub && <p className="mt-0.5 text-xs text-ink-faint">{t(sub)}</p>}
        </div>
        {aksi}
      </div>
      {children}
    </section>
  );
}

export default function GovDashboard() {
  const t = useT();
  const [ringkas, setRingkas] = useState<IntelRingkas | null>(null);
  const [tren, setTren] = useState<IntelTren | null>(null);
  const [live, setLive] = useState<IntelLive | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [skalaTren, setSkalaTren] = useState<"nasional" | "kabupaten">("nasional");

  useEffect(() => {
    let batal = false;
    Promise.all([ambilIntelRingkas(), ambilIntelTren()])
      .then(([hasilRingkas, hasilTren]) => {
        if (batal) return;
        setRingkas(hasilRingkas);
        setTren(hasilTren);
      })
      .catch((e: Error) => !batal && setGalat(e.message));

    // Seri live diambil terpisah dan kegagalannya sengaja ditelan: dashboard
    // berbasis CSV harus tetap utuh walau database sedang tidak bisa dihubungi.
    ambilIntelLive()
      .then((l) => !batal && setLive(l))
      .catch(() => !batal && setLive(null));

    return () => {
      batal = true;
    };
  }, []);

  const dataKategori = useMemo(() => {
    if (!ringkas) return [];
    return Object.entries(ringkas.ringkas.sebaran_kategori)
      .map(([nama, nilai]) => ({ nama, nilai }))
      .sort((a, b) => b.nilai - a.nilai);
  }, [ringkas]);

  const dataTren = useMemo(() => {
    if (!tren) return [];
    return tren.seri_nasional.map((n, i) => ({
      bulan: tren.label_seri[i],
      ulasan: n,
    }));
  }, [tren]);

  const dataKabupaten = useMemo(() => {
    if (!tren) return [];
    return [...tren.per_kabupaten]
      .sort((a, b) => b.ulasan_12_bulan - a.ulasan_12_bulan)
      .map((k) => ({
        kabupaten: k.kabupaten.replace("Hasundutan", "H."),
        ulasan: k.ulasan_12_bulan,
      }));
  }, [tren]);

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

  if (!ringkas || !tren) {
    return (
      <div className="space-y-4">
        <div className="skel h-8 w-56 rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skel h-32 rounded-2xl" />
          ))}
        </div>
        <div className="skel h-72 rounded-2xl" />
      </div>
    );
  }

  const r = ringkas.ringkas;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Judul ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
            {t("Ikhtisar Pariwisata")}
          </h1>
          <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
            {t("Kawasan Danau Toba")} &middot; {r.total_kabupaten} {t("kabupaten")}
          </p>
        </div>
        <span className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink-soft">
          {t("Data per")} {r.dibangun}
        </span>
      </div>

      {/* ── KPI ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          ikon={MapPinned}
          label={t("Destinasi Terdata")}
          nilai={r.total_destinasi}
          nada="sage"
          keterangan={`${r.kabupaten_tanpa_destinasi.length} ${t("kabupaten belum terdata")}`}
        />
        <StatTile
          index={1}
          ikon={Store}
          label={t("UMKM Terdata")}
          nilai={r.total_umkm}
          nada="sand"
          keterangan={`${r.total_umkm_kuat} ${t("tergolong lokal-otentik")}`}
        />
        <StatTile
          index={2}
          ikon={MessageSquareText}
          label={t("Sinyal Ulasan 12 Bulan")}
          nilai={r.total_ulasan_12_bulan}
          nada="amber"
          keterangan={t("Proksi permintaan, bukan jumlah kunjungan")}
        />
        <StatTile
          index={3}
          ikon={Building2}
          label={t("Kabupaten Tanpa UMKM")}
          nilai={r.kabupaten_tanpa_umkm.length}
          nada="forest"
          keterangan={r.kabupaten_tanpa_umkm.join(", ") || "-"}
        />
      </div>

      {/* ── Tren + kategori ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Kartu
            judul="Sinyal Permintaan"
            sub="Volume ulasan 12 bulan terakhir"
            aksi={
              <div className="flex rounded-xl bg-ink/5 p-1">
                {(["nasional", "kabupaten"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSkalaTren(m)}
                    className={`sentuh rounded-lg px-3 text-xs font-bold capitalize transition-colors ${
                      skalaTren === m ? "bg-white text-ink shadow-sm" : "text-ink-faint"
                    }`}
                  >
                    {t(m)}
                  </button>
                ))}
              </div>
            }
          >
            <div className="h-56 w-full sm:h-64 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                {skalaTren === "nasional" ? (
                  <AreaChart data={dataTren} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTren" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SERI_CHART[1]} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={SERI_CHART[1]} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={KISI_CHART} vertical={false} />
                    <XAxis
                      dataKey="bulan"
                      tick={{ fontSize: 11, fill: TINTA_SUMBU }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: TINTA_SUMBU }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgba(12,59,46,0.12)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v.toLocaleString("id-ID")} ${t("ulasan")}`, t("Sinyal")]}
                    />
                    <Area
                      type="monotone"
                      dataKey="ulasan"
                      stroke={SERI_CHART[0]}
                      strokeWidth={2.5}
                      fill="url(#gradTren)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={dataKabupaten} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={KISI_CHART} vertical={false} />
                    <XAxis
                      dataKey="kabupaten"
                      tick={{ fontSize: 10, fill: TINTA_SUMBU }}
                      tickLine={false}
                      axisLine={false}
                      angle={-32}
                      textAnchor="end"
                      height={62}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: TINTA_SUMBU }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={ringkasAngka}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(12,59,46,0.04)" }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgba(12,59,46,0.12)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v.toLocaleString("id-ID")} ${t("ulasan")}`, t("Sinyal")]}
                    />
                    <Bar dataKey="ulasan" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {dataKabupaten.map((_, i) => (
                        <Cell key={i} fill={SERI_CHART[i % SERI_CHART.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            <div className="mt-3">
              <Catatan anak={t(tren.metodologi)} />
            </div>
          </Kartu>
        </Reveal>

        <Reveal index={1}>
          <Kartu judul="Sebaran Kategori" sub="Destinasi terdata menurut minat">
            <div className="h-52 w-full sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataKategori}
                    dataKey="nilai"
                    nameKey="nama"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {dataKategori.map((_, i) => (
                      <Cell key={i} fill={SERI_CHART[i % SERI_CHART.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(12,59,46,0.12)",
                      fontSize: 12,
                    }}
                    formatter={(v: number, n: string) => [`${v} ${t("destinasi")}`, t(n)]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={44}
                    iconType="circle"
                    iconSize={8}
                    formatter={(v: string) => (
                      <span style={{ fontSize: 11, color: TINTA_SUMBU }}>{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
              {t(
                "Dominasi Wisata Alam adalah temuan, bukan kebetulan — ia menjadi dasar rekomendasi diversifikasi pada analisis kesenjangan.",
              )}
            </p>
          </Kartu>
        </Reveal>
      </div>

      {/* ── Narasi AI ──────────────────────────────────────────────── */}
      <Reveal>
        <NarasiAI
          judul="Pembacaan AI"
          sub="Penjelasan naratif atas angka di halaman ini"
          muat={ambilNarasiInsight}
          otomatis
          bagian={[
            { kunci: "tren_muncul", label: "Tren yang muncul" },
            { kunci: "tumbuh_cepat", label: "Tumbuh tercepat" },
            { kunci: "menurun", label: "Perlu perhatian" },
            { kunci: "kategori_diminati", label: "Kategori diminati" },
            { kunci: "analisis_umkm", label: "Analisis UMKM" },
            { kunci: "rekomendasi_promosi", label: "Rekomendasi promosi" },
            { kunci: "rekomendasi_pembangunan", label: "Rekomendasi pembangunan" },
          ]}
        />
      </Reveal>

      {/* ── Seri kedua: perencanaan nyata ──────────────────────────── */}
      {live?.aktif && <KartuLive live={live} />}

      {/* ── Tren naik & turun ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal>
          <Kartu judul="Tumbuh Tercepat" sub="Dibanding paruh 6 bulan sebelumnya">
            <DaftarTren data={tren.tumbuh_cepat} naik />
          </Kartu>
        </Reveal>
        <Reveal index={1}>
          <Kartu judul="Menurun" sub="Perlu perhatian dinas pariwisata">
            <DaftarTren data={tren.menurun} naik={false} />
          </Kartu>
        </Reveal>
      </div>

      {/* ── Destinasi & UMKM populer ───────────────────────────────── */}
      <Reveal>
        <Kartu judul="Destinasi Paling Banyak Dibicarakan" sub="Peringkat menurut sinyal ulasan 12 bulan">
          <div className="gulir-x -mx-1">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wide text-ink-faint">
                  <th className="px-2 py-2 font-bold">{t("Destinasi")}</th>
                  <th className="px-2 py-2 font-bold">{t("Kabupaten")}</th>
                  <th className="px-2 py-2 font-bold">{t("Kategori")}</th>
                  <th className="px-2 py-2 text-right font-bold">{t("Rating")}</th>
                  <th className="px-2 py-2 text-right font-bold">{t("Sinyal")}</th>
                  <th className="px-2 py-2 text-right font-bold">{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {ringkas.destinasi_populer.map((d) => (
                  <tr key={d.nama} className="border-b border-ink/5 last:border-0">
                    <td className="max-w-[220px] truncate px-2 py-2.5 font-semibold text-ink">
                      {d.nama}
                    </td>
                    <td className="px-2 py-2.5 text-ink-soft">{d.kabupaten ?? "-"}</td>
                    <td className="px-2 py-2.5 text-ink-soft">{t(d.kategori)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-soft">
                      {d.rating?.toFixed(1) ?? "-"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-ink">
                      {d.ulasan_12_bulan.toLocaleString("id-ID")}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <LencanaStatus status={d.status_tren} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kartu>
      </Reveal>

      {/* ── Catatan kualitas data ──────────────────────────────────── */}
      <Reveal>
        <Kartu judul="Catatan Kualitas Data" sub="Keterbatasan yang perlu diketahui sebelum mengambil keputusan">
          <ul className="space-y-2 text-xs leading-relaxed text-ink-soft sm:text-sm">
            <li className="flex items-start gap-2">
              <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-brand-sand-ink" aria-hidden />
              <span>{t(r.peringatan_proksi)}</span>
            </li>
            <li className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-sand-ink" aria-hidden />
              <span>{t(r.cakupan_ulasan.catatan_sensor)}</span>
            </li>
            <li className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-sand-ink" aria-hidden />
              <span>
                {t("Cakupan pemetaan ulasan ke tempat")}:{" "}
                <strong className="text-ink">
                  {r.cakupan_ulasan.baris_terpetakan.toLocaleString("id-ID")} {t("dari")}{" "}
                  {r.cakupan_ulasan.baris_total.toLocaleString("id-ID")}
                </strong>{" "}
                {t("baris")} ({(r.cakupan_ulasan.rasio * 100).toFixed(1)}%).
              </span>
            </li>
            {r.catatan.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber-ink" aria-hidden />
                <span>{t(c)}</span>
              </li>
            ))}
          </ul>
        </Kartu>
      </Reveal>
    </div>
  );
}

/** Seri kedua: cacah perencanaan nyata dari log itinerary.
 *
 * Sengaja dipisah dari kartu "Sinyal Permintaan" dan tidak pernah berbagi
 * sumbu dengannya. Volume ulasan berskala ribuan dan berumur setahun; cacah
 * itinerary berskala puluhan dan berumur sejak fitur ini menyala. Satu sumbu
 * bersama akan meratakan seri kecil jadi garis nol dan menyesatkan pembacanya.
 */
function KartuLive({ live }: { live: Extract<IntelLive, { aktif: true }> }) {
  const t = useT();
  const seri = live.seri_harian.map((d) => ({
    hari: d.tanggal.slice(8, 10) + "/" + d.tanggal.slice(5, 7),
    itinerary: d.itinerary,
  }));
  const kabupaten = live.per_kabupaten.slice(0, 6);
  const puncak = Math.max(1, ...kabupaten.map((k) => k.itinerary));

  return (
    <Reveal>
      <Kartu
        judul="Perencanaan Nyata"
        sub={`${t("Itinerary yang benar-benar disusun")}, ${live.jendela_hari} ${t("hari terakhir")}`}
        aksi={
          <span
            className={`rounded-xl px-3 py-2 text-[11px] font-bold ${
              live.cukup_untuk_ranking
                ? "bg-brand-sage/15 text-brand-sage-ink"
                : "bg-brand-amber/20 text-brand-amber-ink"
            }`}
          >
            {live.cukup_untuk_ranking
              ? t("Cukup untuk diperingkat")
              : `${t("Perlu")} ${live.ambang_ranking} itinerary`}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: t("Total sepanjang waktu"), nilai: live.total_itinerary.toLocaleString("id-ID") },
            { label: `${t("Dalam")} ${live.jendela_hari} ${t("hari")}`, nilai: live.itinerary_jendela.toLocaleString("id-ID") },
            { label: t("Tak terpenuhi"), nilai: live.itinerary_gagal.toLocaleString("id-ID") },
            {
              label: t("Rerata estimasi biaya"),
              nilai: live.rerata_estimasi ? rupiah(live.rerata_estimasi) : "-",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
              <p className="text-[10px] uppercase tracking-wide text-ink-faint">{s.label}</p>
              <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-ink">
                {s.nilai}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 h-40 w-full sm:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={seri} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
              <CartesianGrid stroke={KISI_CHART} vertical={false} />
              <XAxis
                dataKey="hari"
                tick={{ fontSize: 10, fill: TINTA_SUMBU }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                tick={{ fontSize: 11, fill: TINTA_SUMBU }}
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(12,59,46,0.04)" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(12,59,46,0.12)",
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v} itinerary`, t("Disusun")]}
              />
              <Bar
                dataKey="itinerary"
                fill={SERI_CHART[3] ?? SERI_CHART[0]}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {kabupaten.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {kabupaten.map((k) => (
              <li key={k.kabupaten} className="flex items-center gap-3 text-xs">
                <span className="w-28 shrink-0 truncate text-ink-soft sm:w-40">{k.kabupaten}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/5">
                  <span
                    className="block h-full rounded-full bg-brand-sage"
                    style={{ width: `${(k.itinerary / puncak) * 100}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-ink-faint">
                  {k.itinerary} {t("rencana")}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <Catatan anak={t(live.catatan)} />
        </div>
      </Kartu>
    </Reveal>
  );
}

function DaftarTren({
  data,
  naik,
}: {
  data: IntelTren["tumbuh_cepat"];
  naik: boolean;
}) {
  const t = useT();
  if (!data.length) {
    return (
      <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">
        {t("Tidak ada destinasi yang memenuhi ambang bukti pada periode ini.")}
      </p>
    );
  }
  const Panah = naik ? TrendingUp : TrendingDown;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li
          key={d.nama}
          className="flex items-center gap-3 rounded-xl border border-ink/5 bg-surface-2/60 p-2.5"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              naik ? "bg-brand-sage/15" : "bg-rose-100"
            }`}
          >
            <Panah
              className={`h-4 w-4 ${naik ? "text-brand-sage-ink" : "text-rose-700"}`}
              aria-hidden
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{d.nama}</span>
            <span className="block truncate text-[11px] text-ink-faint">
              {d.kabupaten} &middot; {d.ulasan_6_sebelumnya} &rarr; {d.ulasan_6_terakhir}{" "}
              {t("ulasan")}
            </span>
          </span>
          <span
            className={`shrink-0 text-sm font-extrabold tabular-nums ${
              naik ? "text-brand-sage-ink" : "text-rose-700"
            }`}
          >
            {d.pertumbuhan >= 0 ? "+" : ""}
            {(d.pertumbuhan * 100).toFixed(0)}%
          </span>
        </li>
      ))}
    </ul>
  );
}
