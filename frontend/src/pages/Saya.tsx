import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  MapPinned,
  MessageSquarePlus,
  Route,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ambilRatingSaya } from "../apiKomunitas";
import { ambilPerjalananSaya } from "../apiPerjalanan";
import { useAuth } from "../auth";
import Bintang from "../components/Bintang";
import { useT } from "../i18n";
import { LABEL_STATUS_PERJALANAN } from "../labelPerjalanan";
import type { RatingSaya } from "../typesKomunitas";
import type { Perjalanan } from "../typesPerjalanan";

/**
 * Satu baris perjalanan di inbox.
 *
 * Judulnya jadi tautan HANYA bila `boleh_dibuka` — artinya payload-nya memang
 * tersimpan. Rencana yang cuma pernah tersusun (tidak pernah ditekan Simpan)
 * tetap tampil sebagai jejak, tetapi tanpa tautan: tautan yang membuka halaman
 * galat lebih merugikan daripada teks biasa.
 */
function BarisPerjalanan({ p, latar }: { p: Perjalanan; latar: string }) {
  const t = useT();
  const nama =
    p.judul || (p.kabupaten_tersentuh ?? []).join(" · ") || t("Kawasan Danau Toba");

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/5 p-3 ${latar}`}
    >
      <span className="min-w-0">
        {p.boleh_dibuka ? (
          <Link
            to={`/perjalanan/${p.id}`}
            className="block truncate text-sm font-semibold text-ink no-underline hover:underline"
          >
            {nama}
          </Link>
        ) : (
          <span className="block truncate text-sm font-semibold text-ink">{nama}</span>
        )}
        <span className="block text-[11px] text-ink-faint">
          {t(LABEL_STATUS_PERJALANAN[p.status])} · {p.n_days} {t("hari")}
          {p.tanggal_mulai ? ` · ${p.tanggal_mulai}` : ` · ${t("tanpa tanggal")}`}
          {!p.disimpan && ` · ${t("tidak disimpan")}`}
        </span>
      </span>

      {p.sudah_diulas ? (
        <Link
          to={`/perjalanan/${p.id}/ulasan`}
          className="sentuh flex shrink-0 items-center gap-1.5 text-xs font-bold text-ink-soft no-underline hover:text-ink"
        >
          {p.skor_ulasan != null && <Bintang nilai={p.skor_ulasan} ukuran="sm" />}
          {t("Lihat ulasan")}
        </Link>
      ) : p.boleh_diulas ? (
        <Link
          to={`/perjalanan/${p.id}/ulasan`}
          className="sentuh flex shrink-0 items-center gap-2 rounded-xl bg-brand-sage-ink px-3.5 py-2 text-xs font-bold text-on-sage-ink no-underline"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
          {t("Beri Ulasan")}
        </Link>
      ) : p.boleh_dibuka ? (
        <Link
          to={`/perjalanan/${p.id}`}
          className="sentuh shrink-0 rounded-xl border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink-soft no-underline hover:text-ink"
        >
          {t("Buka rencana")}
        </Link>
      ) : (
        <span className="shrink-0 text-[11px] text-ink-faint">
          {p.status === "SELESAI" ? t("Belum diulas") : t("Belum bisa diulas")}
        </span>
      )}
    </li>
  );
}

/**
 * Halaman sisi wisatawan.
 *
 * Peran USER tidak punya dashboard bisnis, dan tidak seharusnya punya. Yang ia
 * butuhkan tiga: jalan cepat kembali menyusun rencana, inbox perjalanannya
 * beserta pintu memberi ulasan, dan jejak penilaian yang pernah ia berikan —
 * karena penilaian itulah kontribusinya ke ekosistem.
 */
export default function Saya() {
  const t = useT();
  const { profil } = useAuth();
  const [rating, setRating] = useState<RatingSaya[] | null>(null);
  const [perjalanan, setPerjalanan] = useState<Perjalanan[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambilRatingSaya()
      .then((d) => !batal && setRating(d.rating))
      .catch((e: Error) => !batal && setGalat(e.message));
    // Kegagalan memuat perjalanan tidak boleh menghapus daftar penilaian yang
    // sudah tampil; ia hanya membuat bagiannya kosong.
    ambilPerjalananSaya()
      .then((d) => !batal && setPerjalanan(d.perjalanan))
      .catch(() => !batal && setPerjalanan([]));
    return () => {
      batal = true;
    };
  }, []);

  const semua = perjalanan ?? [];
  // Inbox dibagi menurut apa yang bisa DILAKUKAN, bukan menurut tanggal.
  // "Aktif" adalah yang masih di depan atau sedang berjalan; "selesai" adalah
  // yang menunggu ulasan. Riwayat menampung sisanya — termasuk rencana yang
  // pernah tersusun tapi tidak pernah disimpan.
  const aktif = semua.filter(
    (p) => p.disimpan && (p.status === "AKAN_DATANG" || p.status === "BERJALAN"),
  );
  const belumDiulas = semua.filter((p) => p.boleh_diulas);
  const riwayat = semua.filter((p) => !aktif.includes(p) && !belumDiulas.includes(p));

  const rerata =
    rating && rating.length
      ? rating.reduce((a, b) => a + b.rating, 0) / rating.length
      : null;

  return (
    <div className="min-h-screen bg-surface-paper px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft no-underline hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("Kembali ke beranda")}
        </Link>

        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">
            {t("Halo")}, {profil?.email?.split("@")[0] ?? t("penjelajah")}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {t(
              "Setiap penilaian yang Anda berikan ikut membentuk skor kepercayaan UMKM di kawasan Danau Toba — dan membantu usaha yang belum dikenal mendapat kesempatan yang sama.",
            )}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/"
              className="sentuh flex items-center gap-2 rounded-xl bg-brand-sage-ink px-4 py-2.5 text-sm font-bold text-on-sage-ink no-underline"
            >
              <MapPinned className="h-4 w-4" aria-hidden />
              {t("Susun Perjalanan")}
            </Link>
            <Link
              to="/akun"
              className="sentuh flex items-center gap-2 rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-bold text-ink no-underline"
            >
              {t("Akun Saya")}
            </Link>
          </div>
        </section>

        {/* Perjalanan aktif lebih dulu: itu yang sedang dipakai orangnya.
            Sesudahnya yang menunggu ulasan, baru riwayat. Urutannya mengikuti
            apa yang menuntut tindakan, bukan urutan tanggal. */}
        {aktif.length > 0 && (
          <section className="mt-4 rounded-2xl border border-brand-sage/40 bg-brand-sage/[0.06] p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
              <Route className="h-5 w-5 text-brand-sage-ink" aria-hidden />
              {t("Perjalanan Aktif")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {t("Rencana yang Anda simpan dan belum selesai. Klik untuk membukanya kembali.")}
            </p>
            <ul className="mt-3 space-y-2">
              {aktif.map((p) => (
                <BarisPerjalanan key={p.id} p={p} latar="bg-white" />
              ))}
            </ul>
          </section>
        )}

        {belumDiulas.length > 0 && (
          <section className="mt-4 rounded-2xl border border-brand-amber/40 bg-brand-amber/[0.07] p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
              <CalendarCheck className="h-5 w-5 text-brand-amber-ink" aria-hidden />
              {t("Perjalanan Anda sudah selesai")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {t(
                "Ceritakan bagaimana kenyataannya. Penilaian Anda menggerakkan skor kepercayaan UMKM, dan laporan lapangan Anda masuk ke dinas pariwisata secara anonim.",
              )}
            </p>
            <ul className="mt-3 space-y-2">
              {belumDiulas.map((p) => (
                <BarisPerjalanan key={p.id} p={p} latar="bg-white" />
              ))}
            </ul>
          </section>
        )}

        {riwayat.length > 0 && (
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
              <CalendarClock className="h-5 w-5 text-brand-sage-ink" aria-hidden />
              {t("Riwayat Perjalanan")}
            </h2>
            <ul className="mt-3 space-y-2">
              {riwayat.map((p) => (
                <BarisPerjalanan key={p.id} p={p} latar="bg-surface-2/60" />
              ))}
            </ul>
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink sm:text-lg">
              <Star className="h-5 w-5 text-brand-amber" aria-hidden />
              {t("Penilaian Anda")}
            </h2>
            {rerata != null && (
              <p className="text-xs text-ink-faint">
                {rating?.length} {t("usaha dinilai")} · {t("rata-rata")}{" "}
                <strong className="text-ink">{rerata.toFixed(1)}</strong>
              </p>
            )}
          </div>

          {galat ? (
            <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{galat}</p>
          ) : !rating ? (
            <div className="mt-3 space-y-2">
              {[0, 1].map((i) => <div key={i} className="skel h-16 rounded-xl" />)}
            </div>
          ) : rating.length === 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-ink/[0.03] p-4 text-xs leading-relaxed text-ink-faint">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {t(
                  "Belum ada penilaian. Susun rencana perjalanan, lalu beri penilaian pada rumah makan yang Anda kunjungi — satu akun satu penilaian per usaha, dan bisa diubah kapan saja.",
                )}
              </span>
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rating.map((r) => (
                <li
                  key={r.business_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/5 bg-surface-2/60 p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {r.nama_usaha ?? "—"}
                    </span>
                    <span className="block text-[11px] text-ink-faint">
                      {r.kabupaten ?? "—"} · {r.updated_at.slice(0, 10)}
                    </span>
                    {r.komentar && (
                      <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
                        {r.komentar}
                      </span>
                    )}
                  </span>
                  <Bintang nilai={r.rating} ukuran="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
