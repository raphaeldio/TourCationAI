import {
  AlertTriangle,
  BarChart3,
  Clock,
  Download,
  Eye,
  History,
  Loader2,
  Lock,
  ShieldCheck,
  Star,
  Tags,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { rupiah } from "../apiIntel";
import { ambilKompetitor, ambilRiwayat, unduhEksporCsv } from "../apiUmkm";
import KunciFitur from "../components/KunciFitur";
import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import { usePaket } from "../paket";
import { KISI_CHART, SERI_CHART, TINTA_SUMBU } from "../palette";
import type { AnalisisKompetitor, JenisEkspor, RiwayatUmkm } from "../typesUmkm";

function Kartu({
  judul,
  sub,
  ikon: Ikon,
  aksi,
  children,
  className = "",
}: {
  judul: string;
  sub?: string;
  ikon?: typeof BarChart3;
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
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
            {Ikon && <Ikon className="h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />}
            {t(judul)}
          </h2>
          {sub && <p className="mt-0.5 text-xs text-ink-faint">{t(sub)}</p>}
        </div>
        {aksi}
      </div>
      {children}
    </section>
  );
}

function Angka({ label, nilai, sub }: { label: string; nilai: string; sub?: string }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{t(label)}</p>
      <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-ink">{nilai}</p>
      {sub && <p className="mt-0.5 text-[10px] text-ink-faint">{t(sub)}</p>}
    </div>
  );
}

/** Pita p25–p75 dengan penanda posisi usaha. Lebih terbaca daripada angka. */
function PitaHarga({
  p25,
  median,
  p75,
  saya,
  persentil,
}: {
  p25: number;
  median: number;
  p75: number;
  saya: number | null;
  persentil: number | null;
}) {
  const t = useT();
  // Skala dibentangkan sedikit di luar p25-p75 supaya harga di luar pita tetap
  // terlihat posisinya, bukan menempel mati di ujung batang.
  const lo = Math.min(p25, saya ?? p25) * 0.9;
  const hi = Math.max(p75, saya ?? p75) * 1.1;
  const persen = (n: number) => Math.max(0, Math.min(100, ((n - lo) / (hi - lo)) * 100));

  return (
    <div>
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-ink/5" />
        <div
          className="absolute top-4 h-2 rounded-full bg-brand-sage/40"
          style={{ left: `${persen(p25)}%`, width: `${persen(p75) - persen(p25)}%` }}
        />
        <div
          className="absolute top-3 h-4 w-0.5 rounded bg-brand-sage-ink"
          style={{ left: `${persen(median)}%` }}
          title={t("Median wilayah")}
        />
        {saya != null && (
          <div
            className="absolute top-1 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${persen(saya)}%` }}
          >
            <span className="rounded-md bg-brand-amber px-1.5 py-0.5 text-[9px] font-extrabold text-on-amber">
              {t("Anda")}
            </span>
            <span className="h-3 w-0.5 bg-brand-amber-ink" />
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-ink-faint">
        <span>{rupiah(p25)}</span>
        <span>{rupiah(median)}</span>
        <span>{rupiah(p75)}</span>
      </div>
      {persentil != null && (
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          {t("Harga tengah Anda berada di persentil")}{" "}
          <strong className="text-ink">{persentil}</strong> —{" "}
          {t("artinya sekitar")} {persentil}% {t("titik harga pembanding lebih murah dari Anda.")}
        </p>
      )}
    </div>
  );
}

function IsiKompetitor({ d }: { d: AnalisisKompetitor }) {
  const t = useT();
  const ph = d.posisi_harga;
  const pm = d.permintaan;
  const td = d.terdaftar;
  const cm = d.celah_menu;

  return (
    <div className="space-y-4">
      {/* Posisi harga */}
      <Kartu
        judul="Posisi Harga Anda"
        ikon={Tags}
        sub={
          ph.tersedia
            ? `Terhadap ${ph.n_pembanding} rumah makan di ${ph.grup}`
            : undefined
        }
      >
        {!ph.tersedia ? (
          <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">
            {t(ph.alasan ?? "Belum ada pembanding.")}
          </p>
        ) : (
          <div className="space-y-4">
            <PitaHarga
              p25={ph.p25!}
              median={ph.median_wilayah!}
              p75={ph.p75!}
              saya={ph.median_saya}
              persentil={ph.persentil_saya ?? null}
            />

            {ph.per_produk.length > 0 && (
              <ul className="space-y-1.5">
                {ph.per_produk.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/5 bg-surface-2/50 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                      {p.nama}
                    </span>
                    <span className="text-xs tabular-nums text-ink-soft">{rupiah(p.harga)}</span>
                    <span className="rounded-lg bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                      {t(p.posisi)}
                      {p.persentil != null && ` · p${p.persentil}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {ph.metode && (
              <p className="text-[11px] leading-relaxed text-ink-faint">{t(ph.metode)}</p>
            )}
          </div>
        )}
      </Kartu>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Permintaan */}
        <Kartu judul="Posisi Permintaan" ikon={TrendingUp} sub="Sinyal ulasan 12 bulan sekabupaten">
          {!pm.tersedia ? (
            <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs leading-relaxed text-ink-faint">
              {t(pm.alasan ?? "Belum cukup pembanding di wilayah ini.")}
            </p>
          ) : (
            <div className="space-y-3">
              {pm.peringkat != null ? (
                <div className="rounded-xl bg-brand-sage/[0.07] p-4 text-center">
                  <p className="font-display text-3xl font-extrabold tabular-nums text-ink">
                    #{pm.peringkat}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {t("dari")} {pm.dari} {t("rumah makan terdata")}
                    {pm.persentil != null && ` · ${t("teratas")} ${(100 - pm.persentil).toFixed(0)}%`}
                  </p>
                </div>
              ) : (
                <p className="rounded-xl bg-ink/[0.03] p-3 text-xs leading-relaxed text-ink-faint">
                  {t(pm.catatan ?? "Usaha Anda belum ada pada dataset ulasan.")}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Angka
                  label="Sinyal Anda"
                  nilai={pm.sinyal_saya != null ? String(pm.sinyal_saya) : "—"}
                  sub="ulasan 12 bulan"
                />
                <Angka
                  label="Median wilayah"
                  nilai={pm.sinyal_median != null ? String(pm.sinyal_median) : "—"}
                  sub={`tertinggi ${pm.sinyal_tertinggi ?? 0}`}
                />
                <Angka
                  label="Rating wilayah"
                  nilai={pm.rating_rata2_wilayah != null ? pm.rating_rata2_wilayah.toFixed(2) : "—"}
                />
                <Angka
                  label="Status tren"
                  nilai={pm.status_tren ? t(pm.status_tren) : "—"}
                />
              </div>

              {pm.tersensor && (
                <p className="rounded-xl bg-brand-amber/10 p-2.5 text-[11px] leading-relaxed text-ink-soft">
                  {t(
                    "Riwayat ulasan usaha Anda menyentuh batas pengambilan data, jadi pertumbuhannya tidak dapat diukur — bukan berarti nol.",
                  )}
                </p>
              )}
            </div>
          )}
        </Kartu>

        {/* Celah menu */}
        <Kartu judul="Celah Menu" ikon={Utensils} sub="Kuliner khas kawasan yang belum Anda tawarkan">
          {!cm.tersedia ? (
            <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs text-ink-faint">
              {t("Daftar kuliner khas belum bisa dibaca di server.")}
            </p>
          ) : (
            <div className="space-y-3">
              {cm.skor_umkm != null && (
                <div className="flex items-center gap-3 rounded-xl border border-ink/5 bg-surface-2/60 p-3">
                  <span className="font-display text-2xl font-extrabold tabular-nums text-ink">
                    {(cm.skor_umkm * 100).toFixed(0)}%
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-ink-soft">
                    {t("Skor UMKM lokal atas menu Anda")}
                    {cm.umkm_kuat ? ` · ${t("tergolong lokal-otentik")}` : ""}
                  </span>
                </div>
              )}

              {cm.sudah_ditawarkan.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                    {t("Sudah ada di menu")}
                  </p>
                  <p className="flex flex-wrap gap-1.5">
                    {cm.sudah_ditawarkan.map((k) => (
                      <span
                        key={k}
                        className="rounded-lg bg-brand-sage/15 px-2 py-0.5 text-[11px] font-bold text-brand-sage-ink"
                      >
                        {k}
                      </span>
                    ))}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                  {t("Belum ditawarkan")}
                </p>
                <p className="flex flex-wrap gap-1.5">
                  {cm.belum_ditawarkan.map((k) => (
                    <span
                      key={k}
                      className="rounded-lg border border-ink/10 px-2 py-0.5 text-[11px] font-semibold text-ink-soft"
                    >
                      {k}
                    </span>
                  ))}
                </p>
              </div>

              {cm.catatan && (
                <p className="text-[11px] leading-relaxed text-ink-faint">{t(cm.catatan)}</p>
              )}
            </div>
          )}
        </Kartu>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Usaha terdaftar sekabupaten */}
        <Kartu judul="Usaha Terdaftar Sekabupaten" ikon={ShieldCheck} sub="Agregat anonim">
          {!td.tersedia ? (
            <p className="rounded-xl bg-ink/[0.03] p-4 text-xs leading-relaxed text-ink-faint">
              {t(td.alasan ?? "Belum cukup usaha terdaftar untuk dibandingkan.")}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Angka label="Usaha lain" nilai={String(td.n_usaha)} sub="terdaftar di kabupaten" />
                <Angka
                  label="Median harga mereka"
                  nilai={
                    td.median_harga_terdaftar ? rupiah(td.median_harga_terdaftar) : "—"
                  }
                />
              </div>

              {(td.kategori_ramai?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                    {t("Kategori paling ramai")}
                  </p>
                  <ul className="space-y-1">
                    {td.kategori_ramai!.map((k) => (
                      <li
                        key={k.kategori}
                        className="flex items-center justify-between rounded-lg bg-surface-2/60 px-2.5 py-1.5 text-xs"
                      >
                        <span className="text-ink-soft">{k.kategori}</span>
                        <span className="font-bold tabular-nums text-ink">
                          {k.n_usaha} {t("usaha")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!!td.n_kategori_disupresi && (
                <p className="text-[11px] leading-relaxed text-ink-faint">
                  {td.n_kategori_disupresi}{" "}
                  {t(
                    "kategori lain disembunyikan karena hanya dipakai sedikit usaha — menampilkannya sama dengan menunjuk usaha tertentu.",
                  )}
                </p>
              )}
            </div>
          )}
        </Kartu>

        {/* Operasional */}
        <Kartu judul="Jam & Musim" ikon={Clock} sub="Patokan operasional wilayah Anda">
          <ul className="space-y-2.5 text-xs leading-relaxed text-ink-soft">
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
              <span>
                {t("Jam buka Anda")}:{" "}
                <strong className="text-ink">
                  {d.operasional.jam_buka_saya ?? t("belum diisi")}
                </strong>
                {d.operasional.rasio_malam_wilayah != null && (
                  <>
                    {" · "}
                    {(d.operasional.rasio_malam_wilayah * 100).toFixed(0)}%{" "}
                    {t("destinasi di wilayah ini buka sampai pukul 20.00.")}
                  </>
                )}
              </span>
            </li>
            {d.operasional.musim_puncak && (
              <li className="flex items-start gap-2">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                <span>
                  {t("Musim puncak")}:{" "}
                  <strong className="text-ink">{d.operasional.musim_puncak}</strong>.{" "}
                  {t("Siapkan stok dan tenaga menjelang periode ini.")}
                </span>
              </li>
            )}
          </ul>
        </Kartu>
      </div>

      <p className="flex items-start gap-2 rounded-2xl bg-brand-sage/[0.07] p-3.5 text-[11px] leading-relaxed text-ink-soft">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
        <span>
          {t(d.anonimitas.aturan)} {t(d.netralitas)}
        </span>
      </p>
    </div>
  );
}

/**
 * Analisis Pasar — satu tempat untuk seluruh pertanyaan "bagaimana posisi saya".
 *
 * Urutannya dipilih mengikuti urutan pertanyaan yang biasanya muncul di kepala
 * pemilik usaha, bukan mengikuti tier paketnya: apa yang terjadi pada usaha saya
 * (riwayat, terbuka untuk semua tier) → bagaimana dibanding sekitar (kompetitor)
 * → bawa datanya keluar (ekspor). Menyusunnya per tier akan menaruh dinding
 * berbayar di layar pertama yang dilihat pengguna baru.
 */
export default function UmkmAnalisis() {
  const t = useT();
  const { punya, langganan } = usePaket();

  const [riwayat, setRiwayat] = useState<RiwayatUmkm | null>(null);
  const [komp, setKomp] = useState<AnalisisKompetitor | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatKomp, setGalatKomp] = useState<string | null>(null);
  const [mengunduh, setMengunduh] = useState<JenisEkspor | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      setRiwayat(await ambilRiwayat());
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    if (!punya("kompetitor")) return;
    let batal = false;
    ambilKompetitor()
      .then((d) => !batal && setKomp(d))
      .catch((e: Error) => !batal && setGalatKomp(e.message));
    return () => {
      batal = true;
    };
  }, [punya]);

  async function unduh(jenis: JenisEkspor) {
    setMengunduh(jenis);
    setPesan(null);
    try {
      const nama = await unduhEksporCsv(jenis);
      setPesan(`${t("Berkas terunduh")}: ${nama}`);
    } catch (e) {
      setPesan((e as Error).message);
    } finally {
      setMengunduh(null);
    }
  }

  const seri =
    riwayat?.bulan.map((b) => ({
      bulan: b.bulan.slice(2),
      dilihat: b.dilihat,
      penilaian: b.n_rating + b.n_suara,
      rata: b.rata_rating,
    })) ?? [];

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-xl font-extrabold text-ink sm:text-2xl">
          <BarChart3 className="h-6 w-6 text-brand-sage-ink" aria-hidden />
          {t("Analisis Pasar")}
        </h1>
        <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
          {t("Riwayat performa usaha Anda, posisinya terhadap sekitar, dan datanya untuk dibawa keluar")}
        </p>
      </div>

      {galat && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {galat}
        </p>
      )}

      {/* ── 1. Riwayat: terbuka untuk semua paket ───────────────────── */}
      <Reveal>
        <Kartu
          judul="Riwayat Performa"
          ikon={History}
          sub={
            riwayat
              ? `${riwayat.jendela_bulan} bulan terakhir · sejak ${riwayat.mulai}`
              : undefined
          }
          aksi={
            riwayat?.dibatasi_paket ? (
              <Link
                to="/umkm/langganan"
                className="sentuh flex items-center gap-1.5 rounded-xl border border-ink/15 px-3 py-2 text-[11px] font-bold text-ink no-underline transition-colors hover:bg-ink/5"
              >
                <Lock className="h-3.5 w-3.5" aria-hidden />
                {`+${riwayat.bulan_tersembunyi} ${t("bulan di paket lebih tinggi")}`}
              </Link>
            ) : undefined
          }
        >
          {!riwayat ? (
            <div className="skel h-56 rounded-xl" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Angka label="Dilihat" nilai={String(riwayat.total.dilihat)} sub="kali dibuka wisatawan" />
                <Angka
                  label="Penilaian masuk"
                  nilai={String(riwayat.total.n_rating)}
                  sub={
                    riwayat.total.rata_rating != null
                      ? `rata-rata ${riwayat.total.rata_rating}`
                      : "belum ada rata-rata"
                  }
                />
                <Angka
                  label="Suara harga"
                  nilai={String(riwayat.total.n_suara)}
                  sub={`${riwayat.total.n_setuju} menilai wajar`}
                />
                <Angka
                  label="Harga ditandai"
                  nilai={String(riwayat.total.n_ditandai)}
                  sub={`dari ${riwayat.total.n_penilaian_harga} pemeriksaan`}
                />
              </div>

              {riwayat.kosong ? (
                <p className="rounded-xl bg-ink/[0.03] p-4 text-center text-xs leading-relaxed text-ink-faint">
                  {t(
                    "Belum ada aktivitas tercatat pada periode ini. Angka mulai terisi begitu usaha Anda muncul di rencana wisatawan dan mulai dinilai.",
                  )}
                </p>
              ) : (
                <div className="h-56 w-full sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={seri} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
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
                      />
                      <Bar
                        dataKey="dilihat"
                        name={t("Dilihat")}
                        fill={SERI_CHART[0]}
                        radius={[6, 6, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="penilaian"
                        name={t("Penilaian")}
                        stroke={SERI_CHART[2]}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-ink-faint">{t(riwayat.catatan)}</p>
            </div>
          )}
        </Kartu>
      </Reveal>

      {/* ── 2. Analisis kompetitor ──────────────────────────────────── */}
      {punya("kompetitor") ? (
        galatKomp ? (
          <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {galatKomp}
          </p>
        ) : komp ? (
          <Reveal index={1}>
            <IsiKompetitor d={komp} />
          </Reveal>
        ) : (
          <div className="skel h-64 rounded-2xl" />
        )
      ) : (
        <Reveal index={1}>
          <KunciFitur
            fitur="kompetitor"
            ikon={TrendingUp}
            judul="Analisis kompetitor sekabupaten"
            deskripsi="Lihat posisi harga dan permintaan usaha Anda dibanding rumah makan lain di kabupaten yang sama — seluruhnya anonim, tanpa satu pun nama pesaing."
            poin={[
              "Posisi harga tiap produk pada sebaran nyata sekabupaten",
              "Peringkat sinyal permintaan Anda dari sekian rumah makan terdata",
              "Kuliner khas kawasan yang belum ada di menu Anda",
              "Agregat disupresi bila pembandingnya terlalu sedikit untuk anonim",
            ]}
          />
        </Reveal>
      )}

      {/* ── 3. Ekspor ───────────────────────────────────────────────── */}
      {punya("ekspor") ? (
        <Reveal index={2}>
          <Kartu
            judul="Ekspor CSV"
            ikon={Download}
            sub="Unduh data usaha Anda untuk diolah di spreadsheet"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { jenis: "produk", label: "Produk & harga", ikon: Tags },
                  { jenis: "penilaian", label: "Penilaian masuk", ikon: Star },
                  { jenis: "riwayat", label: "Riwayat bulanan", ikon: History },
                ] as { jenis: JenisEkspor; label: string; ikon: typeof Tags }[]
              ).map((b) => (
                <button
                  key={b.jenis}
                  type="button"
                  disabled={mengunduh !== null}
                  onClick={() => void unduh(b.jenis)}
                  className="sentuh flex items-center justify-center gap-2 rounded-xl border border-ink/10 px-3 py-3 text-xs font-bold text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-50"
                >
                  {mengunduh === b.jenis ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <b.ikon className="h-4 w-4 text-brand-sage-ink" aria-hidden />
                  )}
                  {t(b.label)}
                </button>
              ))}
            </div>
            {pesan && (
              <p className="mt-3 rounded-xl bg-ink/[0.04] p-2.5 text-xs text-ink-soft">{pesan}</p>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              {t(
                "Berkas berisi data usaha Anda sendiri. Identitas pemberi rating dan suara harga tidak pernah ikut terekspor.",
              )}
              {riwayat?.dibatasi_paket &&
                ` ${t("Rentang riwayat mengikuti jendela paket Anda:")} ${riwayat.jendela_bulan} ${t("bln")}.`}
            </p>
          </Kartu>
        </Reveal>
      ) : (
        <Reveal index={2}>
          <KunciFitur
            fitur="ekspor"
            ikon={Download}
            judul="Ekspor CSV"
            deskripsi="Bawa data usaha Anda keluar dari dashboard — untuk laporan, pengajuan bantuan, atau diolah sendiri di spreadsheet."
            poin={[
              "Produk & harga lengkap dengan status pemeriksaan dan skor verifikasi",
              "Penilaian wisatawan dan suara kewajaran harga, tanpa identitas penilai",
              "Riwayat bulanan sepanjang jendela paket Anda",
              "Langsung terbaca di Excel — tanpa wizard impor",
            ]}
          />
        </Reveal>
      )}

      {langganan && (
        <p className="flex items-start gap-2 rounded-2xl bg-ink/[0.03] p-3.5 text-[11px] leading-relaxed text-ink-faint">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {t("Paket Anda")} <strong className="text-ink-soft">{langganan.nama}</strong>.{" "}
            {t(
              "Paket menentukan seberapa dalam Anda melihat pasar — bukan seberapa tinggi Anda muncul di rekomendasi wisatawan.",
            )}
          </span>
        </p>
      )}
    </div>
  );
}
