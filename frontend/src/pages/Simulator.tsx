import {
  AlertTriangle,
  Banknote,
  Info,
  Play,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import NarasiAI from "../components/NarasiAI";
import { useT } from "../i18n";
import Reveal from "../components/Reveal";
import {
  ambilNarasiSimulasi,
  ambilOpsiSimulasi,
  jalankanSimulasi,
  ringkasAngka,
  rupiah,
  rupiahRingkas,
} from "../apiIntel";
import { KISI_CHART, SERI_CHART, TINTA_SUMBU } from "../palette";
import type { HasilSimulasi, KunciSkenario, OpsiSimulasi, SimulasiReq } from "../typesIntel";

const AWAL: SimulasiReq = {
  skenario: "festival",
  kabupaten: "Toba",
  profil: "Seimbang",
  skala: "regional",
  waktu: "biasa",
  anggaran: 1_000_000_000,
  jangkauan: "nasional",
  n_terlatih: 50,
  n_destinasi_baru: 3,
  kategori_baru: "Budaya",
  n_program: 3,
};

function Kartu({
  judul,
  sub,
  children,
}: {
  judul: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">{t(judul)}</h2>
        {sub && <p className="mt-0.5 text-xs text-ink-faint">{t(sub)}</p>}
      </div>
      {children}
    </section>
  );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-soft">{t(label)}</span>
      {children}
    </label>
  );
}

const KELAS_INPUT =
  "sentuh w-full rounded-xl border border-ink/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-sage";

/** Tombol pilihan yang menggulir mendatar di layar sempit. */
function Segmen<T extends string>({
  nilai,
  opsi,
  onPilih,
}: {
  nilai: T;
  opsi: { kunci: T; label: string }[];
  onPilih: (v: T) => void;
}) {
  const t = useT();
  return (
    <div className="gulir-x -mx-1 px-1">
      <div className="flex gap-1.5">
        {opsi.map((o) => (
          <button
            key={o.kunci}
            type="button"
            onClick={() => onPilih(o.kunci)}
            className={`sentuh shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              nilai === o.kunci
                ? "border-brand-sage-ink bg-brand-sage/15 text-brand-sage-ink"
                : "border-ink/10 bg-white text-ink-soft hover:border-ink/25"
            }`}
          >
            {t(o.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Simulator() {
  const t = useT();
  const [opsi, setOpsi] = useState<OpsiSimulasi | null>(null);
  const [form, setForm] = useState<SimulasiReq>(AWAL);
  const [hasil, setHasil] = useState<HasilSimulasi | null>(null);
  // Parameter yang BENAR-BENAR menghasilkan `hasil`. Narasi harus
  // memakai ini, bukan `form` yang bisa sudah diubah pengguna setelahnya.
  const [formTerpakai, setFormTerpakai] = useState<SimulasiReq | null>(null);
  const [jalan, setJalan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambilOpsiSimulasi()
      .then((o) => !batal && setOpsi(o))
      .catch((e: Error) => !batal && setGalat(e.message));
    return () => {
      batal = true;
    };
  }, []);

  const ubah = <K extends keyof SimulasiReq>(k: K, v: SimulasiReq[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function jalankan() {
    setJalan(true);
    setGalat(null);
    try {
      setHasil(await jalankanSimulasi(form));
      setFormTerpakai(form);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setJalan(false);
    }
  }

  const muatNarasi = useCallback(
    () => ambilNarasiSimulasi(formTerpakai as SimulasiReq),
    [formTerpakai],
  );

  const wilayah = useMemo(
    () => opsi?.kabupaten.find((k) => k.nama === form.kabupaten) ?? null,
    [opsi, form.kabupaten],
  );

  const dataDistribusi = useMemo(() => {
    if (!hasil) return [];
    return hasil.distribusi.map((d) => ({
      kabupaten: d.kabupaten.replace("Hasundutan", "H."),
      Sebelum: Number((d.sebelum * 100).toFixed(2)),
      Sesudah: Number((d.sesudah * 100).toFixed(2)),
    }));
  }, [hasil]);

  if (galat && !opsi) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="flex items-center gap-2 font-display font-extrabold text-rose-800">
          <AlertTriangle className="h-5 w-5" aria-hidden /> {t("Gagal memuat opsi")}
        </p>
        <p className="mt-1 text-sm text-rose-700">{galat}</p>
      </div>
    );
  }

  if (!opsi) {
    return (
      <div className="space-y-4">
        <div className="skel h-8 w-56 rounded-xl" />
        <div className="skel h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {t("Simulasi Dampak Kebijakan")}
        </h1>
        <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
          {t("Bandingkan pilihan program sebelum anggaran dikeluarkan")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* ── Form ──────────────────────────────────────────────────── */}
        <Reveal className="xl:col-span-1">
          <Kartu judul="Rancang Skenario">
            <div className="space-y-4">
              <Baris label="Jenis program">
                <Segmen
                  nilai={form.skenario}
                  opsi={opsi.skenario.map((s) => ({ kunci: s.kunci, label: s.label }))}
                  onPilih={(v) => ubah("skenario", v as KunciSkenario)}
                />
              </Baris>

              <Baris label="Kabupaten">
                <select
                  className={KELAS_INPUT}
                  value={form.kabupaten}
                  onChange={(e) => ubah("kabupaten", e.target.value)}
                >
                  {opsi.kabupaten.map((k) => (
                    <option key={k.nama} value={k.nama}>
                      {k.nama} &middot; {k.n_destinasi} {t("destinasi")}, {k.n_umkm} UMKM
                    </option>
                  ))}
                </select>
              </Baris>

              {wilayah?.musim_puncak && (
                <p className="rounded-xl bg-brand-sage/10 p-2.5 text-[11px] leading-relaxed text-ink-soft">
                  {t("Musim puncak")} {wilayah.nama}: <strong>{wilayah.musim_puncak}</strong>
                </p>
              )}

              {/* Masukan khusus per skenario */}
              {form.skenario === "festival" && (
                <>
                  <Baris label="Skala festival">
                    <Segmen
                      nilai={form.skala ?? "regional"}
                      opsi={[
                        { kunci: "lokal", label: "Lokal" },
                        { kunci: "regional", label: "Regional" },
                        { kunci: "nasional", label: "Nasional" },
                      ]}
                      onPilih={(v) => ubah("skala", v)}
                    />
                  </Baris>
                  <Baris label="Waktu penyelenggaraan">
                    <Segmen
                      nilai={form.waktu ?? "biasa"}
                      opsi={[
                        { kunci: "puncak", label: "Musim puncak" },
                        { kunci: "biasa", label: "Biasa" },
                        { kunci: "sepi", label: "Musim sepi" },
                      ]}
                      onPilih={(v) => ubah("waktu", v)}
                    />
                  </Baris>
                </>
              )}

              {form.skenario === "promosi" && (
                <>
                  <Baris label="Anggaran promosi (Rp)">
                    <input
                      type="number"
                      min={0}
                      step={100_000_000}
                      className={KELAS_INPUT}
                      value={form.anggaran ?? 0}
                      onChange={(e) => ubah("anggaran", Number(e.target.value) || 0)}
                    />
                  </Baris>
                  <Baris label="Jangkauan">
                    <Segmen
                      nilai={form.jangkauan ?? "nasional"}
                      opsi={[
                        { kunci: "lokal", label: "Lokal" },
                        { kunci: "nasional", label: "Nasional" },
                        { kunci: "internasional", label: "Internasional" },
                      ]}
                      onPilih={(v) => ubah("jangkauan", v)}
                    />
                  </Baris>
                </>
              )}

              {form.skenario === "pelatihan_umkm" && (
                <Baris label="Jumlah UMKM dilatih">
                  <input
                    type="number"
                    min={0}
                    className={KELAS_INPUT}
                    value={form.n_terlatih ?? 0}
                    onChange={(e) => ubah("n_terlatih", Number(e.target.value) || 0)}
                  />
                </Baris>
              )}

              {form.skenario === "destinasi_baru" && (
                <>
                  <Baris label="Jumlah destinasi baru">
                    <input
                      type="number"
                      min={0}
                      className={KELAS_INPUT}
                      value={form.n_destinasi_baru ?? 0}
                      onChange={(e) => ubah("n_destinasi_baru", Number(e.target.value) || 0)}
                    />
                  </Baris>
                  <Baris label="Kategori destinasi">
                    <Segmen
                      nilai={form.kategori_baru ?? "Budaya"}
                      opsi={opsi.kategori.map((k) => ({ kunci: k, label: k }))}
                      onPilih={(v) => ubah("kategori_baru", v)}
                    />
                  </Baris>
                </>
              )}

              {form.skenario === "budaya" && (
                <Baris label="Jumlah program budaya">
                  <input
                    type="number"
                    min={0}
                    className={KELAS_INPUT}
                    value={form.n_program ?? 0}
                    onChange={(e) => ubah("n_program", Number(e.target.value) || 0)}
                  />
                </Baris>
              )}

              <Baris label="Profil belanja wisatawan">
                <select
                  className={KELAS_INPUT}
                  value={form.profil}
                  onChange={(e) => ubah("profil", e.target.value)}
                >
                  {opsi.profil.map((p) => (
                    <option key={p.kunci} value={p.kunci}>
                      {p.kunci} &middot; {(p.umkm_weight * 100).toFixed(0)}% {t("ke usaha lokal")}
                    </option>
                  ))}
                </select>
              </Baris>

              <button
                type="button"
                onClick={jalankan}
                disabled={jalan}
                className="sentuh flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-sage-ink to-brand-forest px-4 py-3 text-sm font-extrabold text-on-sage-ink shadow-lg shadow-brand-forest/25 transition-all hover:-translate-y-0.5 disabled:opacity-60"
              >
                <Play className="h-4 w-4" aria-hidden />
                {jalan ? t("Menghitung...") : t("Jalankan Simulasi")}
              </button>

              {galat && (
                <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{galat}</p>
              )}
            </div>
          </Kartu>
        </Reveal>

        {/* ── Hasil ─────────────────────────────────────────────────── */}
        <div className="space-y-4 xl:col-span-2">
          {!hasil ? (
            <Reveal>
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-ink/15 bg-white/60 p-8 text-center">
                <TrendingUp className="h-10 w-10 text-ink-faint" aria-hidden />
                <p className="mt-3 font-display text-base font-extrabold text-ink">
                  {t("Belum ada simulasi")}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-faint">
                  {t(
                    "Pilih jenis program dan wilayah di panel sebelah, lalu jalankan untuk melihat perkiraan dampaknya beserta seluruh asumsi yang dipakai.",
                  )}
                </p>
              </div>
            </Reveal>
          ) : (
            <>
              {/* KPI hasil */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    ikon: Users,
                    label: t("Tambahan wisatawan"),
                    nilai: `+${ringkasAngka(hasil.dampak.delta_wisatawan)}`,
                    sub: `${(hasil.uplift * 100).toFixed(1)}% ${t("dari basis")} ${ringkasAngka(hasil.dasar.wisatawan)}`,
                  },
                  {
                    ikon: Banknote,
                    label: t("Tambahan dampak ekonomi"),
                    nilai: rupiahRingkas(hasil.dampak.delta_ekonomi),
                    sub: `${t("dari basis")} ${rupiahRingkas(hasil.dasar.ekonomi)}`,
                  },
                  {
                    ikon: Store,
                    label: t("Tambahan transaksi UMKM"),
                    nilai: rupiahRingkas(hasil.dampak.delta_transaksi_umkm),
                    sub:
                      hasil.dampak.delta_bagian_umkm > 0
                        ? `${t("porsi lokal")} +${(hasil.dampak.delta_bagian_umkm * 100).toFixed(2)} ${t("poin persen")}`
                        : `${t("porsi lokal tetap")} ${(hasil.dasar.bagian_umkm * 100).toFixed(0)}%`,
                  },
                ].map((k, i) => (
                  <Reveal key={k.label} index={i}>
                    <div className="h-full rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-sage/15">
                        <k.ikon className="h-4 w-4 text-brand-sage-ink" aria-hidden />
                      </span>
                      <p className="mt-2.5 text-xs font-semibold text-ink-faint">{k.label}</p>
                      <p className="mt-0.5 font-display text-xl font-extrabold text-ink sm:text-2xl">
                        {k.nilai}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-ink-faint">{k.sub}</p>
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Grafik perbandingan */}
              <Reveal>
                <Kartu
                  judul="Proyeksi 12 Bulan"
                  sub="Dengan program dibandingkan tanpa program"
                >
                  <div className="h-56 w-full sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={hasil.seri} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
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
                          width={48}
                          tickFormatter={ringkasAngka}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid rgba(12,59,46,0.12)",
                            fontSize: 12,
                          }}
                          formatter={(v: number) => `${ringkasAngka(v)} ${t("wisatawan")}`}
                        />
                        <Legend
                          verticalAlign="top"
                          height={28}
                          iconType="plainline"
                          iconSize={16}
                          formatter={(v: string) => (
                            <span style={{ fontSize: 11, color: TINTA_SUMBU }}>{t(v)}</span>
                          )}
                        />
                        <Line
                          name="Tanpa program"
                          type="monotone"
                          dataKey="dasar"
                          stroke={TINTA_SUMBU}
                          strokeWidth={2}
                          strokeDasharray="5 4"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          name="Dengan program"
                          type="monotone"
                          dataKey="intervensi"
                          stroke={SERI_CHART[0]}
                          strokeWidth={2.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Kartu>
              </Reveal>

              {/* Distribusi antar-kabupaten */}
              <Reveal>
                <Kartu
                  judul="Pergeseran Distribusi Wisatawan"
                  sub="Pangsa tiap kabupaten sebelum dan sesudah program (%)"
                >
                  <div className="h-56 w-full sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dataDistribusi}
                        margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid stroke={KISI_CHART} vertical={false} />
                        <XAxis
                          dataKey="kabupaten"
                          tick={{ fontSize: 9, fill: TINTA_SUMBU }}
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
                          width={40}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(12,59,46,0.04)" }}
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid rgba(12,59,46,0.12)",
                            fontSize: 12,
                          }}
                          formatter={(v: number) => `${v}%`}
                        />
                        <Legend
                          verticalAlign="top"
                          height={26}
                          iconType="circle"
                          iconSize={8}
                          formatter={(v: string) => (
                            <span style={{ fontSize: 11, color: TINTA_SUMBU }}>{t(v)}</span>
                          )}
                        />
                        <Bar dataKey="Sebelum" fill={SERI_CHART[5]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Bar dataKey="Sesudah" fill={SERI_CHART[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Kartu>
              </Reveal>

              {/* Asumsi — inilah yang membuat simulator sederhana bisa dinilai */}
              <Reveal>
                <Kartu
                  judul="Asumsi Model"
                  sub="Setiap angka di atas berasal dari salah satu baris di bawah"
                >
                  <div className="gulir-x -mx-1">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wide text-ink-faint">
                          <th className="px-2 py-2 font-bold">{t("Parameter")}</th>
                          <th className="px-2 py-2 font-bold">{t("Nilai")}</th>
                          <th className="px-2 py-2 font-bold">{t("Sumber")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hasil.asumsi.map((a) => (
                          <tr key={a.parameter} className="border-b border-ink/5 last:border-0">
                            <td className="px-2 py-2 font-semibold text-ink">{t(a.parameter)}</td>
                            <td className="whitespace-nowrap px-2 py-2 tabular-nums text-ink">
                              {a.nilai}
                            </td>
                            <td className="px-2 py-2 leading-relaxed text-ink-soft">{t(a.sumber)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="flex items-start gap-2 rounded-xl bg-brand-amber/10 p-3 text-[11px] leading-relaxed text-ink-soft">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber-ink" aria-hidden />
                      <span>{t(hasil.peringatan)}</span>
                    </p>
                    {hasil.catatan.map((c) => (
                      <p
                        key={c}
                        className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-[11px] leading-relaxed text-rose-800"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{t(c)}</span>
                      </p>
                    ))}
                    <p className="text-[11px] leading-relaxed text-ink-faint">
                      {t("Pembanding tanpa program")}:{" "}
                      {ringkasAngka(hasil.tanpa_intervensi.wisatawan)} {t("wisatawan")} &mdash;{" "}
                      {t(hasil.tanpa_intervensi.penjelasan)} {t("Dampak ekonomi dasar")}{" "}
                      {rupiah(hasil.dasar.ekonomi)}.
                    </p>
                  </div>
                </Kartu>
              </Reveal>

              {formTerpakai && (
                <Reveal>
                  {/* key memaksa kartu baru saat parameter berubah, supaya
                      narasi lama tidak menempel pada angka yang sudah berbeda. */}
                  <NarasiAI
                    key={JSON.stringify(formTerpakai)}
                    judul="Penjelasan AI"
                    sub="Dibuat atas permintaan; seluruh angka sudah dihitung rule engine"
                    muat={muatNarasi}
                    bagian={[
                      { kunci: "insight", label: "Yang perlu diperhatikan" },
                      { kunci: "tindak_lanjut", label: "Tindak lanjut" },
                    ]}
                  />
                </Reveal>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
