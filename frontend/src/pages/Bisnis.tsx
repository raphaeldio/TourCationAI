import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Landmark,
  Minus,
  ScaleIcon,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ambilPaketPublik } from "../apiUmkm";
import { useT } from "../i18n";
import type { PaketPublik } from "../typesUmkm";

/**
 * Halaman harga publik.
 *
 * Satu hal yang tidak boleh hilang dari halaman ini, karena ia bagian dari
 * produknya dan bukan basa-basi hukum: **pernyataan bahwa langganan tidak
 * membeli peringkat.** Halaman harga yang menyembunyikannya membuat klaim
 * netralitas di dashboard pemerintah tidak bisa diperiksa siapa pun.
 *
 * Bagian slot bersponsor sengaja tetap ada — sebagai pernyataan bahwa fiturnya
 * TIDAK ADA. Diam soal itu justru menyisakan pertanyaan yang wajar ditanyakan.
 */

const rupiah = (n: number) =>
  n === 0 ? "Gratis" : "Rp " + n.toLocaleString("id-ID");

function Centang({ ada }: { ada: boolean }) {
  return ada ? (
    <Check className="h-4 w-4 text-brand-sage-ink" aria-hidden />
  ) : (
    <Minus className="h-4 w-4 text-ink-faint" aria-hidden />
  );
}

export default function Bisnis() {
  const t = useT();
  const [paket, setPaket] = useState<PaketPublik[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambilPaketPublik()
      .then((p) => !batal && setPaket(p))
      .catch((e: Error) => !batal && setGalat(e.message));
    return () => {
      batal = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-paper px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft no-underline hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("Kembali ke beranda")}
        </Link>

        {/* ── Judul ──────────────────────────────────────────────────── */}
        <header className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-sage/15 px-3 py-1.5 text-xs font-extrabold text-brand-sage-ink">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("Model Bisnis")}
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-ink sm:text-3xl">
            {t("Harga yang jujur, peringkat yang tidak dijual")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {t(
              "TourCation hidup dari dua pelanggan: UMKM yang ingin memahami pasarnya, dan pemerintah daerah yang ingin mengukur dampak kebijakannya. Keduanya membeli insight — bukan posisi di daftar rekomendasi.",
            )}
          </p>
        </header>

        {/* ── Aturan integritas, ditaruh DI ATAS tabel harga ─────────── */}
        <section className="mt-6 rounded-2xl border border-brand-sage/30 bg-brand-sage/[0.07] p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
            <ScaleIcon className="h-5 w-5 text-brand-sage-ink" aria-hidden />
            {t("Langganan tidak membeli peringkat")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {t(
              "Semua tier — termasuk Gratis — muncul di itinerary lewat optimasi yang sama persis. Status langganan tidak pernah dibaca oleh mesin penyusun rencana. Begitu langganan bisa membeli peringkat, kualitas rekomendasi runtuh dan dashboard pemerintah kehilangan keabsahannya.",
            )}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            {t(
              "Ini ditegakkan struktur kode, bukan janji: modul langganan hanya diimpor oleh halaman UMKM dan panel admin, tidak pernah oleh mesin itinerary.",
            )}
          </p>
        </section>

        {/* ── Tabel harga UMKM ───────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-ink sm:text-xl">
            <Store className="h-5 w-5 text-brand-sage-ink" aria-hidden />
            {t("Untuk UMKM")}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t("Rp 49.000 kira-kira setara dua porsi makan pada harga median dataset.")}
          </p>

          {galat && (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{galat}</p>
          )}

          {!paket && !galat ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skel h-72 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(paket ?? []).map((p) => {
                const sorot = p.kunci === "GROWTH";
                return (
                  <div
                    key={p.kunci}
                    className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${
                      sorot
                        ? "border-brand-sage-ink ring-1 ring-brand-sage-ink"
                        : "border-ink/10"
                    }`}
                  >
                    {sorot && (
                      <span className="mb-2 self-start rounded-lg bg-brand-amber px-2 py-0.5 text-[10px] font-extrabold text-on-amber">
                        {t("Paling sesuai")}
                      </span>
                    )}
                    <h3 className="font-display text-lg font-extrabold text-ink">{p.nama}</h3>
                    <p className="mt-1 font-display text-2xl font-extrabold text-ink">
                      {rupiah(p.harga_bulanan)}
                      {p.harga_bulanan > 0 && (
                        <span className="ml-1 text-xs font-semibold text-ink-faint">
                          /{t("bln")}
                        </span>
                      )}
                    </p>

                    <ul className="mt-4 flex-1 space-y-2 text-xs text-ink-soft sm:text-sm">
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                        <span>{t("Muncul di itinerary wisatawan")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                        <span>
                          {p.batas_produk === 0
                            ? t("Produk tak terbatas")
                            : `${p.batas_produk} ${t("produk aktif")}`}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
                        <span>
                          {p.riwayat_bulan} {t("bulan riwayat statistik")}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Centang ada={p.kuota_advisor > 0} />
                        <span>
                          {p.kuota_advisor === 0
                            ? t("AI Advisor tidak tersedia")
                            : `${t("AI Advisor")} ${p.kuota_advisor}×/30 ${t("hari")}`}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Centang ada={p.analisis_kompetitor} />
                        <span>{t("Analisis kompetitor sekabupaten (anonim)")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Centang ada={p.ekspor_csv} />
                        <span>{t("Ekspor CSV")}</span>
                      </li>
                    </ul>

                    <p className="mt-4 rounded-xl bg-ink/[0.03] p-2.5 text-[11px] leading-relaxed text-ink-faint">
                      {t("Badge Terverifikasi diperoleh dari skor, bukan dari paket.")}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-amber/10 p-3 text-xs leading-relaxed text-ink-soft">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber-ink" aria-hidden />
            <span>
              {t(
                "Pembayaran belum diaktifkan pada tahap ini. Status langganan diatur manual oleh admin — yang dibangun adalah strukturnya, bukan tiruan gateway pembayaran.",
              )}
            </span>
          </p>
        </section>

        {/* ── Lisensi pemerintah ─────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-ink sm:text-xl">
            <Landmark className="h-5 w-5 text-brand-sage-ink" aria-hidden />
            {t("Untuk Pemerintah Daerah")}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t(
              "Satu survei kepariwisataan bersifat sekali jalan dan usang dalam hitungan bulan. Lisensi tahunan memberi indikator yang terus diperbarui — plus kemampuan mensimulasikan dampak kebijakan sebelum anggaran dikeluarkan.",
            )}
          </p>

          <div className="gulir-x mt-4 -mx-1">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wide text-ink-faint">
                  <th className="px-2 py-2 font-bold">{t("Lisensi")}</th>
                  <th className="px-2 py-2 font-bold">{t("Cakupan")}</th>
                  <th className="px-2 py-2 text-right font-bold">{t("Estimasi per tahun")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Kabupaten/Kota", "1 wilayah: dashboard, analisis kesenjangan, simulator, 5 akun", "Rp 45–90 juta"],
                  ["Provinsi", "Seluruh kabupaten + perbandingan antarwilayah, 25 akun, akses API", "Rp 250–450 juta"],
                  ["Badan Otorita / BUMD", "Lintas kabupaten, indikator kustom, laporan kuartalan", "Mulai Rp 150 juta"],
                  ["Pilot", "6 bulan, 1 kabupaten, fitur penuh", "Tanpa biaya"],
                ].map(([nama, cakupan, harga]) => (
                  <tr key={nama} className="border-b border-ink/5 last:border-0">
                    <td className="px-2 py-2.5 font-semibold text-ink">{t(nama)}</td>
                    <td className="px-2 py-2.5 leading-relaxed text-ink-soft">{t(cakupan)}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-ink">
                      {t(harga)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            {t(
              "Tier Kabupaten sengaja dipatok di bawah ambang pengadaan langsung agar siklus pembeliannya berupa hitungan minggu, bukan satu tahun anggaran. Ambang nominalnya berubah antar-Perpres dan diverifikasi ulang sebelum setiap penawaran.",
            )}
          </p>
        </section>

        {/* ── Status slot bersponsor ─────────────────────────────────── */}
        <section className="mt-10 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-ink">
            <ShieldCheck className="h-5 w-5 text-brand-sage-ink" aria-hidden />
            {t("Tidak ada slot bersponsor")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {t(
              "Penempatan berbayar tidak tersedia, dan kodenya tidak ada di dalam produk ini. Urutan yang Anda lihat pada rekomendasi sepenuhnya berasal dari relevansi — tidak ada satu pun jalur yang bisa dibeli.",
            )}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            {t(
              "Bila kelak dihidupkan, aturannya akan diterbitkan lebih dulu di halaman ini — sebelum ada uang yang terlibat, bukan sesudahnya.",
            )}
          </p>
        </section>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-ink-faint">
          {t(
            "Seluruh angka pendapatan pada dokumen model bisnis adalah model berbasis asumsi yang dinyatakan terbuka, bukan proyeksi terverifikasi.",
          )}
        </p>
      </div>
    </div>
  );
}
