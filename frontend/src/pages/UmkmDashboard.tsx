import {
  AlertTriangle,
  Award,
  Info,
  MapPin,
  MessageSquareText,
  Star,
  Store,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useT } from "../i18n";
import PintasanFitur from "../components/PintasanFitur";
import Reveal from "../components/Reveal";
import StatTile from "../components/StatTile";
import { ambilIntelRingkas, ambilKabupaten, ringkasAngka } from "../apiIntel";
import { KISI_CHART, SERI_CHART, TINTA_SUMBU } from "../palette";
import type { IntelRingkas, KabupatenAgregat } from "../typesIntel";

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

export default function UmkmDashboard() {
  const t = useT();
  const [ringkas, setRingkas] = useState<IntelRingkas | null>(null);
  const [kabupaten, setKabupaten] = useState<KabupatenAgregat[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [wilayah, setWilayah] = useState<string>("Toba");

  useEffect(() => {
    let batal = false;
    Promise.all([ambilIntelRingkas(), ambilKabupaten()])
      .then(([hasilRingkas, hasilKab]) => {
        if (batal) return;
        setRingkas(hasilRingkas);
        setKabupaten(hasilKab.kabupaten);
      })
      .catch((e: Error) => !batal && setGalat(e.message));
    return () => {
      batal = true;
    };
  }, []);

  const wil = useMemo(
    () => kabupaten?.find((k) => k.kabupaten === wilayah) ?? null,
    [kabupaten, wilayah],
  );

  /** Sinyal permintaan bulanan wilayah, dibalik agar terbaca kiri ke kanan. */
  const dataBulanan = useMemo(() => {
    if (!wil) return [];
    return [...wil.ulasan_bulanan]
      .reverse()
      .map((n, i) => ({ bulan: `B-${11 - i}`, sinyal: n }));
  }, [wil]);

  const umkmWilayah = useMemo(() => {
    if (!ringkas) return [];
    return ringkas.umkm_populer.filter((u) => !wilayah || u.kabupaten === wilayah).slice(0, 5);
  }, [ringkas, wilayah]);

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

  if (!ringkas || !kabupaten || !wil) {
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

  const pita = wil.pita_harga;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Sapaan + pemilih wilayah ───────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
            {t("Performa Usaha Anda")}
          </h1>
          <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
            {t("Posisi usaha dalam ekosistem wisata")} {wil.kabupaten}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2">
          <MapPin className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
          <span className="sr-only">{t("Pilih kabupaten")}</span>
          <select
            value={wilayah}
            onChange={(e) => setWilayah(e.target.value)}
            className="sentuh bg-transparent text-xs font-bold text-ink outline-none sm:text-sm"
          >
            {kabupaten.map((k) => (
              <option key={k.kabupaten} value={k.kabupaten}>
                {k.kabupaten}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Peta isi dashboard ─────────────────────────────────────── */}
      <PintasanFitur />

      {/* ── KPI ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          ikon={Store}
          label={t("UMKM di Wilayah Ini")}
          nilai={wil.n_umkm}
          nada="sage"
          keterangan={`${wil.n_umkm_kuat} ${t("tergolong lokal-otentik")}`}
        />
        <StatTile
          index={1}
          ikon={MapPin}
          label={t("Destinasi Pendukung")}
          nilai={wil.n_destinasi}
          nada="sand"
          keterangan={t("Sumber lalu lintas wisatawan")}
        />
        <StatTile
          index={2}
          ikon={MessageSquareText}
          label={t("Sinyal Permintaan")}
          nilai={wil.ulasan_12_bulan}
          nada="amber"
          delta={wil.status_tren === "DATA TIPIS" ? null : wil.pertumbuhan}
          keterangan={`${t("Status")}: ${t(wil.status_tren)}`}
        />
        <StatTile
          index={3}
          ikon={Users}
          label={t("Wisatawan 2024")}
          nilai={wil.wisatawan_2024 ?? 0}
          format={ringkasAngka}
          nada="forest"
          keterangan={
            wil.wisatawan_diimputasi
              ? t("Angka imputasi — tidak ada di dataset")
              : t("Kunjungan nusantara, data resmi")
          }
        />
      </div>

      {/* ── Grafik + posisi harga ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          <Kartu
            judul="Sinyal Permintaan Wilayah"
            sub="Volume ulasan 12 bulan terakhir di kabupaten Anda"
          >
            <div className="h-56 w-full sm:h-64 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataBulanan} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={KISI_CHART} vertical={false} />
                  <XAxis
                    dataKey="bulan"
                    tick={{ fontSize: 10, fill: TINTA_SUMBU }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: TINTA_SUMBU }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(12,59,46,0.04)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(12,59,46,0.12)",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v} ${t("ulasan")}`, t("Sinyal")]}
                  />
                  <Bar dataKey="sinyal" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {dataBulanan.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i >= dataBulanan.length - 6 ? SERI_CHART[0] : SERI_CHART[5]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-amber/10 p-3 text-[11px] leading-relaxed text-ink-soft sm:text-xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber-ink" aria-hidden />
              <span>
                {t(
                  "Batang gelap adalah 6 bulan terakhir. Ini proksi permintaan dari volume ulasan, bukan jumlah kunjungan atau transaksi.",
                )}
              </span>
            </p>
          </Kartu>
        </Reveal>

        <Reveal index={1}>
          <Kartu judul="Posisi Harga" sub={`${t("Pembanding")} ${pita.n} ${t("UMKM sekabupaten")}`}>
            {pita.p50 == null ? (
              <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs leading-relaxed text-ink-faint">
                {t("Sampel di wilayah ini hanya")} {pita.n}{" "}
                {t(
                  "UMKM. Persentil harga sengaja tidak ditampilkan — pada sampel sekecil itu angkanya lebih menyesatkan daripada membantu.",
                )}
              </p>
            ) : (
              <div className="space-y-3">
                {[
                  { label: t("Termurah (p25)"), nilai: pita.p25!, warna: SERI_CHART[1] },
                  { label: t("Tengah (p50)"), nilai: pita.p50, warna: SERI_CHART[0] },
                  { label: t("Termahal (p75)"), nilai: pita.p75!, warna: SERI_CHART[2] },
                ].map((b) => (
                  <div key={b.label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-ink-soft">{b.label}</span>
                      <span className="text-sm font-extrabold tabular-nums text-ink">
                        Rp {b.nilai.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (b.nilai / pita.p75!) * 100)}%`,
                          background: b.warna,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-[11px] leading-relaxed text-ink-faint">
                  {t(
                    "Harga di luar rentang wajar akan ditandai dan tidak langsung memengaruhi sistem rekomendasi.",
                  )}
                </p>
              </div>
            )}
          </Kartu>
        </Reveal>
      </div>

      {/* ── UMKM teratas + peluang ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal>
          <Kartu
            judul="UMKM Paling Menonjol"
            sub={`${t("Di")} ${wil.kabupaten}, ${t("menurut sinyal ulasan")}`}
          >
            {umkmWilayah.length === 0 ? (
              <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">
                {t("Belum ada UMKM terdata di")} {wil.kabupaten}.{" "}
                {t("Ini peluang: wilayah ini punya")} {wil.n_destinasi}{" "}
                {t("destinasi tanpa UMKM pendukung yang tercatat.")}
              </p>
            ) : (
              <ul className="space-y-2">
                {umkmWilayah.map((u, i) => (
                  <li
                    key={u.nama}
                    className="flex items-center gap-3 rounded-xl border border-ink/5 bg-surface-2/60 p-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-sage/15 text-xs font-extrabold text-brand-sage-ink">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {u.nama}
                      </span>
                      <span className="flex items-center gap-2 text-[11px] text-ink-faint">
                        {u.rating != null && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-brand-amber text-brand-amber" aria-hidden />
                            {u.rating.toFixed(1)}
                          </span>
                        )}
                        <span>
                          {u.ulasan_12_bulan} {t("sinyal")}
                        </span>
                      </span>
                    </span>
                    {u.umkm_kuat && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-sage/15 px-2 py-1 text-[10px] font-bold text-brand-sage-ink">
                        <Award className="h-3 w-3" aria-hidden />
                        {t("Otentik")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Kartu>
        </Reveal>

        <Reveal index={1}>
          <Kartu judul="Peluang di Wilayah Anda" sub="Diturunkan dari data, bukan tebakan">
            <ul className="space-y-2.5 text-xs leading-relaxed text-ink-soft sm:text-sm">
              <li className="flex items-start gap-2">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                <span>
                  {t("Rasio UMKM per destinasi")}:{" "}
                  <strong className="text-ink">
                    {(wil.n_umkm / Math.max(wil.n_destinasi, 1)).toFixed(1)}
                  </strong>
                  . {wil.n_umkm === 0
                    ? t("Belum ada UMKM terdata — peluang paling terbuka di kawasan.")
                    : t("Semakin rendah, semakin longgar persaingannya.")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                <span>
                  {t("Aktivitas malam wilayah ini")}{" "}
                  <strong className="text-ink">{(wil.rasio_malam * 100).toFixed(0)}%</strong>{" "}
                  {t("destinasi buka sampai pukul 20.00.")}{" "}
                  {wil.rasio_malam < 0.4
                    ? t("Jam operasional lebih panjang bisa jadi pembeda.")
                    : t("Permintaan malam sudah terbentuk.")}
                </span>
              </li>
              {wil.musim_puncak && (
                <li className="flex items-start gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                  <span>
                    {t("Musim puncak")}: <strong className="text-ink">{wil.musim_puncak}</strong>.{" "}
                    {t("Siapkan stok dan promo menjelang periode ini.")}
                  </span>
                </li>
              )}
              {wil.mice_event.length > 0 && (
                <li className="flex items-start gap-2">
                  <Award className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                  <span>
                    {t("Event besar tercatat")}:{" "}
                    <strong className="text-ink">{wil.mice_event.slice(0, 3).join(", ")}</strong>.{" "}
                    {t("Momentum kunjungan yang bisa dimanfaatkan.")}
                  </span>
                </li>
              )}
              {wil.budget_harian && (
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                  <span>
                    {t("Budget harian wisatawan")}:{" "}
                    <strong className="text-ink">
                      Rp {wil.budget_harian[0].toLocaleString("id-ID")} &ndash; Rp{" "}
                      {wil.budget_harian[1].toLocaleString("id-ID")}
                    </strong>
                    . {t("Patokan menetapkan titik harga.")}
                  </span>
                </li>
              )}
            </ul>
          </Kartu>
        </Reveal>
      </div>
    </div>
  );
}
