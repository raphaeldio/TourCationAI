import {
  AlertTriangle,
  BadgeCheck,
  Flag,
  Inbox,
  MessageSquare,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ambilUmpanBalikUmkm } from "../apiPerjalanan";
import Bintang from "../components/Bintang";
import Reveal from "../components/Reveal";
import { useT } from "../i18n";
import {
  LABEL_KATEGORI,
  LABEL_STATUS_LAPORAN,
  LABEL_TINGKAT,
  WARNA_STATUS_LAPORAN,
  WARNA_TINGKAT,
} from "../labelPerjalanan";
import type { UmpanBalikUmkm } from "../typesPerjalanan";

/**
 * Umpan balik dari wisatawan yang benar-benar datang.
 *
 * Halaman ini menampilkan dua hal yang sengaja TIDAK dicampur, karena yang bisa
 * dilakukan pemilik usaha terhadap keduanya berbeda:
 *
 *   1. Penilaian bersaksi — pendapat tentang usahanya. Bisa ia perbaiki.
 *   2. Laporan lapangan — pengamatan yang muaranya dinas. Sebagian besar TIDAK
 *      bisa ia perbaiki, dan halaman ini menyatakannya terang-terangan supaya
 *      ia tidak merasa disalahkan atas jalan rusak di depan warungnya.
 *
 * Untuk yang kedua, tindakan yang tersedia bukan "perbaiki" melainkan
 * "teruskan ke dinas" — dan jalurnya sudah ada: halaman Suara & Pengumuman.
 */
export default function UmkmUmpanBalik() {
  const t = useT();
  const [data, setData] = useState<UmpanBalikUmkm | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambilUmpanBalikUmkm()
      .then((d) => !batal && setData(d))
      .catch((e: Error) => !batal && setGalat(e.message));
    return () => {
      batal = true;
    };
  }, []);

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

  if (!data) {
    return (
      <div className="space-y-3">
        <div className="skel h-24 rounded-2xl" />
        <div className="skel h-56 rounded-2xl" />
      </div>
    );
  }

  const r = data.ringkas_laporan;
  const rerata =
    data.penilaian_bersaksi.length > 0
      ? data.penilaian_bersaksi.reduce((a, b) => a + b.rating, 0) /
        data.penilaian_bersaksi.length
      : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
          {t("Umpan Balik Perjalanan")}
        </h1>
        <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
          {t("Dari wisatawan yang rencananya memang melewati tempat Anda dan sudah selesai")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: t("Penilaian bersaksi"), v: data.n_bersaksi },
          { k: t("Rata-rata"), v: rerata != null ? rerata.toFixed(1) : "—" },
          { k: t("Laporan lapangan"), v: r.total },
          { k: t("Bisa Anda perbaiki"), v: r.bisa_saya_perbaiki, sorot: true },
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

      {/* ── Penilaian bersaksi ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-sm font-extrabold text-ink sm:text-base">
          <BadgeCheck className="h-4 w-4 text-brand-sage-ink" aria-hidden />
          {t("Penilaian bersaksi")}
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
          {t(
            "Berbeda dari penilaian biasa: yang ini dipastikan berasal dari akun yang rencana perjalanannya memuat tempat Anda dan tanggalnya sudah lewat. Bobotnya pada skor kepercayaan sama seperti penilaian lain — penandaannya untuk transparansi, bukan untuk mengubah skor.",
          )}
        </p>

        {data.penilaian_bersaksi.length === 0 ? (
          <p className="mt-3 rounded-xl bg-ink/[0.03] p-4 text-xs leading-relaxed text-ink-faint">
            {t(
              "Belum ada. Penilaian bersaksi muncul setelah wisatawan yang melewati tempat Anda menyelesaikan perjalanannya dan mengisi ulasan.",
            )}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.penilaian_bersaksi.map((p, i) => (
              <Reveal key={`${p.updated_at}-${i}`} index={Math.min(i, 7)}>
                <li className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Bintang nilai={p.rating} ukuran="sm" />
                    <span className="text-[11px] text-ink-faint">
                      {p.updated_at.slice(0, 10)}
                    </span>
                  </div>
                  {p.komentar && (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{p.komentar}</p>
                  )}
                </li>
              </Reveal>
            ))}
          </ul>
        )}
      </section>

      {/* ── Laporan lapangan ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-sm font-extrabold text-ink sm:text-base">
          <Flag className="h-4 w-4 text-brand-amber-ink" aria-hidden />
          {t("Laporan lapangan yang menyangkut tempat Anda")}
        </h2>

        {/* Pernyataan yang paling penting di halaman ini. */}
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-brand-sage/30 bg-brand-sage/[0.07] p-3 text-[11px] leading-relaxed text-ink-soft">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-sage-ink" aria-hidden />
          <span>
            {t(
              "Laporan ini TIDAK memengaruhi skor kepercayaan maupun status harga usaha Anda. Muaranya dinas pariwisata. Sebagian besar isinya di luar kendali Anda — jalan, papan penunjuk, sinyal — dan Anda melihatnya di sini supaya bisa meneruskannya ke dinas.",
            )}
          </span>
        </p>

        {r.bisa_saya_perbaiki > 0 && (
          <p className="mt-2 flex items-start gap-2 rounded-xl border border-brand-amber/40 bg-brand-amber/[0.07] p-3 text-[11px] leading-relaxed text-ink-soft">
            <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-amber-ink" aria-hidden />
            <span>
              <strong className="text-ink">
                {r.bisa_saya_perbaiki} {t("laporan bisa Anda selesaikan sendiri")}
              </strong>{" "}
              {t(
                "— wisatawan menemukan tempat Anda tutup padahal jam buka di aplikasi menyatakan buka. Perbarui jam buka di halaman Usaha & Produk.",
              )}
            </span>
          </p>
        )}

        {r.total === 0 ? (
          <p className="mt-3 rounded-xl border border-ink/5 bg-ink/[0.02] p-6 text-center text-xs text-ink-faint">
            <Inbox className="mx-auto mb-2 h-7 w-7" aria-hidden />
            {t("Belum ada laporan yang menyangkut tempat Anda.")}
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {data.laporan.map((l, i) => (
                <Reveal key={l.id} index={Math.min(i, 7)}>
                  <li className="rounded-xl border border-ink/5 bg-surface-2/60 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 text-[11px] text-ink-faint">
                        {l.created_at.slice(0, 10)}
                      </p>
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
                      <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                        {l.isi}
                      </p>
                    )}
                    {l.tanggapan && (
                      <div className="mt-2 rounded-lg border-l-2 border-brand-sage bg-brand-sage/[0.07] p-2.5">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-sage-ink">
                          <MessageSquare className="h-3 w-3" aria-hidden />
                          {t("Tanggapan dinas")}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                          {l.tanggapan}
                        </p>
                      </div>
                    )}
                  </li>
                </Reveal>
              ))}
            </ul>

            {/* Menutup lingkarannya: laporan yang bukan urusan pemilik punya
                satu tindakan yang masuk akal, dan jalurnya sudah ada. */}
            <Link
              to="/umkm/suara"
              className="sentuh mt-3 inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-xs font-bold text-ink no-underline transition-colors hover:bg-ink/5"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              {t("Teruskan ke dinas lewat Aspirasi")}
            </Link>
          </>
        )}
      </section>

      <p className="rounded-xl bg-ink/[0.03] p-3 text-[10px] leading-relaxed text-ink-faint">
        {data.catatan}
      </p>
    </div>
  );
}
