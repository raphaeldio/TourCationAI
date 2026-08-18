import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Check,
  CreditCard,
  Download,
  History,
  Lock,
  Minus,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import { usePaket } from "../paket";
import type { StatusLangganan } from "../typesUmkm";

const rupiah = (n: number) => (n === 0 ? "Gratis" : "Rp " + n.toLocaleString("id-ID"));

type Terjemah = (teks: string) => string;

interface BarisFitur {
  label: string;
  ikon: LucideIcon;
  /** Halaman tempat fitur ini benar-benar dipakai. */
  ke: string;
  /** Keadaan fitur pada paket berjalan, sudah dalam bentuk kalimat.
   *
   *  Menerima `t` alih-alih dirakit lalu diterjemahkan di tempat pemakaian:
   *  kalimatnya memuat angka, dan string yang sudah bercampur angka tidak akan
   *  pernah ketemu di kamus. */
  keadaan: (l: StatusLangganan, t: Terjemah) => string;
  aktif: (l: StatusLangganan) => boolean;
}

/**
 * Isi paket, masing-masing menunjuk ke halaman tempat fiturnya hidup.
 *
 * Ini bagian yang paling mudah terlewat saat merancang halaman langganan:
 * pengguna yang baru saja melihat "Analisis kompetitor ✓" perlu tahu ke mana
 * harus pergi untuk memakainya. Tabel harga tanpa tautan memaksa mereka menebak
 * lewat menu samping — dan sebagian menyerah di situ, lalu menyimpulkan fiturnya
 * tidak ada.
 */
const FITUR: BarisFitur[] = [
  {
    label: "Penasihat Bisnis AI",
    ikon: Sparkles,
    ke: "/umkm/usaha",
    aktif: (l) => l.kuota_advisor > 0,
    keadaan: (l, t) =>
      l.kuota_advisor === 0
        ? t("Belum termasuk paket ini")
        : `${l.kuota_sisa} ${t("dari")} ${l.kuota_advisor} ${t("kali tersisa periode ini")}`,
  },
  {
    label: "Analisis kompetitor",
    ikon: BarChart3,
    ke: "/umkm/analisis",
    aktif: (l) => l.analisis_kompetitor,
    keadaan: (l, t) =>
      t(l.analisis_kompetitor ? "Anonim, sekabupaten" : "Belum termasuk paket ini"),
  },
  {
    label: "Riwayat statistik",
    ikon: History,
    ke: "/umkm/analisis",
    aktif: () => true,
    keadaan: (l, t) => `${t("Jendela")} ${l.riwayat_bulan} ${t("bulan")}`,
  },
  {
    label: "Ekspor CSV",
    ikon: Download,
    ke: "/umkm/analisis",
    aktif: (l) => l.ekspor_csv,
    keadaan: (l, t) =>
      t(l.ekspor_csv ? "Produk, penilaian, riwayat" : "Belum termasuk paket ini"),
  },
];

/**
 * Tab Langganan pada dashboard UMKM.
 *
 * Menampilkan paket berjalan, sisa kuota advisor, dan katalog tier. Tidak ada
 * tombol bayar: pembayaran belum diaktifkan, dan tombol yang tidak melakukan
 * apa-apa lebih buruk daripada tidak ada tombol sama sekali.
 */
export default function Langganan() {
  const t = useT();
  // Sumbernya konteks paket, bukan permintaan sendiri: halaman ini dan
  // navigasi harus mustahil menampilkan dua paket yang berbeda.
  const { langganan, katalog, galat } = usePaket();

  if (galat) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="flex items-center gap-2 font-display font-extrabold text-amber-900">
          <AlertTriangle className="h-5 w-5" aria-hidden /> {t("Belum bisa menampilkan langganan")}
        </p>
        <p className="mt-1 text-sm text-amber-800">{galat}</p>
      </div>
    );
  }

  if (!langganan) {
    return (
      <div className="space-y-4">
        <div className="skel h-8 w-56 rounded-xl" />
        <div className="skel h-40 rounded-2xl" />
        <div className="skel h-64 rounded-2xl" />
      </div>
    );
  }

  const l = langganan;
  const habis = l.kuota_advisor > 0 && l.kuota_sisa === 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {t("Langganan")}
        </h1>
        <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
          {t("Paket menentukan kedalaman insight, bukan posisi Anda di rekomendasi")}
        </p>
      </div>

      {/* ── Paket berjalan ─────────────────────────────────────────── */}
      <Reveal>
        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                {t("Paket berjalan")}
              </p>
              <p className="mt-1 flex items-center gap-2 font-display text-2xl font-extrabold text-ink">
                <CreditCard className="h-6 w-6 text-brand-sage-ink" aria-hidden />
                {l.nama}
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {rupiah(l.harga_bulanan)}
                {l.harga_bulanan > 0 && ` / ${t("bln")}`}
              </p>
            </div>
            <Link
              to="/bisnis"
              className="sentuh flex items-center gap-1.5 rounded-xl border border-ink/15 px-3 py-2 text-xs font-bold text-ink no-underline transition-colors hover:bg-ink/5"
            >
              {t("Lihat semua paket")}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>

          {l.catatan && (
            <p className="mt-3 rounded-xl bg-brand-amber/10 p-3 text-xs text-ink-soft">
              {t(l.catatan)}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                k: t("Kuota AI Advisor"),
                v:
                  l.kuota_advisor === 0
                    ? "—"
                    : `${l.kuota_sisa}/${l.kuota_advisor}`,
                nada: habis ? "text-rose-700" : undefined,
              },
              {
                k: t("Batas produk"),
                v: l.batas_produk === 0 ? t("Tak terbatas") : String(l.batas_produk),
              },
              { k: t("Riwayat statistik"), v: `${l.riwayat_bulan} ${t("bln")}` },
              {
                k: t("Berlaku sampai"),
                v: l.selesai ? l.selesai.slice(0, 10) : "—",
              },
            ].map((b) => (
              <div key={b.k} className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
                <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{b.k}</dt>
                <dd
                  className={`mt-1 font-display text-lg font-extrabold tabular-nums ${
                    b.nada ?? "text-ink"
                  }`}
                >
                  {b.v}
                </dd>
              </div>
            ))}
          </dl>

          {habis && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {t(
                  "Kuota AI Advisor periode ini sudah habis. Narasi yang sudah pernah dibuat tetap bisa dibuka — menyajikannya dari cache tidak memotong kuota.",
                )}
              </span>
            </p>
          )}
        </section>
      </Reveal>

      {/* ── Isi paket, masing-masing menuju halamannya ─────────────── */}
      <Reveal index={1}>
        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">
            {t("Yang termasuk paket Anda")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {t("Tekan salah satu untuk langsung membuka halamannya")}
          </p>

          <ul className="mt-3 space-y-2">
            {FITUR.map((f) => {
              const aktif = f.aktif(l);
              return (
                <li key={f.label}>
                  <Link
                    to={f.ke}
                    className="sentuh group flex items-center gap-3 rounded-xl border border-ink/5 bg-surface-2/50 p-3 no-underline transition-colors hover:border-brand-sage/40"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        aktif ? "bg-brand-sage/15" : "bg-ink/5"
                      }`}
                    >
                      <f.ikon
                        className={`h-4 w-4 ${aktif ? "text-brand-sage-ink" : "text-ink-faint"}`}
                        aria-hidden
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">
                        {t(f.label)}
                      </span>
                      <span className="block truncate text-[11px] text-ink-faint">
                        {f.keadaan(l, t)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${
                        aktif
                          ? "bg-brand-sage/15 text-brand-sage-ink"
                          : "bg-brand-amber/20 text-brand-amber-ink"
                      }`}
                    >
                      {aktif ? (
                        t("aktif")
                      ) : (
                        <span className="flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" aria-hidden />
                          {t("terkunci")}
                        </span>
                      )}
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </Reveal>

      {/* ── Katalog ────────────────────────────────────────────────── */}
      <Reveal index={2}>
        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-base font-extrabold text-ink sm:text-lg">
            {t("Perbandingan paket")}
          </h2>
          <div className="gulir-x mt-3 -mx-1">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wide text-ink-faint">
                  <th className="px-2 py-2 font-bold">{t("Paket")}</th>
                  <th className="px-2 py-2 text-right font-bold">{t("Harga")}</th>
                  <th className="px-2 py-2 text-right font-bold">{t("Produk")}</th>
                  <th className="px-2 py-2 text-right font-bold">{t("Advisor")}</th>
                  <th className="px-2 py-2 text-center font-bold">{t("Ekspor CSV")}</th>
                </tr>
              </thead>
              <tbody>
                {katalog.map((p) => (
                  <tr
                    key={p.kunci}
                    className={`border-b border-ink/5 last:border-0 ${
                      p.kunci === l.plan ? "bg-brand-sage/[0.07]" : ""
                    }`}
                  >
                    <td className="px-2 py-2.5 font-semibold text-ink">
                      {p.nama}
                      {p.kunci === l.plan && (
                        <span className="ml-2 rounded bg-brand-sage/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-sage-ink">
                          {t("aktif")}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-ink-soft">
                      {rupiah(p.harga_bulanan)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-soft">
                      {p.batas_produk === 0 ? "∞" : p.batas_produk}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ink-soft">
                      {p.kuota_advisor === 0 ? "—" : `${p.kuota_advisor}×`}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex justify-center">
                        {p.ekspor_csv ? (
                          <Check className="h-4 w-4 text-brand-sage-ink" aria-hidden />
                        ) : (
                          <Minus className="h-4 w-4 text-ink-faint" aria-hidden />
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-sage/[0.07] p-3 text-xs leading-relaxed text-ink-soft">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage-ink" aria-hidden />
            <span>
              {t(
                "Semua paket muncul di itinerary lewat optimasi yang sama. Naik paket menambah kedalaman insight, tidak menaikkan posisi Anda di rekomendasi wisatawan.",
              )}
            </span>
          </p>

          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            {t(
              "Pembayaran belum diaktifkan. Untuk mencoba tier berbayar saat penjurian, admin dapat menetapkannya langsung.",
            )}
          </p>
        </section>
      </Reveal>
    </div>
  );
}
