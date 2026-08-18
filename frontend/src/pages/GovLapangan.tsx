import {
  AlertTriangle,
  ClipboardCheck,
  Database,
  Inbox,
  MessageSquare,
  Send,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ambilAgregatLapangan, ambilLaporanMasuk, tanggapiLaporan } from "../apiPerjalanan";
import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import {
  LABEL_KATEGORI,
  LABEL_STATUS_LAPORAN,
  LABEL_TINGKAT,
  LABEL_WAKTU,
  WARNA_STATUS_LAPORAN,
  WARNA_TINGKAT,
} from "../labelPerjalanan";
import type {
  AgregatLapangan,
  AkurasiWaktu,
  KategoriMeta,
  Laporan,
  StatusLaporan,
} from "../typesPerjalanan";

const SARINGAN: (StatusLaporan | "SEMUA")[] = [
  "SEMUA", "BARU", "DIBACA", "DITINDAKLANJUTI", "SELESAI", "DITOLAK",
];

/**
 * Laporan lapangan wisatawan — seri KETIGA dashboard pemerintah.
 *
 * Halaman ini satu-satunya tempat di seluruh dashboard yang angkanya berasal
 * dari pengamatan langsung, bukan dari proksi. Dua seri lain — volume ulasan
 * Google dan cacah itinerary — keduanya turunan; yang ini orang yang benar-benar
 * berdiri di lokasi. Karena itu jumlahnya kecil, dan kekecilan itu ditampilkan
 * apa adanya lewat penanda "belum cukup untuk bukti" alih-alih disembunyikan.
 */
export default function GovLapangan() {
  const t = useT();
  const [agregat, setAgregat] = useState<AgregatLapangan | null>(null);
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [kategoriMeta, setKategoriMeta] = useState<KategoriMeta[]>([]);
  const [wilayah, setWilayah] = useState<string | null>(null);
  const [saring, setSaring] = useState<StatusLaporan | "SEMUA">("SEMUA");
  const [saringKategori, setSaringKategori] = useState("SEMUA");
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [buka, setBuka] = useState<string | null>(null);
  const [balasan, setBalasan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async (status: string, kategori: string) => {
    setMemuat(true);
    try {
      const [a, d] = await Promise.all([
        ambilAgregatLapangan(180),
        ambilLaporanMasuk(status, kategori),
      ]);
      setAgregat(a);
      setLaporan(d.laporan);
      setKategoriMeta(d.kategori);
      setWilayah(d.kabupaten);
      setGalat(null);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat(saring, saringKategori);
  }, [muat, saring, saringKategori]);

  async function kirim(id: string, status: StatusLaporan) {
    setSibuk(true);
    try {
      await tanggapiLaporan(id, status, balasan || undefined);
      setBalasan("");
      setBuka(null);
      await muat(saring, saringKategori);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  if (galat && !laporan.length && !agregat) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="flex items-center gap-2 font-display font-extrabold text-rose-800">
          <AlertTriangle className="h-5 w-5" aria-hidden /> {t("Gagal memuat data")}
        </p>
        <p className="mt-1 text-sm text-rose-700">{galat}</p>
      </div>
    );
  }

  const ak = agregat?.akurasi_rencana;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {t("Laporan Lapangan")}
        </h1>
        <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
          {wilayah
            ? `${t("Pengamatan wisatawan yang perjalanannya sudah selesai di")} ${wilayah}`
            : t("Pengamatan wisatawan yang perjalanannya sudah selesai di seluruh kawasan")}
        </p>
      </div>

      {agregat?.aktif === false && (
        <p className="rounded-2xl border border-ink/10 bg-white p-4 text-sm text-ink-faint">
          {agregat.alasan}
        </p>
      )}

      {agregat?.aktif && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: t("Total laporan"), v: agregat.total ?? 0 },
              { k: t("Belum ditangani"), v: agregat.belum_ditangani ?? 0, sorot: true },
              { k: t("Ulasan perjalanan"), v: ak?.n_ulasan ?? 0 },
              {
                k: t("Rata-rata kepuasan"),
                v: ak?.rata_skor != null ? ak.rata_skor.toFixed(1) : "—",
              },
            ].map((b) => (
              <div key={b.k} className="rounded-xl border border-ink/5 bg-white p-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-wide text-ink-faint">{b.k}</p>
                <p
                  className={`mt-1 font-display text-xl font-extrabold tabular-nums ${
                    b.sorot && Number(b.v) > 0 ? "text-brand-amber-ink" : "text-ink"
                  }`}
                >
                  {b.v}
                </p>
              </div>
            ))}
          </div>

          {/* Penanda kecukupan bukti. Tanpa ini, tiga laporan di satu kabupaten
              akan dibaca sebagai temuan dan masuk ke rapat anggaran. */}
          {!agregat.cukup_untuk_bukti && (
            <p className="flex items-start gap-2 rounded-xl border border-brand-amber/40 bg-brand-amber/[0.07] p-3 text-[11px] leading-relaxed text-ink-soft">
              <TriangleAlert
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber-ink"
                aria-hidden
              />
              <span>
                {/* Kalimat ini sengaja tidak dimulai dengan kata "Baru": kunci
                    itu sudah dipakai sebagai status laporan (BARU), dan satu
                    kunci dengan dua arti akan salah diterjemahkan di salah satu
                    tempat tanpa ada yang menyadari. */}
                {t("Terkumpul")} {agregat.total} {t("laporan, masih di bawah ambang")}{" "}
                {agregat.ambang_bukti}.{" "}
                {t(
                  "Angka di halaman ini belum layak dipakai memeringkat wilayah maupun membantah sumbu analisis kesenjangan.",
                )}
              </span>
            </p>
          )}

          {/* Akurasi rencana — satu-satunya kartu yang menghakimi sistem kami
              sendiri, bukan kabupaten mana pun. */}
          {ak != null && ak.porsi_lebih_mahal != null && (
            <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="flex items-center gap-2 font-display text-sm font-extrabold text-ink sm:text-base">
                <ClipboardCheck className="h-4 w-4 text-brand-sage-ink" aria-hidden />
                {t("Akurasi rencana yang disusun sistem")}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                <strong className="text-ink">
                  {Math.round(ak.porsi_lebih_mahal * 100)}%
                </strong>{" "}
                {t(
                  "wisatawan menilai biaya nyata lebih tinggi dari perkiraan aplikasi. Angka ini menilai estimasi kami, bukan kinerja kabupaten.",
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {Object.entries(ak.waktu).map(([k, n]) => (
                  <span
                    key={k}
                    className="rounded-lg bg-ink/5 px-2 py-1 text-[10px] font-bold text-ink-soft"
                  >
                    {t(LABEL_WAKTU[k as AkurasiWaktu] ?? k)}: {n}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Per kabupaten — kolom konfirmasi fasilitas adalah jembatan ke
              gap.py, dan satu-satunya bukti lapangan atas sumbu itu. */}
          {(agregat.per_kabupaten ?? []).length > 0 && (
            <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-display text-sm font-extrabold text-ink sm:text-base">
                {t("Tekanan per kabupaten")}
              </h2>
              <div className="gulir-x mt-3">
                <table className="w-full min-w-[36rem] text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-ink-faint">
                      <th className="pb-2 font-bold">{t("Kabupaten")}</th>
                      <th className="pb-2 text-right font-bold">{t("Laporan")}</th>
                      <th className="pb-2 text-right font-bold">{t("Berat")}</th>
                      <th className="pb-2 text-right font-bold">{t("Belum ditangani")}</th>
                      <th className="pb-2 text-right font-bold">{t("Konfirmasi fasilitas")}</th>
                      <th className="pb-2 text-right font-bold">{t("Masalah pendataan")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(agregat.per_kabupaten ?? []).map((k) => (
                      <tr key={k.kabupaten} className="border-t border-ink/5">
                        <td className="py-2 font-semibold text-ink">
                          {k.kabupaten}
                          {!k.cukup_untuk_bukti && (
                            <span className="ml-1.5 rounded bg-ink/5 px-1.5 py-0.5 text-[9px] font-bold text-ink-faint">
                              {t("n kecil")}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink">{k.n}</td>
                        <td className="py-2 text-right tabular-nums text-ink-soft">
                          {k.n_berat}
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-soft">
                          {k.belum_ditangani}
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-soft">
                          {k.n_konfirmasi_fasilitas}
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-soft">
                          {k.n_masalah_pendataan}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-faint">
                <Database className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                <span>
                  {t(
                    "\"Konfirmasi fasilitas\" adalah laporan yang membenarkan sumbu fasilitas pada analisis kesenjangan — satu-satunya bukti lapangan atas sumbu yang selama ini hanya diturunkan dari CSV. \"Masalah pendataan\" berarti jadwal atau data tempat di aplikasi tidak sesuai kenyataan.",
                  )}
                </span>
              </p>
            </section>
          )}

          {(agregat.per_kategori ?? []).length > 0 && (
            <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-display text-sm font-extrabold text-ink sm:text-base">
                {t("Jenis masalah terbanyak")}
              </h2>
              <ul className="mt-3 space-y-1.5">
                {(agregat.per_kategori ?? []).map((k) => (
                  <li key={k.kode} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate text-xs text-ink-soft">
                      {t(k.label)}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/5">
                      <span
                        className="block h-full rounded-full bg-brand-sage-ink"
                        style={{
                          width: `${Math.round(
                            (k.n / Math.max(...(agregat.per_kategori ?? []).map((x) => x.n))) * 100,
                          )}%`,
                        }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-ink">
                      {k.n}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {agregat.metodologi && (
            <p className="rounded-xl bg-ink/[0.03] p-3 text-[10px] leading-relaxed text-ink-faint">
              <strong className="text-ink-soft">{t("Metodologi")}.</strong> {agregat.metodologi}
            </p>
          )}
        </>
      )}

      {/* ── Kotak masuk ─────────────────────────────────────────────────── */}
      <div className="pt-1">
        <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">
          {t("Kotak masuk laporan")}
        </h2>
        <p className="mt-0.5 text-[11px] text-ink-faint">
          {t("Laporan tidak memuat identitas pelapor — jalur bacanya memang tidak membawanya.")}
        </p>
      </div>

      <div className="gulir-x -mx-1 px-1">
        <div className="flex gap-1.5">
          {SARINGAN.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSaring(s)}
              className={`sentuh shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                saring === s
                  ? "border-brand-sage-ink bg-brand-sage/15 text-brand-sage-ink"
                  : "border-ink/10 bg-white text-ink-soft hover:border-ink/25"
              }`}
            >
              {s === "SEMUA" ? t("Semua") : t(LABEL_STATUS_LAPORAN[s])}
            </button>
          ))}
        </div>
      </div>

      {kategoriMeta.length > 0 && (
        <select
          value={saringKategori}
          onChange={(e) => setSaringKategori(e.target.value)}
          className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-brand-sage sm:max-w-xs"
        >
          <option value="SEMUA">{t("Semua jenis masalah")}</option>
          {kategoriMeta.map((k) => (
            <option key={k.kode} value={k.kode}>
              {t(k.label)}
            </option>
          ))}
        </select>
      )}

      {memuat ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel h-24 rounded-2xl" />
          ))}
        </div>
      ) : laporan.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white p-8 text-center text-sm text-ink-faint">
          <Inbox className="mx-auto mb-2 h-8 w-8" aria-hidden />
          {t("Belum ada laporan pada saringan ini.")}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {laporan.map((l, i) => (
            <Reveal key={l.id} index={Math.min(i, 7)}>
              <li className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-extrabold text-ink sm:text-base">
                      {l.place_name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {l.kabupaten ?? "—"} · {l.jenis ?? "—"} · {l.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <span className="rounded-lg bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                      {t(LABEL_KATEGORI[l.kategori])}
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${WARNA_TINGKAT[l.tingkat]}`}
                    >
                      {t(LABEL_TINGKAT[l.tingkat])}
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${WARNA_STATUS_LAPORAN[l.status]}`}
                    >
                      {t(LABEL_STATUS_LAPORAN[l.status])}
                    </span>
                  </div>
                </div>

                {l.isi && (
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-soft sm:text-sm">
                    {l.isi}
                  </p>
                )}

                {l.tanggapan && (
                  <div className="mt-3 rounded-xl border-l-2 border-brand-sage bg-brand-sage/[0.07] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sage-ink">
                      <MessageSquare className="h-3 w-3" aria-hidden />
                      {t("Tanggapan dinas")}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                      {l.tanggapan}
                    </p>
                  </div>
                )}

                {buka === l.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      rows={3}
                      value={balasan}
                      onChange={(e) => setBalasan(e.target.value)}
                      placeholder={t("Tulis tindak lanjut atas laporan ini...")}
                      className="w-full rounded-xl border border-ink/10 bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand-sage"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {(["DIBACA", "DITINDAKLANJUTI", "SELESAI", "DITOLAK"] as StatusLaporan[]).map(
                        (s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={sibuk}
                            onClick={() => void kirim(l.id, s)}
                            className="sentuh flex items-center gap-1.5 rounded-xl border border-ink/15 px-3 py-2 text-xs font-bold text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
                          >
                            <Send className="h-3 w-3" aria-hidden />
                            {t(LABEL_STATUS_LAPORAN[s])}
                          </button>
                        ),
                      )}
                      <button
                        type="button"
                        onClick={() => { setBuka(null); setBalasan(""); }}
                        className="sentuh rounded-xl px-3 py-2 text-xs font-bold text-ink-faint"
                      >
                        {t("Batal")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setBuka(l.id); setBalasan(l.tanggapan ?? ""); }}
                    className="sentuh mt-3 rounded-xl border border-ink/15 px-3 py-2 text-xs font-bold text-ink-soft transition-colors hover:bg-ink/5"
                  >
                    {l.tanggapan ? t("Ubah tanggapan") : t("Tanggapi")}
                  </button>
                )}
              </li>
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
