import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cariGaleriSlug, sampulItem } from "../config";
import { useT } from "../i18n";

/**
 * Halaman detail sebuah destinasi galeri.
 *
 * Untuk sekarang SENGAJA kosong — hanya menampilkan judul, keterangan singkat,
 * dan foto sampulnya sebagai kerangka. Isi lengkapnya (deskripsi panjang, peta,
 * tips, dsb.) diisi belakangan; kartu di beranda sudah mengarah ke sini.
 */
export default function GaleriDetail() {
  const t = useT();
  const { slug = "" } = useParams();
  const item = cariGaleriSlug(slug);

  return (
    <div className="app min-h-screen">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-forest transition hover:text-brand-amber-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("Ke beranda")}
        </Link>

        {item ? (
          <>
            {/* Sampul, BUKAN item.sumber: untuk kartu video `sumber` adalah
                tautan YouTube, yang tidak bisa dipakai sebagai src gambar. */}
            <div className="mt-6 overflow-hidden rounded-3xl border border-white/50 shadow-[0_24px_60px_-28px_hsl(var(--brand-forest)/0.55)]">
              <img
                src={sampulItem(item)}
                alt={t(item.judul)}
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
            <h1 className="mt-7 font-display text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-tight text-ink">
              {t(item.judul)}
            </h1>
            {item.keterangan && (
              <p className="mt-2 text-base leading-relaxed text-ink-soft">
                {t(item.keterangan)}
              </p>
            )}
            <p className="mt-8 rounded-2xl border border-dashed border-ink/15 bg-white/40 p-6 text-sm leading-relaxed text-ink-faint">
              {t("Halaman ini masih disiapkan. Konten lengkapnya segera hadir.")}
            </p>
          </>
        ) : (
          <div className="mt-16 text-center">
            <h1 className="font-display text-3xl font-extrabold text-ink">
              {t("Halaman tidak ditemukan")}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              {t("Destinasi yang kamu cari tidak ada dalam galeri.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
